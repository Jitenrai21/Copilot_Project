#!/usr/bin/env python3
"""
PR Summary Backend v2 - API-based PR Summarization

Modular backend for PR summarization with API-based LLM integration.
Extracts atomic changes, generates file-level summaries, and produces overall PR summaries.
"""

import os
import subprocess
import time
import re
from typing import List, Dict, Optional
import requests


class PRSummaryBackend:
    """Backend for API-based PR summarization."""
    
    def __init__(
        self,
        api_key: str,
        api_url: str = "https://api.groq.com/openai/v1/chat/completions",
        model_name: str = "llama-3.3-70b-versatile"
    ):
        """
        Initialize the PR summary backend.
        
        Args:
            api_key: LLM API key
            api_url: LLM API endpoint URL
            model_name: LLM model name
        """
        self.api_key = api_key
        self.api_url = api_url
        self.model_name = model_name
    
    def call_llm_api(
        self,
        prompt: str,
        temperature: float = 0.3,
        timeout: int = 200,
        max_retries: int = 3,
        max_tokens: int = 1000
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
                {"role": "system", "content": "You are an expert code reviewer analyzing git diffs."},
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
                print(f"  LLM request timed out (attempt {attempt + 1}/{max_retries})")
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
    
    def get_current_branch(self, repo_path: str = ".") -> str:
        """Get the name of the current git branch."""
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"], 
            capture_output=True, 
            text=True,
            encoding="utf-8",
            cwd=repo_path
        )
        return result.stdout.strip()
    
    def get_base_branch(self, repo_path: str = ".", default: str = "main") -> str:
        """
        Get the base branch for comparison. 
        Tries to detect main/master, falls back to provided default.
        """
        # Check if main exists
        result = subprocess.run(
            ["git", "rev-parse", "--verify", "main"],
            capture_output=True,
            encoding="utf-8",
            cwd=repo_path
        )
        if result.returncode == 0:
            return "main"
        
        # Check if master exists
        result = subprocess.run(
            ["git", "rev-parse", "--verify", "master"],
            capture_output=True,
            encoding="utf-8",
            cwd=repo_path
        )
        if result.returncode == 0:
            return "master"
        
        return default
    
    def get_changed_files(self, base: str, current: str, repo_path: str = ".") -> List[str]:
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
    
    def get_commit_messages(self, base: str, current: str, repo_path: str = ".") -> List[str]:
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
    
    def get_file_diff(self, base: str, current: str, file_path: str, repo_path: str = ".") -> str:
        """Get the diff for a specific file between two branches."""
        result = subprocess.run(
            ["git", "diff", f"{base}...{current}", "--", file_path],
            capture_output=True,
            text=True,
            encoding="utf-8",
            cwd=repo_path
        )
        return result.stdout
    
    def detect_atomic_changes(self, diff: str) -> List[Dict]:
        """
        Detect atomic changes (additions, deletions, modifications) in a diff.
        
        Args:
            diff: Git diff string for a file
        
        Returns:
            List of atomic change dictionaries
        """
        atomic_changes = []
        
        # Parse diff hunks
        hunk_pattern = r'@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@([^\n]*)'
        hunks = list(re.finditer(hunk_pattern, diff))
        
        for hunk_match in hunks:
            old_start = int(hunk_match.group(1))
            old_count = int(hunk_match.group(2)) if hunk_match.group(2) else 1
            new_start = int(hunk_match.group(3))
            new_count = int(hunk_match.group(4)) if hunk_match.group(4) else 1
            context = hunk_match.group(5).strip()
            
            # Extract lines within this hunk
            hunk_start = hunk_match.end()
            next_hunk_start = hunks[hunks.index(hunk_match) + 1].start() if hunks.index(hunk_match) + 1 < len(hunks) else len(diff)
            hunk_content = diff[hunk_start:next_hunk_start]
            
            lines = hunk_content.split('\n')
            
            additions = []
            deletions = []
            
            for line in lines:
                if line.startswith('+') and not line.startswith('+++'):
                    additions.append(line[1:])
                elif line.startswith('-') and not line.startswith('---'):
                    deletions.append(line[1:])
            
            if additions or deletions:
                change_type = 'modification' if additions and deletions else ('addition' if additions else 'deletion')
                
                atomic_changes.append({
                    'type': change_type,
                    'context': context,
                    'old_lines': (old_start, old_start + old_count - 1),
                    'new_lines': (new_start, new_start + new_count - 1),
                    'additions': additions,
                    'deletions': deletions,
                    'summary': f"{change_type.capitalize()} at lines {new_start}-{new_start + new_count - 1}"
                })
        
        return atomic_changes
    
    def summarize_file_changes(
        self,
        file_path: str,
        diff: str,
        atomic_changes: List[Dict],
        timeout: int = 200,
        verbose: bool = False
    ) -> Optional[str]:
        """
        Generate a summary for file-level changes using LLM API.
        
        Args:
            file_path: Path to the file
            diff: Git diff for the file
            atomic_changes: List of atomic changes detected
            timeout: Request timeout
            verbose: Print progress
        
        Returns:
            Summary string or None if failed
        """
        if verbose:
            print(f"  Summarizing {file_path}...")
        
        # Build atomic changes list for prompt
        changes_list = "\n".join([
            f"- {change['type'].capitalize()}: {change['summary']}"
            for change in atomic_changes
        ])
        
        prompt = f"""Analyze the following git diff for file: {file_path}

Atomic Changes Detected:
{changes_list}

Git Diff:
```diff
{diff[:3000]}  # Limit diff size
```

Generate a concise summary (2-4 sentences) that:
1. Explains what changed in this file
2. References the atomic changes above
3. Describes the purpose/impact of the changes

Summary:"""
        
        summary = self.call_llm_api(
            prompt,
            temperature=0.3,
            timeout=timeout,
            max_tokens=500
        )
        
        return summary
    
    def generate_overall_summary(
        self,
        file_summaries: Dict[str, str],
        commits: List[str],
        timeout: int = 200,
        verbose: bool = False
    ) -> Optional[str]:
        """
        Generate an overall PR summary from file-level summaries.
        
        Args:
            file_summaries: Dict mapping file paths to their summaries
            commits: List of commit messages
            timeout: Request timeout
            verbose: Print progress
        
        Returns:
            Overall summary string or None if failed
        """
        if verbose:
            print("  Generating overall PR summary...")
        
        # Build file summaries section
        summaries_text = "\n\n".join([
            f"**{file_path}**:\n{summary}"
            for file_path, summary in file_summaries.items()
        ])
        
        # Build commits section
        commits_text = "\n".join([f"- {commit}" for commit in commits[:10]])
        
        prompt = f"""Analyze the following pull request changes and generate a comprehensive summary.

Commit Messages:
{commits_text}

File-Level Summaries:
{summaries_text}

Generate an overall PR summary (1 brief paragraph) that:
1. Describes the main purpose of this PR
2. Highlights key changes across all files
3. Explains the impact and benefits
4. Notes any architectural or design changes

Overall Summary:"""
        
        overall_summary = self.call_llm_api(
            prompt,
            temperature=0.5,
            timeout=timeout,
            max_tokens=1000
        )
        
        return overall_summary
    
    def should_summarize_file(self, file_path: str) -> bool:
            """Determine if a file should be included in summarization."""
            exclude_patterns = [
                '.github/', '.devcopilot/', 'pyproject.toml', 'package-lock.json', 'yarn.lock',
                'poetry.lock', '.min.js', '.min.css', '__pycache__', '.pyc',
                '.yml', '.yaml', 'requirements.txt', 'setup.py', 'setup.cfg',
                '.gitignore', 'LICENSE', 'MANIFEST.in'
            ]
            for pattern in exclude_patterns:
                if pattern in file_path:
                    return False
            return True
    
    def summarize_pr(
        self,
        repo_path: str = ".",
        base_branch: Optional[str] = None,
        current_branch: Optional[str] = None,
        max_files: int = 10,
        timeout: int = 200,
        verbose: bool = True
    ) -> Dict:
        """
        Complete PR summarization pipeline.
        
        Args:
            repo_path: Path to the git repository
            base_branch: Base branch (auto-detected if None)
            current_branch: Current branch (auto-detected if None)
            max_files: Maximum number of files to summarize
            timeout: LLM request timeout
            verbose: Print progress
        
        Returns:
            Dict with PR summary data
        """
        if verbose:
            print(f" Analyzing PR in: {repo_path}")
        
        # Step 1: Extract git data
        if not current_branch:
            current_branch = self.get_current_branch(repo_path)
        if not base_branch:
            base_branch = self.get_base_branch(repo_path)
        
        if verbose:
            print(f"  Branches: {current_branch} → {base_branch}")
        
        changed_files = self.get_changed_files(base_branch, current_branch, repo_path)
        commits = self.get_commit_messages(base_branch, current_branch, repo_path)
        
        if verbose:
            print(f"  Changed files: {len(changed_files)}")
            print(f"  Commits: {len(commits)}")
        
        # Limit files to summarize, skipping ignored files
        files_to_summarize = [
            f for f in changed_files
            if self.should_summarize_file(f)
        ][:max_files]
        
        # Step 2: Summarize each file
        file_summaries = {}
        file_atomic_changes = {}
        failed_files = []
        
        for i, file_path in enumerate(files_to_summarize, 1):
            if verbose:
                print(f"\n[{i}/{len(files_to_summarize)}] Processing {file_path}...")
            
            # Get file diff
            diff = self.get_file_diff(base_branch, current_branch, file_path, repo_path)
            
            if not diff.strip():
                if verbose:
                    print(f"    No diff found, skipping...")
                continue
            
            # Detect atomic changes
            atomic_changes = self.detect_atomic_changes(diff)
            file_atomic_changes[file_path] = atomic_changes
            
            if verbose:
                print(f"  Detected {len(atomic_changes)} atomic changes")
            
            # Generate summary
            summary = self.summarize_file_changes(
                file_path,
                diff,
                atomic_changes,
                timeout=timeout,
                verbose=verbose
            )
            
            if summary:
                file_summaries[file_path] = summary
                if verbose:
                    print(f"  ✓ Summary generated ({len(summary)} chars)")
            else:
                failed_files.append(file_path)
                file_summaries[file_path] = f"[Failed to generate summary for {file_path}]"
                if verbose:
                    print(f"  Failed to generate summary")
        
        # Step 3: Generate overall summary
        if verbose:
            print(f"\n Generating overall PR summary...")
        
        overall_summary = self.generate_overall_summary(
            file_summaries,
            commits,
            timeout=timeout,
            verbose=verbose
        )
        
        if not overall_summary:
            overall_summary = "Failed to generate overall PR summary."
        
        if verbose:
            print(f"  ✓ Overall summary generated\n")
        
        return {
            'repo_path': repo_path,
            'base_branch': base_branch,
            'current_branch': current_branch,
            'commits': commits,
            'changed_files': changed_files,
            'file_summaries': file_summaries,
            'file_atomic_changes': file_atomic_changes,
            'overall_summary': overall_summary,
            'failed_files': failed_files
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
