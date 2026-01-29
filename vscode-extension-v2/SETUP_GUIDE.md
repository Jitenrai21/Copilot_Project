# DevCopilot v2 Extension - Setup Guide

## Overview

DevCopilot v2 is an enhanced VS Code extension that integrates CLI v2 backend capabilities, featuring:
- **HyDE Search**: Hypothetical Document Embeddings for precise code search
- **RAG Queries**: Retrieval-Augmented Generation for natural language code questions
- **PR Summarization**: Atomic change detection with API-based LLM summarization
- **Local Embeddings**: Jina v2 code embeddings for efficient semantic indexing

## Architecture

### Extension Components
```
vscode-extension-v2/
├── src/
│   ├── extension.ts              # Extension activation & command registration
│   ├── cliIntegration.ts         # CLI v2 bridge with API configuration
│   ├── stateManager.ts           # State persistence
│   ├── commands/
│   │   ├── searchCodeHyde.ts     # HyDE search command
│   │   ├── searchCodeRag.ts      # RAG query command
│   │   ├── summarizePR.ts        # PR summarization command
│   │   └── indexRepository.ts    # Repository indexing command
│   └── webview/
│       └── resultsViewProvider.ts # Results display (search/RAG/PR)
├── package.json                   # Extension manifest with v2 commands
└── tsconfig.json                  # TypeScript configuration
```

### Backend Integration
The extension calls CLI v2 (`cli_v2.py`) which uses:
- `src/code_search_backend_v2.py` - HyDE/RAG implementation
- `src/pr_summary_backend_v2.py` - API-based PR summarization

## Installation & Configuration

### 1. Prerequisites
```bash
# Ensure CLI v2 dependencies are installed
cd d:\dev-copilot
pip install -r requirements.txt

# Verify CLI v2 is working
python cli_v2.py version
```

### 2. Configure API Keys

#### Option A: VS Code Settings (Recommended)
1. Open VS Code Settings (Ctrl+,)
2. Search for "DevCopilot"
3. Set the following:
   - **API Key**: Your Groq/OpenAI API key
   - **API URL**: `https://api.groq.com/openai/v1/chat/completions` (Groq) or OpenAI URL
   - **Model Name**: `llama-3.3-70b-versatile` (Groq) or `gpt-4` (OpenAI)

#### Option B: Environment Variables
```bash
# Windows PowerShell
$env:GROQ_API_KEY = "your-api-key-here"
$env:GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
$env:GROQ_MODEL_NAME = "llama-3.3-70b-versatile"
```

### 3. Install Extension
```bash
cd d:\dev-copilot\vscode-extension-v2

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Package extension (optional)
npm install -g @vscode/vsce
vsce package
# This creates devcopilot-v2-2.0.0.vsix

# Install from VSIX
code --install-extension devcopilot-v2-2.0.0.vsix
```

### 4. Development Mode
Press **F5** in VS Code to launch Extension Development Host for testing.

## Usage

### Step 1: Index Repository
1. Open Command Palette (Ctrl+Shift+P)
2. Run: **DevCopilot v2: Index Repository**
3. Select repository folder to index
4. Wait for indexing to complete (progress shown in notification)

### Step 2: Search with HyDE
1. Command Palette → **DevCopilot v2: Search Code (HyDE)**
2. Enter natural language query:
   - "Find the main application entry point"
   - "Show me database connection code"
3. View ranked results in DevCopilot Results panel
4. Click file links to open code

### Step 3: Query with RAG
1. Command Palette → **DevCopilot v2: Query Codebase (RAG)**
2. Ask a question:
   - "How does Flask handle routing?"
   - "What is the Blueprint class used for?"
3. View generated answer with supporting code sources
4. Click source references to navigate

### Step 4: Summarize PR
1. Ensure you're in a Git repository with uncommitted changes
2. Command Palette → **DevCopilot v2: Summarize PR**
3. View atomic change summary in DevCopilot Results panel
4. Summary includes:
   - Changed files with type tags (🆕 New, ⚙️ Modified, ❌ Deleted)
   - Atomic changes per file with purpose
   - AI-generated PR title and description

## Commands Reference

| Command | Description | Mode |
|---------|-------------|------|
| `devcopilot.searchCodeHyde` | Search using HyDE (Hypothetical Document Embeddings) | `--mode hyde` |
| `devcopilot.searchCodeRag` | Query codebase with RAG (answer + sources) | `--mode rag` |
| `devcopilot.summarizePR` | Generate atomic PR summary | `summarize` |
| `devcopilot.indexRepository` | Index repository for semantic search | `index` |

## Configuration Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `devcopilot.apiKey` | `""` | API key for LLM (Groq/OpenAI) |
| `devcopilot.apiUrl` | `""` | API endpoint URL |
| `devcopilot.modelName` | `""` | Model name (e.g., llama-3.3-70b-versatile) |
| `devcopilot.collectionPath` | `""` | ChromaDB collection path |
| `devcopilot.modelPath` | `""` | Local embedding model path |

## Results Panel Features

### Search Results Display
- **Ranked Results**: Numbered list with similarity scores
- **Type Tags**: Function, Class, Method indicators
- **File Navigation**: Click to open at specific line
- **Docstring Preview**: Shows function/class documentation

### RAG Results Display
- **Answer Section**: Generated response to your question
- **Supporting Sources**: Code sections used to generate answer
- **Relevance Scores**: Percentage match for each source
- **Interactive Links**: Click to navigate to source code

### PR Summary Display
- **Branch Info**: Current branch and commit count
- **File Change Cards**: Organized by file with type indicators
- **Atomic Changes**: Detected changes with purpose descriptions
- **AI Summary**: Title and description for PR

## Troubleshooting

### No Results Found
- Ensure repository is indexed (run Index Repository command)
- Check API key is configured correctly
- Verify ChromaDB collection exists at `d:\dev-copilot\chroma_db`

### API Errors
- **401 Unauthorized**: Check API key in settings
- **Connection Refused**: Verify API URL is correct
- **Rate Limit**: Wait and retry, or use different API key

### Extension Not Loading
```bash
# Check logs
code --log debug

# Reinstall dependencies
cd vscode-extension-v2
npm install
npm run compile
```

### CLI Integration Issues
```bash
# Test CLI directly
cd d:\dev-copilot
python cli_v2.py search "test query" --mode hyde --top-k 5

# Check Python environment
python --version  # Should be 3.8+
pip list          # Verify sentence-transformers, chromadb, etc.
```

## Comparison: v0.1 vs v2

| Feature | v0.1 | v2 |
|---------|------|-----|
| Search Method | Basic semantic | HyDE + RAG |
| LLM Integration | Local only | API-based (Groq/OpenAI) |
| PR Summarization | Basic Git diff | Atomic changes + AI |
| Embeddings | Generic | Jina v2 code-specific |
| Query Modes | Auto-detect | Explicit mode selection |
| Results Format | Code only | Answer + sources (RAG) |

## Development

### Building from Source
```bash
# Clone repository
git clone <repo-url>
cd vscode-extension-v2

# Install dependencies
npm install

# Compile
npm run compile

# Watch mode for development
npm run watch
```

### Testing
```bash
# Launch Extension Development Host
# Press F5 in VS Code

# Or use CLI
code --extensionDevelopmentPath=d:\dev-copilot\vscode-extension-v2
```

### Packaging
```bash
# Install vsce
npm install -g @vscode/vsce

# Create VSIX
vsce package

# Result: devcopilot-v2-2.0.0.vsix
```

## Support

- **Documentation**: See `README.md` for feature details
- **CLI Guide**: See `CLI_v2_Guide.md` for CLI usage
- **Integration**: See `VSCode_Extension_Integration.md` for architecture
- **Issues**: Check logs in Output panel (DevCopilot channel)

## Next Steps

1. ✅ Install prerequisites (Python, dependencies)
2. ✅ Configure API keys in VS Code settings
3. ✅ Install extension (F5 or install VSIX)
4. ✅ Index your repository
5. ✅ Try HyDE search with example query
6. ✅ Test RAG query with a question
7. ✅ Make changes and run PR summarization

**Demo Ready!** Side-by-side comparison with v0.1 available.
