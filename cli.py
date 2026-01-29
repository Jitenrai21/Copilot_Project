#!/usr/bin/env python3
"""
DevCopilot CLI - Semantic Code Search and PR Summarization

A command-line interface for offline code search and PR analysis.
"""

import os
import sys
from pathlib import Path
from typing import Optional, List

import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.markdown import Markdown
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.syntax import Syntax

# Add src directory to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

# Import backend functions
from code_search_backend import (
    index_repository,
    search_code,
    get_collection_stats
)
from pr_summary_backend import (
    summarize_pr,
    list_failed_files,
    summarize_failed_file,
    regenerate_overall_summary,
    export_summary_to_markdown
)

# Initialize Typer app and Rich console
app = typer.Typer(
    name="devcopilot",
    help="Offline semantic code search and PR summarization",
    add_completion=False
)
console = Console()

# Configuration defaults
DEFAULT_REPO_PATH = "./flask"
DEFAULT_CHROMA_PATH = "./data/chroma_db"
DEFAULT_COLLECTION = "flask_code"


@app.command()
def index(
    repo_path: str = typer.Option(
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
        help="Collection name"
    ),
    verbose: bool = typer.Option(
        True,
        "--verbose/--quiet", "-v/-q",
        help="Show detailed progress"
    )
):
    """
    Index a repository for semantic code search.
    
    Extracts functions and classes, generates embeddings, and stores in ChromaDB.
    
    Examples:
        devcopilot index --repo ../flask
        devcopilot index --force --verbose
    """
    console.print(Panel.fit(
        "[bold blue]Code Indexing Pipeline[/bold blue]",
        border_style="blue"
    ))
    
    # Validate repository path
    if not os.path.exists(repo_path):
        console.print(f"[bold red]Error:[/bold red] Repository path not found: {repo_path}")
        raise typer.Exit(code=1)
    
    try:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
            transient=True
        ) as progress:
            task = progress.add_task("Indexing repository...", total=None)
            
            collection_obj = index_repository(
                repo_path=repo_path,
                db_path=db_path,
                collection_name=collection,
                force_reindex=force,
                verbose=verbose
            )
            
            progress.update(task, completed=True)
        
        # Display stats
        stats = get_collection_stats(db_path, collection)
        
        table = Table(title="Indexing Complete", show_header=False)
        table.add_column("Metric", style="cyan")
        table.add_column("Value", style="green")
        
        table.add_row("Repository", repo_path)
        table.add_row("Total Chunks", str(stats['count']))
        table.add_row("Collection", collection)
        table.add_row("Database", db_path)
        table.add_row("Distance Metric", stats.get('distance_metric', 'cosine'))
        
        console.print(table)
        console.print("[bold green]✓[/bold green] Indexing successful!")
        
    except Exception as e:
        console.print(f"[bold red]Error during indexing:[/bold red] {str(e)}")
        raise typer.Exit(code=1)


@app.command()
def search(
    query: str = typer.Argument(..., help="Natural language search query"),
    top_k: int = typer.Option(
        5,
        "--top-k", "-k",
        help="Number of results to return"
    ),
    filter_keywords: bool = typer.Option(
        False,
        "--filter/--no-filter",
        help="Apply keyword-based post-filtering"
    ),
    db_path: str = typer.Option(
        DEFAULT_CHROMA_PATH,
        "--db",
        help="Path to ChromaDB storage"
    ),
    collection: str = typer.Option(
        DEFAULT_COLLECTION,
        "--collection", "-c",
        help="Collection name"
    ),
    show_code: bool = typer.Option(
        True,
        "--show-code/--no-code",
        help="Show code preview in results"
    )
):
    """
    Search code using natural language queries.
    
    Uses semantic similarity to find relevant functions and classes.
    
    Examples:
        devcopilot search "how does Flask handle routing"
        devcopilot search "error handling" --top-k 10 --filter
    """
    console.print(Panel.fit(
        f"[bold blue]Searching:[/bold blue] {query}",
        border_style="blue"
    ))
    
    try:
        results = search_code(
            query=query,
            top_k=top_k,
            apply_filter=filter_keywords,
            db_path=db_path,
            collection_name=collection
        )
        
        if not results:
            console.print("[yellow]No results found.[/yellow]")
            return
        
        console.print(f"\n[bold green]Found {len(results)} results:[/bold green]\n")
        
        for i, result in enumerate(results, 1):
            # Create result panel
            header = f"{i}. {result['type'].upper()}: [bold]{result['name']}[/bold]"
            
            content_lines = []
            content_lines.append(f"📄 [cyan]{result['file_path']}[/cyan]:[dim]{result['start_line']}-{result['end_line']}[/dim]")
            content_lines.append(f"📊 Similarity: [green]{result['similarity']:.4f}[/green] (distance: {result['distance']:.4f})")
            
            if result.get('docstring'):
                doc_preview = result['docstring'][:200].replace('\n', ' ')
                content_lines.append(f"\n📝 [italic]{doc_preview}{'...' if len(result['docstring']) > 200 else ''}[/italic]")
            
            if show_code:
                content_lines.append("\n[bold]Code Preview:[/bold]")
                code_lines = result['code'].split('\n')[:10]
                code_preview = '\n'.join(code_lines)
                
                syntax = Syntax(
                    code_preview,
                    "python",
                    theme="monokai",
                    line_numbers=True,
                    start_line=result['start_line']
                )
                
                console.print(Panel(
                    '\n'.join(content_lines),
                    title=header,
                    border_style="blue"
                ))
                console.print(syntax)
                console.print()
            else:
                console.print(Panel(
                    '\n'.join(content_lines),
                    title=header,
                    border_style="blue"
                ))
        
    except Exception as e:
        console.print(f"[bold red]Error during search:[/bold red] {str(e)}")
        raise typer.Exit(code=1)


@app.command()
def summarize(
    repo_path: str = typer.Option(
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
    timeout: int = typer.Option(
        200,
        "--timeout", "-t",
        help="LLM request timeout in seconds"
    ),
    retry_failed: bool = typer.Option(
        False,
        "--retry-failed",
        help="Interactively retry failed files"
    ),
    verbose: bool = typer.Option(
        True,
        "--verbose/--quiet", "-v/-q",
        help="Show detailed progress"
    )
):
    """
    Summarize a pull request using atomic change detection and LLM.
    
    Analyzes git diffs, generates file-level summaries, and produces an overall PR summary.
    
    Examples:
        devcopilot summarize --repo ../flask
        devcopilot summarize --output pr_summary.md --max-files 20
        devcopilot summarize --retry-failed --timeout 600
    """
    console.print(Panel.fit(
        "[bold blue]PR Summarization Pipeline[/bold blue]",
        border_style="blue"
    ))
    
    # Validate repository path
    if not os.path.exists(repo_path):
        console.print(f"[bold red]Error:[/bold red] Repository path not found: {repo_path}")
        raise typer.Exit(code=1)
    
    try:
        # Run summarization
        result = summarize_pr(
            repo_path=repo_path,
            base_branch=base_branch,
            current_branch=current_branch,
            max_files_to_summarize=max_files,
            llm_timeout=timeout,
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
        
        # Successful summaries
        failed_files = result.get('failed_files', [])
        successful_files = [f for f in result['file_summaries'].keys() if f not in failed_files]
        
        if successful_files:
            console.print("\n" + "=" * 80)
            console.print(f"[bold green]✓ Successfully Summarized Files ({len(successful_files)}):[/bold green]")
            console.print("=" * 80 + "\n")
            
            for file_path in successful_files:
                summary = result['file_summaries'][file_path]
                
                panel_content = []
                
                # Validation metrics
                if 'file_metrics' in result and file_path in result['file_metrics']:
                    metrics = result['file_metrics'][file_path]
                    panel_content.append(
                        f"📊 {metrics['mentioned_changes']}/{metrics['total_changes']} changes covered "
                        f"({metrics['coverage_percent']:.1f}%)"
                    )
                
                panel_content.append(f"\n{summary}")
                
                console.print(Panel(
                    '\n'.join(panel_content),
                    title=f"🔹 {file_path}",
                    border_style="green"
                ))
        
        # Failed files
        if failed_files:
            console.print("\n" + "=" * 80)
            console.print(f"[bold yellow]⚠️  Failed to Summarize ({len(failed_files)}):[/bold yellow]")
            console.print("=" * 80 + "\n")
            
            for file_path in failed_files:
                console.print(Panel(
                    result['file_summaries'].get(file_path, 'No placeholder found'),
                    title=f"❌ {file_path}",
                    border_style="yellow"
                ))
            
            console.print("\n[dim]💡 Use --retry-failed to retry with longer timeout[/dim]")
        
        # Validation summary
        if 'file_metrics' in result and result['file_metrics']:
            console.print("\n" + "=" * 80)
            console.print("[bold]📊 Validation Summary:[/bold]")
            console.print("=" * 80)
            
            total_changes = sum(m['total_changes'] for m in result['file_metrics'].values())
            total_mentioned = sum(m['mentioned_changes'] for m in result['file_metrics'].values())
            avg_coverage = sum(m['coverage_percent'] for m in result['file_metrics'].values()) / len(result['file_metrics'])
            
            console.print(f"  Total atomic changes tracked: [cyan]{total_changes}[/cyan]")
            console.print(f"  Changes mentioned in summaries: [green]{total_mentioned}[/green]")
            console.print(f"  Average coverage: [green]{avg_coverage:.1f}%[/green]")
        
        # Overall summary
        console.print("\n" + "=" * 80)
        console.print("[bold]📝 Overall PR Summary:[/bold]")
        console.print("=" * 80)
        console.print(f"\n{result['overall_summary']}\n")
        console.print("=" * 80)
        
        # Export to markdown
        if output:
            export_summary_to_markdown(result, output_path=output)
            console.print(f"\n[green]✓[/green] Summary exported to [cyan]{output}[/cyan]")
        
        # Retry failed files if requested
        if retry_failed and failed_files:
            console.print("\n[bold yellow]Retry Failed Files[/bold yellow]")
            list_failed_files(result)
            
            for file_path in failed_files:
                retry = typer.confirm(f"\nRetry {file_path}?", default=False)
                if retry:
                    longer_timeout = typer.prompt(
                        "Timeout (seconds)",
                        type=int,
                        default=600
                    )
                    
                    console.print(f"[cyan]Retrying with timeout={longer_timeout}s...[/cyan]")
                    result = summarize_failed_file(
                        result,
                        file_path,
                        timeout=longer_timeout,
                        verbose=True
                    )
            
            # Regenerate overall summary if any retries succeeded
            if len(result.get('failed_files', [])) < len(failed_files):
                console.print("\n[cyan]Regenerating overall summary...[/cyan]")
                result = regenerate_overall_summary(result, llm_timeout=timeout, verbose=True)
                
                console.print("\n[bold]📝 Updated Overall PR Summary:[/bold]")
                console.print(result['overall_summary'])
                
                # Re-export if output was specified
                if output:
                    export_summary_to_markdown(result, output_path=output)
                    console.print(f"\n[green]✓[/green] Summary re-exported to [cyan]{output}[/cyan]")
        
    except Exception as e:
        console.print(f"[bold red]Error during summarization:[/bold red] {str(e)}")
        import traceback
        console.print(traceback.format_exc())
        raise typer.Exit(code=1)


@app.command()
def stats(
    db_path: str = typer.Option(
        DEFAULT_CHROMA_PATH,
        "--db",
        help="Path to ChromaDB storage"
    ),
    collection: str = typer.Option(
        DEFAULT_COLLECTION,
        "--collection", "-c",
        help="Collection name"
    )
):
    """
    Show statistics for indexed collection.
    
    Examples:
        devcopilot stats
        devcopilot stats --collection my_code
    """
    try:
        stats = get_collection_stats(db_path, collection)
        
        table = Table(title=f"Collection: {collection}", show_header=False)
        table.add_column("Metric", style="cyan")
        table.add_column("Value", style="green")
        
        table.add_row("Total Chunks", str(stats['count']))
        table.add_row("Distance Metric", stats.get('distance_metric', 'unknown'))
        table.add_row("Database Path", db_path)
        
        if stats.get('sample_metadata'):
            table.add_row("Sample Entry", str(stats['sample_metadata']))
        
        console.print(table)
        
    except Exception as e:
        console.print(f"[bold red]Error:[/bold red] {str(e)}")
        raise typer.Exit(code=1)


@app.command()
def version():
    """Show version information."""
    console.print(Panel.fit(
        "[bold blue]DevCopilot v1.0[/bold blue]\n"
        "Offline semantic code search and PR summarization\n"
        "[dim]Built with Typer, Rich, ChromaDB, and Ollama[/dim]",
        border_style="blue"
    ))


if __name__ == "__main__":
    app()
