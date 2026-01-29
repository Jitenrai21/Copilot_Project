"""
PR Summarization Backend - Extracted from pr_summary.ipynb

Provides PR summarization functionality using git diffs and LLM.
"""

import subprocess
import re
import requests
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass


# Ollama configuration
OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "codellama:7b-instruct"


@dataclass
class AtomicChange:
    """Represents a single atomic change in a diff."""
    change_type: str
    line_number: int
    old_line: Optional[int]
    new_line: Optional[int]
    old_content: Optional[str]
    new_content: Optional[str]
    context: str
    
    def __repr__(self):
        if self.change_type == 'addition':
            return f"Line {self.new_line}: + {self.new_content}"
        elif self.change_type == 'deletion':
            return f"Line {self.old_line}: - {self.old_content}"
        else:
            return f"Line {self.old_line}->{self.new_line}: {self.old_content} → {self.new_content}"


# Git utility functions
def get_current_branch(repo_path: str = ".") -> str:
    """Get the name of the current git branch."""
    result = subprocess.run(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        cwd=repo_path
    )
    return result.stdout.strip()


def get_base_branch(repo_path: str = ".", default: str = "main") -> str:
    """Get the base branch for comparison."""
    result = subprocess.run(
        ["git", "rev-parse", "--verify", "main"],
        capture_output=True,
        encoding="utf-8",
        cwd=repo_path
    )
    if result.returncode == 0:
        return "main"
    
    result = subprocess.run(
        ["git", "rev-parse", "--verify", "master"],
        capture_output=True,
        encoding="utf-8",
        cwd=repo_path
    )
    if result.returncode == 0:
        return "master"
    
    return default


def get_changed_files(base: str, current: str, repo_path: str = ".") -> List[str]:
    """List all files changed between two branches."""
    result = subprocess.run(
        ["git", "diff", "--name-only", f"{base}...{current}"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        cwd=repo_path
    )
    files = result.stdout.strip().splitlines()
    return [f for f in files if f]


def get_commit_messages(base: str, current: str, repo_path: str = ".") -> List[str]:
    """Get all commit messages between two branches."""
    result = subprocess.run(
        ["git", "log", f"{base}..{current}", "--pretty=format:%h - %s"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        cwd=repo_path
    )
    messages = result.stdout.strip().splitlines()
    return [m for m in messages if m]


def get_file_diff(base: str, current: str, file_path: str, repo_path: str = ".") -> str:
    """Get the diff for a specific file between two branches."""
    result = subprocess.run(
        ["git", "diff", f"{base}...{current}", "--", file_path],
        capture_output=True,
        text=True,
        encoding="utf-8",
        cwd=repo_path
    )
    return result.stdout


# Diff parsing functions
def parse_diff_hunks(diff: str) -> List[AtomicChange]:
    """Parse a git diff into atomic changes with line numbers and context."""
    changes = []
    lines = diff.splitlines()
    
    old_line_num = 0
    new_line_num = 0
    context_buffer = []
    
    for i, line in enumerate(lines):
        if line.startswith('@@'):
            match = re.match(r'@@ -(\d+),?\d* \+(\d+),?\d* @@', line)
            if match:
                old_line_num = int(match.group(1))
                new_line_num = int(match.group(2))
                context_buffer = []
            continue
        
        if line.startswith('diff --git') or line.startswith('index') or \
           line.startswith('---') or line.startswith('+++'):
            continue
        
        if line.startswith(' '):
            context_buffer.append(line[1:])
            if len(context_buffer) > 2:
                context_buffer.pop(0)
            old_line_num += 1
            new_line_num += 1
            
        elif line.startswith('+'):
            content = line[1:].strip()
            if content:
                context = '\n'.join(context_buffer[-2:]) if context_buffer else ""
                changes.append(AtomicChange(
                    change_type='addition',
                    line_number=new_line_num,
                    old_line=None,
                    new_line=new_line_num,
                    old_content=None,
                    new_content=content,
                    context=context
                ))
            new_line_num += 1
            
        elif line.startswith('-'):
            content = line[1:].strip()
            if content:
                context = '\n'.join(context_buffer[-2:]) if context_buffer else ""
                changes.append(AtomicChange(
                    change_type='deletion',
                    line_number=old_line_num,
                    old_line=old_line_num,
                    new_line=None,
                    old_content=content,
                    new_content=None,
                    context=context
                ))
            old_line_num += 1
    
    return changes


def detect_modifications(changes: List[AtomicChange]) -> List[AtomicChange]:
    """Post-process changes to detect modifications."""
    if not changes:
        return changes
    
    modified_changes = []
    i = 0
    
    while i < len(changes):
        current = changes[i]
        
        if (current.change_type == 'deletion' and 
            i + 1 < len(changes) and 
            changes[i + 1].change_type == 'addition' and
            abs(current.line_number - changes[i + 1].line_number) <= 2):
            
            next_change = changes[i + 1]
            
            modified_changes.append(AtomicChange(
                change_type='modification',
                line_number=current.line_number,
                old_line=current.old_line,
                new_line=next_change.new_line,
                old_content=current.old_content,
                new_content=next_change.new_content,
                context=current.context
            ))
            i += 2
        else:
            modified_changes.append(current)
            i += 1
    
    return modified_changes


def format_atomic_changes(changes: List[AtomicChange]) -> str:
    """Format atomic changes into a clear, enumerated list for LLM prompts."""
    if not changes:
        return "No atomic changes detected."
    
    formatted = []
    for idx, change in enumerate(changes, 1):
        if change.change_type == 'addition':
            formatted.append(f"{idx}. **Added** at line {change.new_line}: `{change.new_content}`")
        elif change.change_type == 'deletion':
            formatted.append(f"{idx}. **Removed** at line {change.old_line}: `{change.old_content}`")
        elif change.change_type == 'modification':
            formatted.append(
                f"{idx}. **Changed** at line {change.old_line}: "
                f"`{change.old_content}` → `{change.new_content}`"
            )
    
    return '\n'.join(formatted)


# Ollama integration
def call_ollama(prompt: str, model: str = MODEL_NAME, temperature: float = 0.3, timeout: int = 200) -> Optional[str]:
    """Send a prompt to the local Ollama API and return the generated response."""
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": 150
        }
    }
    
    try:
        response = requests.post(OLLAMA_URL, json=payload, timeout=timeout)
        response.raise_for_status()
        result = response.json()
        return result.get("response", "").strip()
    except requests.exceptions.Timeout:
        print(f"       LLM request timed out after {timeout} seconds")
        return None
    except requests.exceptions.RequestException as e:
        print(f"       LLM request failed: {e}")
        return None


# Prompt engineering (simplified from notebook)
def should_summarize_file(file_path: str) -> bool:
    """Determine if a file should be included in summarization."""
    exclude_patterns = [
        '.github/', 'pyproject.toml', 'package-lock.json', 'yarn.lock',
        'poetry.lock', '.min.js', '.min.css', '__pycache__', '.pyc',
        '.yml', '.yaml', 'requirements.txt', 'setup.py', 'setup.cfg',
        '.gitignore', 'LICENSE', 'MANIFEST.in'
    ]
    for pattern in exclude_patterns:
        if pattern in file_path:
            return False
    return True


def chunk_diff_by_file(base: str, current: str, changed_files: List[str], repo_path: str = ".") -> Dict[str, str]:
    """Split the diff into per-file chunks for manageable summarization."""
    file_diffs = {}
    for file_path in changed_files:
        diff = get_file_diff(base, current, file_path, repo_path)
        if diff.strip():
            file_diffs[file_path] = diff
    return file_diffs


def truncate_large_diff(diff: str, max_lines: int = 100) -> str:
    """Truncate very large diffs to focus on beginning and end."""
    lines = diff.splitlines()
    if len(lines) <= max_lines:
        return diff
    
    half = max_lines // 2
    truncated = lines[:half] + ["\n... [truncated middle section] ...\n"] + lines[-half:]
    return "\n".join(truncated)


def create_file_summary_prompt(file_path: str, diff: str, max_diff_lines: int = 150) -> str:
    """Create a prompt for summarizing a single file's changes."""
    atomic_changes = parse_diff_hunks(diff)
    atomic_changes = detect_modifications(atomic_changes)
    
    changes_list = format_atomic_changes(atomic_changes)
    change_count = len(atomic_changes)
    
    truncated_diff = truncate_large_diff(diff, max_diff_lines)
    
    prompt = f"""Summarize the code changes for this file. You must mention ALL {change_count} changes listed below.

File: {file_path}

Atomic Changes ({change_count} total):
{changes_list}

Full Diff Context:
```
{truncated_diff}
```

Requirements:
- Describe ALL {change_count} atomic changes listed above
- Be specific: mention variable names, function names, line additions/deletions
- **Write a single concise paragraph (1-2 sentences), not a bullet list**
- Do not infer or hallucinate changes not shown above

Summary (concise paragraph):"""
    
    return prompt


def create_overall_summary_prompt(base_branch: str, current_branch: str, commits: List[str], 
                                  changed_files: List[str], file_summaries: List[str]) -> str:
    """Create a prompt for generating an overall PR summary from file-level summaries."""
    commits_text = "\n".join(f"  - {commit}" for commit in commits[:10])
    if len(commits) > 10:
        commits_text += f"\n  ... and {len(commits) - 10} more commits"
    
    files_text = "\n".join(f"  - {file}" for file in changed_files[:15])
    if len(changed_files) > 15:
        files_text += f"\n  ... and {len(changed_files) - 15} more files"
    
    summaries_text = "\n\n".join(f"{i+1}. {summary}" for i, summary in enumerate(file_summaries))
    
    prompt = f"""Summarize this pull request based only on the information below. Be concise (2-3 sentences total).

Branch: {current_branch} → {base_branch}

Commits: {len(commits)}
Changed files: {len(changed_files)}
{files_text}

File summaries:

{summaries_text}

Provide a brief PR summary covering: purpose, main changes, and impact. Keep it under 3 sentences total.

Summary:"""
    
    return prompt


# Main PR summarization function
def summarize_pr(
    repo_path: str = ".",
    base_branch: str = None,
    current_branch: str = None,
    max_files_to_summarize: int = 10,
    enable_validation: bool = True,
    retry_missing: bool = True,
    llm_timeout: int = 200,
    verbose: bool = True
) -> Dict[str, any]:
    """Complete PR summarization pipeline with atomic change tracking and validation."""
    
    if verbose:
        print("PR SUMMARIZATION PIPELINE (with atomic change tracking)")
    
    # Extract git data
    if verbose:
        print("\n[1/5] Extracting PR data from git...")
    
    if not current_branch:
        current_branch = get_current_branch(repo_path)
    if not base_branch:
        base_branch = get_base_branch(repo_path)
    
    commits = get_commit_messages(base_branch, current_branch, repo_path)
    changed_files = get_changed_files(base_branch, current_branch, repo_path)
    
    if verbose:
        print(f"  Branch: {current_branch} → {base_branch}")
        print(f"  Commits: {len(commits)}")
        print(f"  Changed files: {len(changed_files)}")
    
    if not changed_files:
        return {
            "base_branch": base_branch,
            "current_branch": current_branch,
            "commits": commits,
            "changed_files": changed_files,
            "file_summaries": {},
            "failed_files": [],
            "file_metrics": {},
            "overall_summary": "No changes detected between branches.",
            "repo_path": repo_path
        }
    
    # Chunk diffs by file
    if verbose:
        print(f"\n[2/5] Chunking diffs by file...")
    
    file_diffs = chunk_diff_by_file(base_branch, current_branch, changed_files, repo_path)
    
    files_to_summarize = [
        f for f in changed_files 
        if should_summarize_file(f) and f in file_diffs
    ][:max_files_to_summarize]
    
    if verbose:
        print(f"  Files to summarize: {len(files_to_summarize)}")
    
    # Summarize each file
    if verbose:
        print(f"\n[3/5] Generating file-level summaries with atomic change tracking...")
    
    file_summaries = {}
    failed_files = []
    file_metrics = {}
    
    for i, file_path in enumerate(files_to_summarize, 1):
        if verbose:
            print(f"  [{i}/{len(files_to_summarize)}] {file_path}...")
        
        diff = file_diffs[file_path]
        atomic_changes = parse_diff_hunks(diff)
        atomic_changes = detect_modifications(atomic_changes)
        
        if verbose:
            print(f"      → {len(atomic_changes)} atomic changes detected")
        
        prompt = create_file_summary_prompt(file_path, diff)
        summary = call_ollama(prompt, timeout=llm_timeout)
        
        if not summary:
            if verbose:
                print(f"       Failed to generate summary (timeout/error)")
            failed_files.append(file_path)
            file_summaries[file_path] = " Summary could not be generated for this file due to LLM timeout or error."
            continue
        
        file_summaries[file_path] = summary
    
    if verbose:
        print(f"\n[4/5] Generating overall PR summary...")
    
    # Generate overall summary (exclude failed files)
    successful_summaries = {
        file: summary for file, summary in file_summaries.items()
        if file not in failed_files
    }
    
    if not successful_summaries:
        overall_summary = "No files could be summarized successfully."
    else:
        summary_list = [f"{file}: {summary}" for file, summary in successful_summaries.items()]
        overall_prompt = create_overall_summary_prompt(
            base_branch, current_branch, commits, changed_files, summary_list
        )
        overall_summary = call_ollama(overall_prompt, timeout=llm_timeout)
        if not overall_summary:
            overall_summary = "Error generating overall summary due to LLM timeout or error."
    
    if verbose:
        print(f"\n[5/5] Pipeline complete!")
        print(f"  Successfully summarized: {len(successful_summaries)} files")
        if failed_files:
            print(f"   Failed to summarize: {len(failed_files)} files")
    
    return {
        "base_branch": base_branch,
        "current_branch": current_branch,
        "commits": commits,
        "changed_files": changed_files,
        "file_summaries": file_summaries,
        "failed_files": failed_files,
        "file_metrics": file_metrics,
        "overall_summary": overall_summary,
        "repo_path": repo_path
    }


def list_failed_files(result: Dict[str, any]):
    """Display a list of all files that failed to summarize."""
    failed = result.get('failed_files', [])
    
    if not failed:
        print("✓ All files were summarized successfully!")
        return
    
    print(f"\n {len(failed)} file(s) failed to summarize:\n")
    for i, file_path in enumerate(failed, 1):
        print(f"  {i}. {file_path}")


def summarize_failed_file(
    result: Dict[str, any],
    file_path: str,
    timeout: int = 600,
    enable_validation: bool = True,
    retry_missing: bool = True,
    verbose: bool = True
) -> Dict[str, any]:
    """Retry summarization for a specific file that previously failed."""
    
    if file_path not in result.get('failed_files', []):
        if verbose:
            print(f" {file_path} is not in the failed files list.")
        return result
    
    if verbose:
        print(f"\n Retrying summarization for: {file_path}")
        print(f"   Timeout: {timeout} seconds")
    
    repo_path = result['repo_path']
    base_branch = result['base_branch']
    current_branch = result['current_branch']
    
    diff = get_file_diff(base_branch, current_branch, file_path, repo_path)
    
    if not diff.strip():
        if verbose:
            print(f"    No diff found for {file_path}")
        return result
    
    atomic_changes = parse_diff_hunks(diff)
    atomic_changes = detect_modifications(atomic_changes)
    
    if verbose:
        print(f"   → {len(atomic_changes)} atomic changes detected")
    
    prompt = create_file_summary_prompt(file_path, diff)
    summary = call_ollama(prompt, timeout=timeout)
    
    if not summary:
        if verbose:
            print(f"    Summary still failed with {timeout}s timeout")
        return result
    
    if verbose:
        print(f"   ✓ Summary generated successfully!")
    
    # Update result in-place
    result['file_summaries'][file_path] = summary
    result['failed_files'].remove(file_path)
    
    if verbose:
        print(f"   ✓ Successfully updated summary for {file_path}")
        print(f"   Remaining failed files: {len(result['failed_files'])}")
    
    return result


def regenerate_overall_summary(result: Dict, llm_timeout: int = 200, verbose: bool = True) -> Dict:
    """Regenerate the overall PR summary using the latest set of successful file summaries."""
    failed_files = result.get('failed_files', [])
    successful_summaries = {
        file: summary for file, summary in result['file_summaries'].items()
        if file not in failed_files
    }
    
    if not successful_summaries:
        overall_summary = "No files could be summarized successfully."
    else:
        summary_list = [f"{file}: {summary}" for file, summary in successful_summaries.items()]
        overall_prompt = create_overall_summary_prompt(
            result['base_branch'],
            result['current_branch'],
            result['commits'],
            result['changed_files'],
            summary_list
        )
        overall_summary = call_ollama(overall_prompt, timeout=llm_timeout)
        if not overall_summary:
            overall_summary = "Error generating overall summary due to LLM timeout or error."
    
    result['overall_summary'] = overall_summary
    
    if verbose:
        print("✓ Overall PR summary regenerated.")
    
    return result


def export_summary_to_markdown(result: Dict[str, any], output_path: str = "pr_summary.md"):
    """Export the PR summary to a markdown file with validation metrics and failure reporting."""
    
    failed_files = result.get('failed_files', [])
    successful_files = [f for f in result['file_summaries'].keys() if f not in failed_files]
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(f"# PR Summary: {result['current_branch']} → {result['base_branch']}\n\n")
        
        f.write(f"**Commits:** {len(result['commits'])}  \n")
        f.write(f"**Total Changed Files:** {len(result['changed_files'])}  \n")
        f.write(f"**Successfully Summarized:** {len(successful_files)}  \n")
        
        if failed_files:
            f.write(f"** Failed to Summarize:** {len(failed_files)}  \n")
        
        f.write("\n---\n\n")
        
        f.write("## Commits\n\n")
        for commit in result['commits']:
            f.write(f"- {commit}\n")
        
        if successful_files:
            f.write("\n## ✓ Successfully Summarized Files\n\n")
            for file_path in successful_files:
                summary = result['file_summaries'][file_path]
                f.write(f"### `{file_path}`\n\n")
                f.write(f"{summary}\n\n")
        
        if failed_files:
            f.write("\n##  Files That Could Not Be Summarized\n\n")
            for file_path in failed_files:
                f.write(f"### `{file_path}`\n\n")
                f.write(f">  {result['file_summaries'].get(file_path, 'Summary could not be generated.')}\n\n")
        
        f.write("\n---\n\n")
        f.write("## Overall Summary\n\n")
        f.write(f"{result['overall_summary']}\n")
    
    print(f"✓ PR summary exported to {output_path}")
