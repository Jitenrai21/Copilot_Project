# DevCopilot VS Code Extension - Quick Start Guide

## New Workflow (Recommended)

The extension now features an intuitive workflow that requires minimal manual configuration!

### 1. Install and Activate Extension

```bash
cd vscode-extension
npm install
npm run compile
```

Then press `F5` in VS Code to launch the Extension Development Host.

### 2. Index Your Repository

1. Open Command Palette (`Ctrl+Shift+P`)
2. Type: **DevCopilot: Index Repository**
3. Select the repository folder you want to index
4. Confirm the indexing operation

The extension will:
- Automatically generate a ChromaDB path (`.devcopilot/chroma_db` inside your repo)
- Create a collection name based on the repo name
- Store these settings in workspace state
- Start indexing immediately with a progress indicator

### 3. Search Your Codebase

1. Open Command Palette (`Ctrl+Shift+P`)
2. Type: **DevCopilot: Search Codebase**
3. Enter your search query (e.g., "how does Flask handle routing")
4. View results in the DevCopilot Results panel
5. **Click on any result** to open the file at the specific line!

### 4. Summarize Pull Requests

1. Open Command Palette
2. Type: **DevCopilot: Summarize PR**
3. View the generated summary in the DevCopilot Results panel

### 5. Check Pipeline Status

1. Open Command Palette
2. Type: **DevCopilot: Show Pipeline Status**
3. View current repository and collection information

---

## Alternative: Manual Configuration (Advanced)

If you prefer manual configuration or need specific paths:

### Configure Extension Settings

Create `.vscode/settings.json` in your workspace:

```json
{
  "devcopilot.pythonPath": "python",
  "devcopilot.cliPath": "D:\\dev-copilot\\cli.py",
  "devcopilot.chromaDbPath": "data/chroma_db",
  "devcopilot.collectionName": "flask_code"
}
```

**Important**: Update `cliPath` to the absolute path of your `cli.py` file.

Then manually index using the CLI:

```bash
cd ..
python cli.py index --repo ./flask --db data/chroma_db --collection flask_code
```

---

## Features

### 🎯 Interactive Results

- **Click to open files**: Click on any search result to open the file at the exact line
- **Rich formatting**: Results show function/class type, file path, similarity score, and documentation
- **Live updates**: Results panel updates dynamically as you search

### 🔄 Pipeline Management

- **Automatic configuration**: No need to edit settings.json manually
- **Workspace state**: Each workspace remembers its indexed repository
- **Easy switching**: Index multiple repositories and switch between them

### 📊 Visual Feedback

- **Progress indicators**: See indexing progress in real-time
- **Status commands**: Check which repository is currently active
- **Error handling**: Clear error messages with guidance

---

## Packaging for Distribution

```bash
# Install vsce globally
npm install -g @vscode/vsce

# Package the extension
vsce package

# This creates devcopilot-extension-0.1.0.vsix
```

## Installing the Packaged Extension

```bash
code --install-extension devcopilot-extension-0.1.0.vsix
```

Or in VS Code:
1. Open Extensions view (`Ctrl+Shift+X`)
2. Click "..." menu > "Install from VSIX..."
3. Select the `.vsix` file

## Troubleshooting

### Extension Not Activating
- Check Output panel: View > Output > select "DevCopilot" or "Extension Host"
- Verify compilation: `npm run compile`

### Python CLI Not Found
- Ensure `devcopilot.cliPath` is an absolute path
- Test CLI independently: `python cli.py version`

### Search Returns No Results
- Verify collection exists: `python cli.py stats --db data/chroma_db --collection flask_code`
- Re-index if necessary: `python cli.py index --repo ./flask --force`

## Next Steps

1. Customize extension icon and branding
2. Add more commands (e.g., "Index Current Workspace")
3. Implement JSON output mode in CLI for better parsing
4. Add webview interaction (click to open file at line)
5. Publish to VS Code Marketplace
