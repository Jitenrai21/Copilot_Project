#!/usr/bin/env python3
"""
Code Search Backend v2 - API-based HyDE and RAG

Modular backend for semantic code search with API-based LLM integration.
Supports HyDE (Hypothetical Document Embeddings) and RAG (Retrieval-Augmented Generation).
"""

import os
import time
import re
from typing import List, Dict, Optional, Tuple
from pathlib import Path

import chromadb
from sentence_transformers import SentenceTransformer
from tree_sitter_languages import get_parser
import requests


class CodeSearchBackend:
    """Backend for API-based code search with HyDE and RAG."""
    
    def __init__(
        self,
        api_key: str,
        api_url: str = "https://api.groq.com/openai/v1/chat/completions",
        model_name: str = "llama-3.3-70b-versatile",
        embedding_model: str = "jinaai/jina-embeddings-v2-base-code",
        db_path: str = "./data/chroma_db_api",
        collection_name: str = "code_collection"
    ):
        """
        Initialize the code search backend.
        
        Args:
            api_key: LLM API key
            api_url: LLM API endpoint URL
            model_name: LLM model name
            embedding_model: Local embedding model name
            db_path: Path to ChromaDB storage
            collection_name: ChromaDB collection name
        """
        self.api_key = api_key
        self.api_url = api_url
        self.model_name = model_name
        self.db_path = db_path
        self.collection_name = collection_name
        
        # Initialize tree-sitter parser
        self.parser = get_parser("python")
        
        # Load local embedding model
        print(f"Loading local embedding model: {embedding_model}...")
        self.embedding_model = SentenceTransformer(embedding_model, trust_remote_code=True)
        print("✓ Embedding model loaded")
    
    def call_llm_api(
        self,
        prompt: str,
        temperature: float = 0.3,
        timeout: int = 60,
        max_retries: int = 3,
        max_tokens: int = 500
    ) -> Optional[str]:
        """
        Send a prompt to the LLM API and return the generated response.
        
        Args:
            prompt: The input prompt for the LLM
            temperature: Sampling temperature
            timeout: Request timeout in seconds
            max_retries: Maximum number of retry attempts
            max_tokens: Maximum tokens in response
        
        Returns:
            The generated text response, or None if the request fails
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": "You are a helpful code analysis assistant."},
                {"role": "user", "content": prompt}
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stop": None
        }
        
        for attempt in range(max_retries):
            try:
                response = requests.post(self.api_url, json=payload, headers=headers, timeout=timeout)
                response.raise_for_status()
                
                result = response.json()
                
                if 'choices' in result and len(result['choices']) > 0:
                    return result['choices'][0]['message']['content'].strip()
                else:
                    print(f"  Unexpected API response format")
                    return None
                    
            except requests.exceptions.Timeout:
                print(f"⏱  LLM request timed out (attempt {attempt + 1}/{max_retries})")
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    time.sleep(wait_time)
                else:
                    return None
                    
            except requests.exceptions.HTTPError as e:
                status_code = e.response.status_code
                
                if status_code == 429:
                    print(f" Rate limit hit (attempt {attempt + 1}/{max_retries})")
                    if attempt < max_retries - 1:
                        wait_time = 5 * (attempt + 1)
                        time.sleep(wait_time)
                    else:
                        return None
                elif status_code == 401:
                    print(f" Authentication failed: Invalid API key")
                    return None
                else:
                    print(f" HTTP error {status_code}: {e}")
                    if attempt < max_retries - 1:
                        wait_time = 2 ** attempt
                        time.sleep(wait_time)
                    else:
                        return None
                        
            except requests.exceptions.RequestException as e:
                print(f" Request failed: {e}")
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    time.sleep(wait_time)
                else:
                    return None
        
        return None
    
    def extract_code_chunks(self, file_path: str) -> List[Dict]:
        """Extract functions and classes from a Python file using tree-sitter."""
        chunks = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                code = f.read()
            
            tree = self.parser.parse(bytes(code, "utf8"))
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
    
    def index_repository(
        self,
        repo_path: str,
        force_reindex: bool = False,
        verbose: bool = True
    ) -> chromadb.Collection:
        """
        Index a Python repository for semantic search.
        
        Args:
            repo_path: Path to the repository
            force_reindex: Force reindexing even if collection exists
            verbose: Print progress information
        
        Returns:
            ChromaDB collection object
        """
        client = chromadb.PersistentClient(path=self.db_path)
        
        # Check if collection exists
        try:
            collection = client.get_collection(name=self.collection_name)
            if not force_reindex:
                count = collection.count()
                if verbose:
                    print(f"✓ Collection '{self.collection_name}' already exists with {count} chunks")
                return collection
            else:
                if verbose:
                    print(f" Deleting existing collection for reindexing...")
                client.delete_collection(name=self.collection_name)
        except:
            pass
        
        # Create new collection
        collection = client.create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"}
        )
        
        if verbose:
            print(f" Indexing repository: {repo_path}")
        
        # Find all Python files
        python_files = []
        for root, dirs, files in os.walk(repo_path):
            # Skip common non-code directories
            dirs[:] = [d for d in dirs if d not in {'.git', '__pycache__', 'venv', 'env', 'node_modules', '.venv'}]
            
            for file in files:
                if file.endswith('.py'):
                    python_files.append(os.path.join(root, file))
        
        if verbose:
            print(f" Found {len(python_files)} Python files")
        
        # Extract and index code chunks
        total_chunks = 0
        for i, file_path in enumerate(python_files, 1):
            chunks = self.extract_code_chunks(file_path)
            
            if chunks:
                # Prepare data for batch insertion
                ids = [f"{file_path}:{chunk['name']}:{chunk['start_line']}" for chunk in chunks]
                documents = [chunk['code'] for chunk in chunks]
                metadatas = [{
                    'type': chunk['type'],
                    'name': chunk['name'],
                    'file_path': chunk['file_path'],
                    'start_line': chunk['start_line'],
                    'end_line': chunk['end_line'],
                    'docstring': chunk['docstring']
                } for chunk in chunks]
                
                # Generate embeddings locally
                embeddings = self.embedding_model.encode(documents).tolist()
                
                # Add to collection
                collection.add(
                    ids=ids,
                    documents=documents,
                    metadatas=metadatas,
                    embeddings=embeddings
                )
                
                total_chunks += len(chunks)
            
            if verbose and i % 50 == 0:
                print(f"  Processed {i}/{len(python_files)} files, {total_chunks} chunks indexed")
        
        if verbose:
            print(f"✓ Indexing complete: {total_chunks} chunks from {len(python_files)} files")
        
        return collection
    
    def direct_search(self, query: str, top_k: int = 5) -> List[Dict]:
        """
        Direct semantic search using query embedding.
        
        Args:
            query: User's search query
            top_k: Number of results to return
        
        Returns:
            List of relevant code chunks
        """
        # Embed the query locally
        query_embedding = self.embedding_model.encode([query])[0]
        
        # Search ChromaDB
        client = chromadb.PersistentClient(path=self.db_path)
        
        try:
            collection = client.get_collection(name=self.collection_name)
        except:
            print(f" Collection '{self.collection_name}' not found. Please index the repository first.")
            return []
        
        results = collection.query(
            query_embeddings=[query_embedding.tolist()],
            n_results=top_k,
            include=['metadatas', 'documents', 'distances']
        )
        
        # Format results
        formatted_results = []
        if results['ids'] and results['ids'][0]:
            for i in range(len(results['ids'][0])):
                distance = results['distances'][0][i]
                similarity = 1 - distance
                
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
                    'similarity': similarity,
                    'method': 'Direct'
                })
        
        return formatted_results
    
    def hyde_code_search(self, query: str, top_k: int = 5) -> List[Dict]:
        """
        HyDE-based code search:
        1. Generate hypothetical code via LLM API
        2. Embed the hypothetical code locally
        3. Search for similar code chunks
        
        Args:
            query: User's code search query
            top_k: Number of results to return
        
        Returns:
            List of relevant code chunks
        """
        print(f" HyDE Code Search: '{query}'")
        
        # Step 1: Generate hypothetical code via API
        print("  → Generating hypothetical code via API...")
        hyde_prompt = f"""Generate a Python code snippet that would answer this query: "{query}"

Requirements:
- Write only valid Python code (no explanations)
- Include function/class signatures with docstrings
- Keep it concise (5-15 lines)
- Focus on the core implementation

Code:"""
        
        hypothetical_code = self.call_llm_api(hyde_prompt, temperature=0.3, max_tokens=300)
        
        if not hypothetical_code:
            print("  Failed to generate hypothetical code, falling back to direct search")
            return self.direct_search(query, top_k)
        
        print(f"  ✓ Generated {len(hypothetical_code)} characters of hypothetical code")
        
        # Step 2: Embed the hypothetical code locally
        print("  → Embedding hypothetical code locally...")
        hypothetical_embedding = self.embedding_model.encode([hypothetical_code])[0]
        
        # Step 3: Search for similar code chunks
        print("  → Searching for similar code...")
        client = chromadb.PersistentClient(path=self.db_path)
        
        try:
            collection = client.get_collection(name=self.collection_name)
        except:
            print(f" Collection '{self.collection_name}' not found. Please index the repository first.")
            return []
        
        results = collection.query(
            query_embeddings=[hypothetical_embedding.tolist()],
            n_results=top_k,
            include=['metadatas', 'documents', 'distances']
        )
        
        # Format results
        formatted_results = []
        if results['ids'] and results['ids'][0]:
            for i in range(len(results['ids'][0])):
                distance = results['distances'][0][i]
                similarity = 1 - distance
                
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
                    'similarity': similarity,
                    'method': 'HyDE'
                })
        
        print(f"  ✓ Found {len(formatted_results)} results\n")
        return formatted_results
    
    def rag_topic_query(
        self,
        query: str,
        top_k: int = 5,
        context_chunks: int = 3
    ) -> Dict:
        """
        RAG-based topic query:
        1. Retrieve relevant code/doc chunks
        2. Augment the query with retrieved context
        3. Generate explanation via LLM API
        
        Args:
            query: User's topic query
            top_k: Number of chunks to retrieve
            context_chunks: Number of chunks to use in LLM context
        
        Returns:
            Dict with generated answer and supporting code chunks
        """
        print(f" RAG Topic Query: '{query}'")
        
        # Step 1: Retrieve relevant chunks using direct semantic search
        print("  → Retrieving relevant code chunks...")
        retrieved_chunks = self.direct_search(query, top_k)
        
        if not retrieved_chunks:
            return {
                'query': query,
                'answer': "No relevant code chunks found in the repository.",
                'sources': []
            }
        
        print(f"  ✓ Retrieved {len(retrieved_chunks)} chunks")
        
        # Step 2: Build context from top chunks
        print("  → Building context for LLM...")
        context_parts = []
        for i, chunk in enumerate(retrieved_chunks[:context_chunks], 1):
            context_parts.append(f"### Source {i}: {chunk['file_path']} - {chunk['name']}")
            if chunk['docstring']:
                context_parts.append(f"Docstring: {chunk['docstring']}")
            context_parts.append(f"```python\n{chunk['code']}\n```")
        
        context = "\n\n".join(context_parts)
        
        # Step 3: Generate explanation via LLM API
        print("  → Generating explanation via API...")
        rag_prompt = f"""Based on the following code snippets from a repository, answer the user's question.

Context:
{context}

User Question: {query}

Provide a clear, concise answer based on the code above. Reference specific functions or classes when relevant."""
        
        answer = self.call_llm_api(rag_prompt, temperature=0.5, max_tokens=800, timeout=90)
        
        if not answer:
            answer = "Failed to generate explanation via API."
        
        print(f"  ✓ Generated explanation\n")
        
        return {
            'query': query,
            'answer': answer,
            'sources': retrieved_chunks
        }
    
    def get_collection_stats(self) -> Dict:
        """Get statistics about the indexed collection."""
        try:
            client = chromadb.PersistentClient(path=self.db_path)
            collection = client.get_collection(name=self.collection_name)
            
            return {
                'count': collection.count(),
                'name': self.collection_name,
                'path': self.db_path
            }
        except Exception as e:
            return {
                'error': str(e),
                'count': 0
            }


def load_api_key_from_env() -> Optional[str]:
    """
    Load API key from environment variable or .env file.
    
    Returns:
        API key string or None if not found
    """
    # Try environment variable first
    api_key = os.environ.get('LLM_API_KEY')
    if api_key:
        return api_key
    
    # Try .env file
    try:
        from dotenv import load_dotenv
        load_dotenv()
        api_key = os.environ.get('LLM_API_KEY')
        if api_key:
            return api_key
    except ImportError:
        pass
    
    return None
