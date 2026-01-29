#!/usr/bin/env python3
"""
DevCopilot CLI v2 - Mode-Based Code Search and PR Summarization

Enhanced CLI with explicit mode selection for HyDE, RAG, and PR summarization.
Designed for future VS Code extension integration.

Usage:
    cli_v2.py --mode hyde --query "error handling code" --repo ./flask
    cli_v2.py --mode rag --query "How does Flask handle routing?" --repo ./flask
    cli_v2.py --mode pr-summary --repo ./flask --output summary.md
"""

import os
import sys
import getpass
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.markdown import Markdown
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.syntax import Syntax

# Add src directory to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

# Import backend modules
from src.code_search_backend_v2 import CodeSearchBackend, load_api_key_from_env
from src.pr_summary_backend_v2 import PRSummaryBackend

# Initialize Typer app and Rich console
app = typer.Typer(
    name="devcopilot-v2",
    help="Mode-based code search (HyDE/RAG) and PR summarization with API-based LLM",
    add_completion=False
)
console = Console()

# Configuration defaults
DEFAULT_REPO_PATH = "./flask"
DEFAULT_CHROMA_PATH = "./data/chroma_db"
DEFAULT_COLLECTION = "flask_code"
DEFAULT_API_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "llama-3.3-70b-versatile"


def get_api_key() -> str:
    """
    Get API key from environment, .env file, or user input.
    
    Returns:
        API key string
    
    Raises:
        typer.Exit if API key cannot be obtained
    """
    # Try to load from environment
    api_key = load_api_key_from_env()
    
    if api_key:
        console.print("✓ API key loaded from environment")
        return api_key
    
    # Prompt user for API key
    console.print("[yellow]API key not found in environment.[/yellow]")
    console.print("Set LLM_API_KEY environment variable or create a .env file.")
    
    api_key = getpass.getpass("Enter your LLM API key: ")
    
    if not api_key or api_key.strip() == "":
        console.print("[bold red]Error:[/bold red] API key is required")
        raise typer.Exit(code=1)
    
    return api_key.strip()


@app.command()
def search(
    mode: str = typer.Option(
        ...,
        "--mode", "-m",
        help="Search mode: 'hyde' for code search, 'rag' for topic queries"
    ),
    query: str = typer.Option(
        ...,
        "--query", "-q",
        help="Natural language search query"
    ),
    repo: str = typer.Option(
        DEFAULT_REPO_PATH,
        "--repo", "-r",
        help="Path to the repository"
    ),
    top_k: int = typer.Option(
        5,
        "--top-k", "-k",
        help="Number of results to return"
    ),
    db_path: str = typer.Option(
        DEFAULT_CHROMA_PATH,
        "--db",
        help="Path to ChromaDB storage"
    ),
    collection: str = typer.Option(
        DEFAULT_COLLECTION,
        "--collection", "-c",
        help="ChromaDB collection name"
    ),
    api_url: str = typer.Option(
        DEFAULT_API_URL,
        "--api-url",
        help="LLM API endpoint URL"
    ),
    model: str = typer.Option(
        DEFAULT_MODEL,
        "--model",
        help="LLM model name"
    ),
    api_key: Optional[str] = typer.Option(
        None,
        "--api-key",
        help="LLM API key (or use LLM_API_KEY env var)"
    ),
    index_first: bool = typer.Option(
        False,
        "--index",
        help="Index the repository before searching"
    ),
    show_code: bool = typer.Option(
        True,
        "--show-code/--no-code",
        help="Show code preview in results"
    ),
    verbose: bool = typer.Option(
        True,
        "--verbose/--quiet", "-v/-q",
        help="Show detailed progress"
    )
):
    """
    Search code using HyDE or RAG modes.
    
    **Mode: hyde** - Hypothetical Document Embeddings for code search
    - Generates hypothetical code via API
    - Embeds it locally and searches for similar code
    - Best for: "Show me error handling code", "database connection functions"
    
    **Mode: rag** - Retrieval-Augmented Generation for topic queries
    - Retrieves relevant code chunks
    - Generates explanations via API with context
    - Best for: "How does Flask handle routing?", "What is the Blueprint class?"
    
    Examples:
        cli_v2.py search --mode hyde --query "error handling functions"
        cli_v2.py search --mode rag --query "How does Flask routing work?"
        cli_v2.py search --mode hyde --query "database connection" --top-k 10
    """
    # Validate mode
    mode = mode.lower()
    if mode not in ['hyde', 'rag']:
        console.print(f"[bold red]Error:[/bold red] Invalid mode '{mode}'. Choose 'hyde' or 'rag'.")
        raise typer.Exit(code=1)
    
    # Get API key
    if not api_key:
        api_key = get_api_key()
    
    console.print(Panel.fit(
        f"[bold blue]Code Search - {mode.upper()} Mode[/bold blue]\n"
        f"Query: {query}",
        border_style="blue"
    ))
    
    # Validate repository
    if not os.path.exists(repo):
        console.print(f"[bold red]Error:[/bold red] Repository path not found: {repo}")
        raise typer.Exit(code=1)
    
    try:
        # Initialize backend
        if verbose:
            console.print(f"Initializing backend...")
        
        backend = CodeSearchBackend(
            api_key=api_key,
            api_url=api_url,
            model_name=model,
            db_path=db_path,
            collection_name=collection
        )
        
        # Index repository if requested
        if index_first:
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                console=console,
                transient=True
            ) as progress:
                task = progress.add_task("Indexing repository...", total=None)
                backend.index_repository(repo, force_reindex=False, verbose=verbose)
                progress.update(task, completed=True)
        
        # Execute search based on mode
        if mode == 'hyde':
            console.print(f"\n[cyan]Executing HyDE search...[/cyan]\n")
            results = backend.hyde_code_search(query, top_k=top_k)
            
            # Display results
            if not results:
                console.print("[yellow]No results found.[/yellow]")
                return
            
            console.print(f"\n[bold green]Found {len(results)} results:[/bold green]\n")
            
            for i, result in enumerate(results, 1):
                header = f"{i}. {result['type'].upper()}: [bold]{result['name']}[/bold]"
                
                content_lines = []
                content_lines.append(f"📄 [cyan]{result['file_path']}[/cyan]:[dim]{result['start_line']}-{result['end_line']}[/dim]")
                content_lines.append(f"📊 Similarity: [green]{result['similarity']:.4f}[/green]")
                content_lines.append(f"🔍 Method: {result['method']}")
                
                if result.get('docstring'):
                    doc_preview = result['docstring'][:200].replace('\n', ' ')
                    content_lines.append(f"\n📝 [italic]{doc_preview}{'...' if len(result['docstring']) > 200 else ''}[/italic]")
                
                console.print(Panel('\n'.join(content_lines), title=header, border_style="blue"))
                
                if show_code:
                    code_lines = result['code'].split('\n')[:10]
                    code_preview = '\n'.join(code_lines)
                    
                    syntax = Syntax(
                        code_preview,
                        "python",
                        theme="monokai",
                        line_numbers=True,
                        start_line=result['start_line']
                    )
                    console.print(syntax)
                
                console.print()
        
        elif mode == 'rag':
            console.print(f"\n[cyan]Executing RAG query...[/cyan]\n")
            result = backend.rag_topic_query(query, top_k=top_k, context_chunks=3)
            
            # Display answer
            console.print(Panel(
                f"[bold green]Answer:[/bold green]\n\n{result['answer']}",
                title=f"💡 {query}",
                border_style="green"
            ))
            
            # Display sources
            console.print(f"\n[bold]Supporting Sources ({len(result['sources'])}):[/bold]\n")
            
            for i, source in enumerate(result['sources'][:5], 1):
                header = f"{i}. {source['type'].upper()}: [bold]{source['name']}[/bold]"
                
                content_lines = []
                content_lines.append(f"📄 [cyan]{source['file_path']}[/cyan]:[dim]{source['start_line']}-{source['end_line']}[/dim]")
                content_lines.append(f"📊 Similarity: [green]{source['similarity']:.4f}[/green]")
                
                if source.get('docstring'):
                    content_lines.append(f"\n📝 [italic]{source['docstring'][:150]}...[/italic]")
                
                console.print(Panel('\n'.join(content_lines), title=header, border_style="cyan"))
                
                if show_code:
                    code_preview = '\n'.join(source['code'].split('\n')[:6])
                    syntax = Syntax(code_preview, "python", theme="monokai", line_numbers=True)
                    console.print(syntax)
                
                console.print()
        
    except Exception as e:
        console.print(f"[bold red]Error during search:[/bold red] {str(e)}")
        import traceback
        if verbose:
            console.print(traceback.format_exc())
        raise typer.Exit(code=1)


@app.command()
def summarize(
    repo: str = typer.Option(
        DEFAULT_REPO_PATH,
        "--repo", "-r",
        help="Path to the git repository"
    ),
    base_branch: Optional[str] = typer.Option(
        None,
        "--base", "-b",
        help="Base branch (auto-detected if not provided)"
    ),
    current_branch: Optional[str] = typer.Option(
        None,
        "--current", "-c",
        help="Current branch (auto-detected if not provided)"
    ),
    max_files: int = typer.Option(
        10,
        "--max-files", "-m",
        help="Maximum number of files to summarize"
    ),
    output: Optional[str] = typer.Option(
        None,
        "--output", "-o",
        help="Export summary to markdown file"
    ),
    api_url: str = typer.Option(
        DEFAULT_API_URL,
        "--api-url",
        help="LLM API endpoint URL"
    ),
    model: str = typer.Option(
        DEFAULT_MODEL,
        "--model",
        help="LLM model name"
    ),
    api_key: Optional[str] = typer.Option(
        None,
        "--api-key",
        help="LLM API key (or use LLM_API_KEY env var)"
    ),
    timeout: int = typer.Option(
        200,
        "--timeout", "-t",
        help="LLM request timeout in seconds"
    ),
    verbose: bool = typer.Option(
        True,
        "--verbose/--quiet", "-v/-q",
        help="Show detailed progress"
    )
):
    """
    Summarize a pull request using atomic change detection and LLM.
    
    Analyzes git diffs, detects atomic changes, generates file-level summaries,
    and produces an overall PR summary.
    
    Examples:
        cli_v2.py summarize --repo ./flask
        cli_v2.py summarize --repo ./flask --output pr_summary.md --max-files 20
        cli_v2.py summarize --base main --current feature-branch --timeout 300
    """
    # Get API key
    if not api_key:
        api_key = get_api_key()
    
    console.print(Panel.fit(
        "[bold blue]PR Summarization[/bold blue]",
        border_style="blue"
    ))
    
    # Validate repository
    if not os.path.exists(repo):
        console.print(f"[bold red]Error:[/bold red] Repository path not found: {repo}")
        raise typer.Exit(code=1)
    
    try:
        # Initialize backend
        backend = PRSummaryBackend(
            api_key=api_key,
            api_url=api_url,
            model_name=model
        )
        
        # Run summarization
        result = backend.summarize_pr(
            repo_path=repo,
            base_branch=base_branch,
            current_branch=current_branch,
            max_files=max_files,
            timeout=timeout,
            verbose=verbose
        )
        
        # Display results
        console.print("\n" + "=" * 80)
        console.print("[bold green]PR SUMMARY[/bold green]")
        console.print("=" * 80 + "\n")
        
        console.print(f"[cyan]Branch:[/cyan] {result['current_branch']} → {result['base_branch']}")
        console.print(f"[cyan]Commits:[/cyan] {len(result['commits'])}")
        console.print(f"[cyan]Changed files:[/cyan] {len(result['changed_files'])}")
        
        # Recent commits
        console.print("\n[bold]Recent Commits:[/bold]")
        for commit in result['commits'][:5]:
            console.print(f"  • {commit}")
        if len(result['commits']) > 5:
            console.print(f"  ... and {len(result['commits']) - 5} more")
        
        # File summaries
        failed_files = result.get('failed_files', [])
        successful_files = [f for f in result['file_summaries'].keys() if f not in failed_files]
        
        if successful_files:
            console.print("\n" + "=" * 80)
            console.print(f"[bold green]✓ File Summaries ({len(successful_files)}):[/bold green]")
            console.print("=" * 80 + "\n")
            
            for file_path in successful_files:
                summary = result['file_summaries'][file_path]
                atomic_changes = result['file_atomic_changes'].get(file_path, [])
                
                panel_content = []
                panel_content.append(f"📊 Atomic changes: {len(atomic_changes)}")
                panel_content.append(f"\n{summary}")
                
                console.print(Panel(
                    '\n'.join(panel_content),
                    title=f"🔹 {file_path}",
                    border_style="green"
                ))
        
        # Failed files
        if failed_files:
            console.print("\n" + "=" * 80)
            console.print(f"[bold yellow]⚠️  Failed Files ({len(failed_files)}):[/bold yellow]")
            console.print("=" * 80 + "\n")
            
            for file_path in failed_files:
                console.print(f"  ❌ {file_path}")
        
        # Overall summary
        console.print("\n" + "=" * 80)
        console.print("[bold]📝 Overall PR Summary:[/bold]")
        console.print("=" * 80)
        console.print(f"\n{result['overall_summary']}\n")
        console.print("=" * 80)
        
        # Export to markdown
        if output:
            export_to_markdown(result, output)
            console.print(f"\n[green]✓[/green] Summary exported to [cyan]{output}[/cyan]")
        
    except Exception as e:
        console.print(f"[bold red]Error during summarization:[/bold red] {str(e)}")
        import traceback
        if verbose:
            console.print(traceback.format_exc())
        raise typer.Exit(code=1)


@app.command()
def index(
    repo: str = typer.Option(
        DEFAULT_REPO_PATH,
        "--repo", "-r",
        help="Path to the repository to index"
    ),
    force: bool = typer.Option(
        False,
        "--force", "-f",
        help="Force reindexing even if collection exists"
    ),
    db_path: str = typer.Option(
        DEFAULT_CHROMA_PATH,
        "--db",
        help="Path to ChromaDB storage"
    ),
    collection: str = typer.Option(
        DEFAULT_COLLECTION,
        "--collection", "-c",
        help="ChromaDB collection name"
    ),
    api_url: str = typer.Option(
        DEFAULT_API_URL,
        "--api-url",
        help="LLM API endpoint URL (not used for indexing, only embeddings)"
    ),
    model: str = typer.Option(
        DEFAULT_MODEL,
        "--model",
        help="LLM model name (not used for indexing, only embeddings)"
    ),
    api_key: Optional[str] = typer.Option(
        None,
        "--api-key",
        help="LLM API key (required for backend initialization)"
    ),
    verbose: bool = typer.Option(
        True,
        "--verbose/--quiet", "-v/-q",
        help="Show detailed progress"
    )
):
    """
    Index a repository for semantic code search.
    
    Extracts functions and classes, generates embeddings locally, and stores in ChromaDB.
    Note: Indexing uses local embeddings only; API key is for backend initialization.
    
    Examples:
        cli_v2.py index --repo ./flask
        cli_v2.py index --repo ./my-project --force --collection my_code
    """
    # Get API key (needed for backend initialization)
    if not api_key:
        api_key = get_api_key()
    
    console.print(Panel.fit(
        "[bold blue]Code Indexing[/bold blue]",
        border_style="blue"
    ))
    
    # Validate repository
    if not os.path.exists(repo):
        console.print(f"[bold red]Error:[/bold red] Repository path not found: {repo}")
        raise typer.Exit(code=1)
    
    try:
        # Initialize backend
        backend = CodeSearchBackend(
            api_key=api_key,
            api_url=api_url,
            model_name=model,
            db_path=db_path,
            collection_name=collection
        )
        
        # Index repository
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
            transient=True
        ) as progress:
            task = progress.add_task("Indexing repository...", total=None)
            
            collection_obj = backend.index_repository(
                repo_path=repo,
                force_reindex=force,
                verbose=verbose
            )
            
            progress.update(task, completed=True)
        
        # Display stats
        stats = backend.get_collection_stats()
        
        table = Table(title="Indexing Complete", show_header=False)
        table.add_column("Metric", style="cyan")
        table.add_column("Value", style="green")
        
        table.add_row("Repository", repo)
        table.add_row("Total Chunks", str(stats['count']))
        table.add_row("Collection", collection)
        table.add_row("Database", db_path)
        
        console.print(table)
        console.print("[bold green]✓[/bold green] Indexing successful!")
        
    except Exception as e:
        console.print(f"[bold red]Error during indexing:[/bold red] {str(e)}")
        import traceback
        if verbose:
            console.print(traceback.format_exc())
        raise typer.Exit(code=1)


def export_to_markdown(result: dict, output_path: str):
    """Export PR summary to markdown file."""
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(f"# Pull Request Summary\n\n")
        f.write(f"**Branch:** {result['current_branch']} → {result['base_branch']}\n\n")
        f.write(f"**Commits:** {len(result['commits'])}\n\n")
        f.write(f"**Changed Files:** {len(result['changed_files'])}\n\n")
        
        f.write("## Commit Messages\n\n")
        for commit in result['commits']:
            f.write(f"- {commit}\n")
        
        f.write("\n## File Summaries\n\n")
        for file_path, summary in result['file_summaries'].items():
            f.write(f"### {file_path}\n\n")
            f.write(f"{summary}\n\n")
        
        f.write("## Overall Summary\n\n")
        f.write(f"{result['overall_summary']}\n")


@app.command()
def version():
    """Show version information."""
    console.print(Panel.fit(
        "[bold blue]DevCopilot CLI v2[/bold blue]\n"
        "Mode-based code search (HyDE/RAG) and PR summarization\n"
        "[dim]Built with Typer, Rich, ChromaDB, and API-based LLM[/dim]",
        border_style="blue"
    ))


if __name__ == "__main__":
    app()
