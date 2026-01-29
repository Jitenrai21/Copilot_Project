# DevCopilot VS Code Extension

A VS Code extension that provides semantic code search and PR summarization powered by local LLMs and embeddings.

## ✨ Features

### 🔍 Semantic Code Search
- Search your codebase using natural language queries
- **Interactive results**: Click on any result to open the file at the exact line
- Real-time similarity scoring
- Supports functions, classes, and code blocks

### 📝 PR Summarization
- Automatically generate summaries of pull requests
- Atomic change detection and analysis
- Works with your git repository

### 🎯 User-Friendly Workflow
- **One-click indexing**: Select a repository and index it automatically
- **No manual configuration**: Pipeline setup is handled for you
- **Workspace state**: Each workspace remembers its configuration
- **Visual feedback**: Progress indicators and status commands

### 🔒 Privacy First
- Works entirely locally using Ollama and ChromaDB
- No data sent to external services
- Your code stays on your machine

## Quick Start

### 1. Install and Setup

```bash
cd vscode-extension
npm install
npm run compile
```

Press `F5` in VS Code to launch the Extension Development Host.

### 2. Index a Repository

1. Open Command Palette (`Ctrl+Shift+P`)
2. Run: **DevCopilot: Index Repository**
3. Select your repository folder
4. Wait for indexing to complete

### 3. Start Searching!

1. Open Command Palette
2. Run: **DevCopilot: Search Codebase**
3. Enter your query (e.g., "how to handle authentication")
4. Click on results to navigate to code

## Prerequisites

1. **Python 3.8+** with DevCopilot CLI dependencies installed
2. **Ollama** with CodeLlama model (for PR summarization)
3. **VS Code 1.80.0+**## Commands

| Command | Description |
|---------|-------------|
| `DevCopilot: Index Repository` | Select and index a repository for searching |
| `DevCopilot: Show Pipeline Status` | View current pipeline configuration |
| `DevCopilot: Search Codebase` | Search indexed code using natural language |
| `DevCopilot: Summarize PR` | Generate a summary of git changes |

## Configuration (Optional)

For advanced users, you can manually configure settings in VS Code (`Ctrl+,` or `Cmd+,`):

```json
{
  "devcopilot.pythonPath": "python",
  "devcopilot.cliPath": "/absolute/path/to/cli.py",
  "devcopilot.chromaDbPath": "data/chroma_db",
  "devcopilot.collectionName": "flask_code"
}
```

**Note**: With the new workflow, manual configuration is rarely needed as the extension handles paths automatically.

## How It Works

### Workflow

1. **Index**: Select a repository → Extension creates `.devcopilot/chroma_db` → Indexes code
2. **Search**: Enter query → Semantic search via embeddings → Results displayed
3. **Navigate**: Click results → File opens at exact line

### Pipeline Management

- **Workspace State**: Configuration is stored per workspace, not globally
- **Auto-generated Paths**: DB and collection names are created automatically
- **Fallback to Settings**: If no workspace state exists, uses settings.json

## Architecture

```
vscode-extension/
├── src/
│   ├── extension.ts              # Extension entry point
│   ├── cliIntegration.ts         # Python CLI integration
│   ├── commands/
│   │   ├── searchCode.ts         # Search command handler
│   │   └── summarizePR.ts        # PR summarization handler
│   └── webview/
│       └── resultsViewProvider.ts # Webview for displaying results
├── package.json                   # Extension manifest
├── tsconfig.json                  # TypeScript configuration
└── README.md                      # This file
```

### Key Components

1. **CLI Integration** (`cliIntegration.ts`):
   - Executes Python CLI using Node.js `child_process`
   - Parses CLI output (rich-formatted text)
   - Handles errors and timeouts

2. **Commands** (`commands/`):
   - `searchCode.ts`: Prompts for query, calls CLI, displays results
   - `summarizePR.ts`: Runs PR summarization, displays formatted summary

3. **Webview Provider** (`webview/resultsViewProvider.ts`):
   - Renders search results with syntax highlighting
   - Displays PR summaries with validation metrics
   - Shows errors with user-friendly messages

## Development

### Build and Watch

```bash
npm run compile   # Compile TypeScript
npm run watch     # Watch for changes and recompile
```

### Debug

1. Open the extension directory in VS Code
2. Press `F5` to launch Extension Development Host
3. Test commands in the development instance

### Linting

```bash
npm run lint
```

## Troubleshooting

### "Collection not found" Error

- Ensure you've indexed the repository using `python cli.py index`
- Verify the `chromaDbPath` and `collectionName` settings match your indexed data

### Python CLI Not Found

- Set `devcopilot.cliPath` to the absolute path of `cli.py`
- Verify `devcopilot.pythonPath` points to the correct Python executable

### No Results Displayed

- Check the Output panel (View > Output > DevCopilot) for errors
- Verify the Python CLI works independently: `python cli.py search "test query"`

### Ollama Connection Failed (PR Summarization)

- Ensure Ollama is running: `ollama serve`
- Verify CodeLlama model is installed: `ollama pull codellama:7b-instruct`

## Known Limitations

- Search results are parsed from rich-formatted CLI output (future: JSON output)
- PR summarization requires Ollama running locally
- Extension currently supports Python repositories only

## Future Enhancements

- JSON output mode for CLI for easier parsing
- Support for multiple programming languages
- Inline code annotations from search results
- Interactive retry for failed PR file summaries
- Caching and incremental indexing

## License

MIT

## Contributing

Contributions are welcome! Please open issues or pull requests on the repository.
