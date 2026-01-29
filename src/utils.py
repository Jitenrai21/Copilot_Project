import os
from typing import List

def find_repo_root(start_path: str = '.') -> str:
    """Recursively search parent directories for .git folder."""
    current = os.path.abspath(start_path)
    while current != os.path.dirname(current):
        if os.path.isdir(os.path.join(current, '.git')):
            return current
        current = os.path.dirname(current)
    raise FileNotFoundError(".git directory not found.")

def list_python_files(repo_root: str) -> List[str]:
    """List all .py files, excluding tests and docs folders."""
    py_files = []
    for root, dirs, files in os.walk(repo_root):
        # Exclude test and docs directories
        dirs[:] = [d for d in dirs if d not in ('tests', 'test', 'docs', '__pycache__')]
        for file in files:
            if file.endswith('.py'):
                py_files.append(os.path.join(root, file))
    return py_files

# Detect repo root and list first 10 Python files
# repo_root = find_repo_root('../flask')
# py_files = list_python_files(repo_root)
# print(f"Repo root: {repo_root}")
# print("First 10 Python files:")
# for f in py_files[:10]:
#     print(f)