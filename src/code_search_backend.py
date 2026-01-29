"""
Code Search Backend - Extracted from code_search.ipynb

Provides semantic code search functionality using embeddings and ChromaDB.
"""

import os
from typing import List, Dict
from pathlib import Path

import chromadb
from sentence_transformers import SentenceTransformer
from tree_sitter_languages import get_parser

# Add parent directory to path for utils
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from utils import list_python_files


# Global model (loaded once)
_embedding_model = None
_parser = None


def get_embedding_model(model_name: str = "jinaai/jina-embeddings-v2-base-code"):
    """Get or initialize the embedding model (singleton pattern)."""
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = SentenceTransformer(model_name, trust_remote_code=True)
    return _embedding_model


def get_parser_instance():
    """Get or initialize the tree-sitter parser (singleton pattern)."""
    global _parser
    if _parser is None:
        _parser = get_parser("python")
    return _parser


def extract_code_chunks(file_path: str) -> List[Dict]:
    """Extract functions and classes from a Python file using tree-sitter."""
    parser = get_parser_instance()
    chunks = []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            code = f.read()
        
        tree = parser.parse(bytes(code, "utf8"))
        root_node = tree.root_node
        
        def traverse(node, depth=0):
            # Extract function definitions
            if node.type == 'function_definition':
                name_node = node.child_by_field_name('name')
                if name_node:
                    func_name = code[name_node.start_byte:name_node.end_byte]
                    func_code = code[node.start_byte:node.end_byte]
                    
                    # Extract docstring if present
                    docstring = ""
                    body = node.child_by_field_name('body')
                    if body and body.child_count > 0:
                        first_child = body.children[0]
                        if first_child.type == 'expression_statement':
                            expr = first_child.children[0]
                            if expr.type == 'string':
                                docstring = code[expr.start_byte:expr.end_byte].strip('"""').strip("'''").strip()
                    
                    chunks.append({
                        'type': 'function',
                        'name': func_name,
                        'code': func_code,
                        'docstring': docstring,
                        'file_path': file_path,
                        'start_line': node.start_point[0] + 1,
                        'end_line': node.end_point[0] + 1,
                    })
            
            # Extract class definitions
            elif node.type == 'class_definition':
                name_node = node.child_by_field_name('name')
                if name_node:
                    class_name = code[name_node.start_byte:name_node.end_byte]
                    class_code = code[node.start_byte:node.end_byte]
                    
                    # Extract class docstring
                    docstring = ""
                    body = node.child_by_field_name('body')
                    if body and body.child_count > 0:
                        first_child = body.children[0]
                        if first_child.type == 'expression_statement':
                            expr = first_child.children[0]
                            if expr.type == 'string':
                                docstring = code[expr.start_byte:expr.end_byte].strip('"""').strip("'''").strip()
                    
                    # Limit class code to avoid huge chunks
                    if len(class_code) > 2000:
                        class_code = class_code[:2000] + "\n    # ... (truncated)"
                    
                    chunks.append({
                        'type': 'class',
                        'name': class_name,
                        'code': class_code,
                        'docstring': docstring,
                        'file_path': file_path,
                        'start_line': node.start_point[0] + 1,
                        'end_line': node.end_point[0] + 1,
                    })
            
            # Recursively traverse children
            for child in node.children:
                traverse(child, depth + 1)
        
        traverse(root_node)
    except Exception as e:
        print(f"Error parsing {file_path}: {e}")
    
    return chunks


def create_searchable_text(chunk: Dict) -> str:
    """Create searchable text with prioritized metadata and limited code for better embeddings."""
    parts = []
    
    # 1. Prioritize docstring (most semantic information)
    if chunk['docstring']:
        parts.append(f"Documentation: {chunk['docstring']}")
    
    # 2. Add type and name (critical identifiers)
    parts.append(f"{chunk['type']}: {chunk['name']}")
    
    # 3. Add file path for context
    file_name = chunk['file_path'].split('/')[-1] if '/' in chunk['file_path'] else chunk['file_path'].split('\\')[-1]
    parts.append(f"File: {file_name}")
    
    # 4. Add limited code (first 400 chars to avoid dilution)
    code_snippet = chunk['code'][:400]
    parts.append(f"Code:\n{code_snippet}")
    
    return "\n\n".join(parts)


def index_repository(
    repo_path: str,
    db_path: str = "../data/chroma_db",
    collection_name: str = "flask_code",
    force_reindex: bool = False,
    verbose: bool = True
):
    """Index all Python files in the repository."""
    
    model = get_embedding_model()
    
    # Initialize ChromaDB
    os.makedirs(db_path, exist_ok=True)
    client = chromadb.PersistentClient(path=db_path)
    
    # Get or create collection with COSINE similarity
    try:
        if force_reindex:
            client.delete_collection(name=collection_name)
            if verbose:
                print("Deleted existing collection for reindexing.")
    except:
        pass
    
    collection = client.get_or_create_collection(
        name=collection_name,
        metadata={
            "description": "Code repository chunks",
            "hnsw:space": "cosine"  # Use cosine similarity
        }
    )
    
    # Check if already indexed
    if collection.count() > 0 and not force_reindex:
        if verbose:
            print(f"Repository already indexed with {collection.count()} chunks.")
        return collection
    
    # Get all Python files
    if verbose:
        print(f"Finding Python files in {repo_path}...")
    py_files = list_python_files(repo_path)
    if verbose:
        print(f"Found {len(py_files)} Python files.")
    
    # Extract and index chunks
    all_chunks = []
    for i, file_path in enumerate(py_files):
        if verbose and i % 10 == 0:
            print(f"Processing file {i+1}/{len(py_files)}...")
        
        chunks = extract_code_chunks(file_path)
        all_chunks.extend(chunks)
    
    if verbose:
        print(f"Extracted {len(all_chunks)} code chunks.")
    
    if not all_chunks:
        print("No code chunks found!")
        return collection
    
    # Generate embeddings in batches
    if verbose:
        print("Generating embeddings...")
    batch_size = 32
    indexed_count = 0
    
    for i in range(0, len(all_chunks), batch_size):
        batch = all_chunks[i:i+batch_size]
        texts = [create_searchable_text(chunk) for chunk in batch]
        
        # Generate embeddings
        embeddings = model.encode(texts, show_progress_bar=False)
        
        # Prepare unique IDs
        ids = [f"{indexed_count + j}:{chunk['file_path']}:{chunk['name']}:{chunk['start_line']}" 
               for j, chunk in enumerate(batch)]
        
        metadatas = [{
            'type': chunk['type'],
            'name': chunk['name'],
            'file_path': chunk['file_path'],
            'start_line': chunk['start_line'],
            'end_line': chunk['end_line'],
            'docstring': chunk['docstring'][:500] if chunk['docstring'] else "",
        } for chunk in batch]
        
        documents = [chunk['code'] for chunk in batch]
        
        # Add to collection
        collection.add(
            ids=ids,
            embeddings=embeddings.tolist(),
            metadatas=metadatas,
            documents=documents
        )
        
        indexed_count += len(batch)
        
        if verbose and (indexed_count % 100 == 0 or indexed_count == len(all_chunks)):
            print(f"Indexed {indexed_count}/{len(all_chunks)} chunks...")
    
    if verbose:
        print(f"✓ Indexing complete! Total chunks: {collection.count()}")
    return collection


def search_code(
    query: str,
    top_k: int = 5,
    apply_filter: bool = False,
    db_path: str = "../data/chroma_db",
    collection_name: str = "flask_code"
) -> List[Dict]:
    """Search for code chunks matching the query."""
    
    model = get_embedding_model()
    
    # Connect to ChromaDB
    client = chromadb.PersistentClient(path=db_path)
    
    try:
        collection = client.get_collection(name=collection_name)
    except:
        print("Collection not found. Please index the repository first.")
        return []
    
    # Generate query embedding
    query_embedding = model.encode([query])[0]
    
    # Retrieve more results if filtering
    retrieve_count = top_k * 3 if apply_filter else top_k
    
    # Search
    results = collection.query(
        query_embeddings=[query_embedding.tolist()],
        n_results=retrieve_count,
        include=['metadatas', 'documents', 'distances']
    )
    
    # Format results
    formatted_results = []
    if results['ids'] and results['ids'][0]:
        for i in range(len(results['ids'][0])):
            distance = results['distances'][0][i]
            similarity = 1 - distance  # Cosine similarity from cosine distance
            
            formatted_results.append({
                'id': results['ids'][0][i],
                'type': results['metadatas'][0][i]['type'],
                'name': results['metadatas'][0][i]['name'],
                'file_path': results['metadatas'][0][i]['file_path'],
                'start_line': results['metadatas'][0][i]['start_line'],
                'end_line': results['metadatas'][0][i]['end_line'],
                'docstring': results['metadatas'][0][i]['docstring'],
                'code': results['documents'][0][i],
                'distance': distance,
                'similarity': similarity
            })
    
    # Apply keyword filtering if requested
    if apply_filter and formatted_results:
        formatted_results = filter_results_by_keywords(formatted_results, query)
        formatted_results = formatted_results[:top_k]
    
    return formatted_results


def filter_results_by_keywords(results: List[Dict], query: str) -> List[Dict]:
    """Filter and re-rank results by keyword presence."""
    keywords = set(query.lower().split())
    stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'how', 'does', 'do'}
    keywords = keywords - stop_words
    
    scored_results = []
    for result in results:
        search_text = f"{result['name']} {result.get('docstring', '')} {result['code']}".lower()
        
        keyword_score = sum(1 for keyword in keywords if keyword in search_text)
        name_score = sum(2 for keyword in keywords if keyword in result['name'].lower())
        doc_score = sum(1.5 for keyword in keywords if keyword in result.get('docstring', '').lower())
        
        total_score = keyword_score + name_score + doc_score
        combined_score = result['similarity'] * 0.6 + (total_score / max(len(keywords), 1)) * 0.4
        
        scored_results.append((combined_score, result))
    
    scored_results.sort(key=lambda x: x[0], reverse=True)
    filtered = [result for score, result in scored_results if score > 0]
    
    return filtered if filtered else [result for _, result in scored_results]


def get_collection_stats(db_path: str, collection_name: str) -> Dict:
    """Get statistics for an indexed collection."""
    client = chromadb.PersistentClient(path=db_path)
    
    try:
        collection = client.get_collection(name=collection_name)
        return {
            'count': collection.count(),
            'distance_metric': collection.metadata.get('hnsw:space', 'unknown'),
            'sample_metadata': None
        }
    except Exception as e:
        raise Exception(f"Collection not found: {e}")
