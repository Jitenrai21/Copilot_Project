# DevCopilot v3 VS Code Extension - Advanced Edition

A VS Code extension that provides **advanced semantic code search** (HyDE/RAG) and **PR summarization** powered by API-based LLMs with local embeddings.

## ✨ Features

### 🔍 Advanced Code Search - HyDE Mode
- Generate hypothetical code via API, then search for similar real code
- Best for: "Show me error handling code", "database connection functions"
- **Interactive results**: Click on any result to open the file at the exact line
- Real-time similarity scoring with method indicators

### 💡 Topic Queries - RAG Mode  
- Retrieve relevant code chunks and generate explanations with full context
- Best for: "How does routing work?", "What is the Blueprint class?"
- Get comprehensive answers backed by source code references

### 📝 PR Summarization with Atomic Change Detection
- Automatically generate summaries of pull requests
- API-based LLM for intelligent summarization
- Atomic change detection and analysis
- Works with your git repository

### 🎯 User-Friendly Workflow
- **One-click indexing**: Select a repository and index it automatically
- **Mode-based search**: Explicitly choose HyDE or RAG for predictable results
- **Workspace state**: Each workspace remembers its configuration
- **Visual feedback**: Progress indicators and status commands

### 🔒 Privacy & Flexibility
- Local embeddings with Jina v2 code model
- API-based LLM (Groq, OpenAI, or custom endpoints)
- Configurable API keys and endpoints
- Your code embeddings stay on your machine

## Quick Start

### 1. Install and Setup

```bash
cd vscode-extension-v2
npm install
npm run compile
```

Press `F5` in VS Code to launch the Extension Development Host.

### 2. Configure API Key (Secure Methods)

**🔒 Recommended: Use Secure Storage (Best)**
1. Open Command Palette (`Ctrl+Shift+P`)
2. Run: **DevCopilot v2: Set API Key**
3. Enter your LLM API key when prompted
4. Your key is stored securely using VS Code's SecretStorage

**🌍 Alternative: Use Environment Variable**
- Set the `LLM_API_KEY` environment variable:
  - Windows (PowerShell): `$env:LLM_API_KEY="your-key-here"`
  - macOS/Linux: `export LLM_API_KEY="your-key-here"`
- Restart VS Code after setting the variable

**⚠️ Not Recommended: VS Code Settings**
- Open Settings (`Ctrl+,`)
- Search for "DevCopilot"
- Set `devcopilotV2.apiKey` (less secure, not recommended)

**API Key Sources (Priority Order):**
1. SecretStorage (most secure) - use "Set API Key" command
2. Environment variable `LLM_API_KEY`
3. VS Code settings (least secure)

**Get a Free API Key:**
- Groq (recommended): [https://console.groq.com](https://console.groq.com)
- OpenAI: [https://platform.openai.com](https://platform.openai.com)

### 3. Index a Repository

1. Open Command Palette (`Ctrl+Shift+P`)
2. Run: **DevCopilot v2: Index Repository**
3. Select your repository folder
4. Wait for indexing to complete

### 4. Start Searching!

**For Code Search (HyDE):**
1. Open Command Palette
2. Run: **DevCopilot v2: Search Code (HyDE)**
3. Enter your query (e.g., "error handling middleware")

**For Topic Questions (RAG):**
1. Open Command Palette
2. Run: **DevCopilot v2: Ask Question (RAG)**
3. Enter your question (e.g., "How does Flask routing work?")
4. Click on source references to navigate to code

## Prerequisites

1. **Python 3.8+** with DevCopilot CLI v2 dependencies installed:
   ```bash
   pip install typer rich chromadb sentence-transformers tree-sitter-languages requests python-dotenv
   ```
2. **LLM API Key** - Get a free key from [Groq](https://console.groq.com) or use OpenAI/compatible endpoint
3. **VS Code 1.80.0+**

## Commands

| Command | Description |
|---------|-------------|
| `DevCopilot v2: Set API Key` | **[Recommended]** Securely store your LLM API key |
| `DevCopilot v2: Index Repository` | Select and index a repository for searching |
| `DevCopilot v2: Show Pipeline Status` | View current pipeline configuration |
| `DevCopilot v2: Search Code (HyDE)` | Search code using hypothetical document embeddings |
| `DevCopilot v2: Ask Question (RAG)` | Get explanations with retrieval-augmented generation |
| `DevCopilot v2: Summarize PR` | Generate a summary of git changes with API-based LLM |
| `DevCopilot v2: Select Repository` | Configure repository for operations |

## Configuration

Configure settings in VS Code (`Ctrl+,` or `Cmd+,`):

```json
{
  "devcopilot.pythonPath": "python",
  "devcopilot.cliPath": "/absolute/path/to/cli_v2.py",
  "devcopilot.apiKey": "your-groq-or-openai-api-key",
  "devcopilot.apiUrl": "https://api.groq.com/openai/v1/chat/completions",
  "devcopilot.modelName": "llama-3.3-70b-versatile",
  "devcopilot.chromaDbPath": "data/chroma_db_api",
  "devcopilot.collectionName": "code_collection"
```json
{
  "devcopilotV2.pythonPath": "path/to/python",           // Python interpreter
  "devcopilotV2.cliPath": "path/to/cli_v2.py",          // CLI script path
  "devcopilotV2.apiKey": "",                             // [NOT RECOMMENDED] Use "Set API Key" command instead
  "devcopilotV2.apiUrl": "https://api.groq.com/...",    // LLM API endpoint
  "devcopilotV2.modelName": "llama-3.3-70b-versatile",  // LLM model
  "devcopilotV2.chromaDbPath": "data/chroma_db",        // ChromaDB path
  "devcopilotV2.collectionName": "code_collection"      // Collection name
}
```

**⚠️ Security Note**: Never store your API key in `settings.json`. Use the "DevCopilot v2: Set API Key" command or the `LLM_API_KEY` environment variable instead.

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

## Security & Privacy

### 🔒 API Key Security

DevCopilot v2 implements multiple layers of security for your LLM API key:

1. **SecretStorage (Most Secure)**
   - Keys stored using VS Code's built-in SecretStorage API
   - Encrypted at the OS level (Windows Credential Manager, macOS Keychain, Linux Secret Service)
   - Never exposed in plaintext files or logs
   - Use the "DevCopilot v2: Set API Key" command

2. **Environment Variables (Secure)**
   - Set `LLM_API_KEY` in your shell environment
   - Not stored in any VS Code files
   - Good for CI/CD and automated environments

3. **Settings (Not Recommended)**
   - Storing keys in `settings.json` is discouraged
   - May be synced to cloud or exposed in backups
   - Only use if other methods are unavailable

### 🛡️ Privacy Features

- **Local Embeddings**: All code embeddings stay on your machine
- **No Code Upload**: Your code is never sent to external servers
- **API Calls Only for Generation**: LLM API is only used for generating hypothetical code (HyDE), answers (RAG), and summaries—never for embedding your codebase
- **No Logging of Sensitive Data**: API keys are never logged or displayed

## Troubleshooting

### "API key not configured" Error

**If you see this error:**
1. Run "DevCopilot v2: Set API Key" command
2. Or set the `LLM_API_KEY` environment variable and restart VS Code
3. Verify your API key is valid (test at https://console.groq.com or your provider's dashboard)

**To check your current API key source:**
- The extension will prompt you if no key is found
- Check: SecretStorage → Environment Variable → Settings (in that order)

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
