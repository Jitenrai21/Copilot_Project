# DevCopilot Extension - Quick Test Guide

## Prerequisites Check

Before testing, ensure:
- ✅ Python environment is set up at `D:\dev-copilot\env`
- ✅ CLI is available at `D:\dev-copilot\cli.py`
- ✅ Extension compiled successfully (`npm run compile`)

## Testing Instructions

### 1. Launch Extension

1. Open VS Code with the `vscode-extension` folder
2. Press `F5` to launch Extension Development Host
3. A new VS Code window opens with the extension loaded

### 2. Test Index Repository

1. In the Extension Development Host, press `Ctrl+Shift+P`
2. Type: `DevCopilot: Index Repository`
3. Select a folder (e.g., your Flask repository or any Python project)
4. Confirm the indexing operation
5. **Expected**: Progress notification appears, indexing completes successfully

**Verification**:
- Check that `.devcopilot/chroma_db` folder is created inside the selected repo
- Notification shows "Successfully indexed [repo name]!"

### 3. Test Search Codebase

1. Press `Ctrl+Shift+P`
2. Type: `DevCopilot: Search Codebase`
3. Enter a search query (e.g., "routing" or "authentication")
4. **Expected**: Results appear in the DevCopilot Results panel in the Explorer sidebar

**Verification**:
- Results show function/class names
- File paths are displayed
- Similarity scores are shown
- Results are formatted nicely

### 4. Test Interactive Navigation

1. In the DevCopilot Results panel, **click on any file path link**
2. **Expected**: 
   - File opens in editor
   - Cursor jumps to the specific line number
   - Line is highlighted and centered

**Verification**:
- File opens at correct location
- No errors in console

### 5. Test Pipeline Status

1. Press `Ctrl+Shift+P`
2. Type: `DevCopilot: Show Pipeline Status`
3. **Expected**: Message shows current repository and collection information

**Verification**:
- Displays the indexed repository path
- Shows the collection name

### 6. Test Summarize PR (if git repo)

1. Press `Ctrl+Shift+P`
2. Type: `DevCopilot: Summarize PR`
3. **Expected**: PR summary appears in DevCopilot Results panel

**Verification**:
- Summary is formatted
- Shows changed files and descriptions

### 7. Test Workspace State Persistence

1. Close the Extension Development Host
2. Press `F5` again to relaunch
3. Press `Ctrl+Shift+P` → `DevCopilot: Show Pipeline Status`
4. **Expected**: Still shows the previously indexed repository

**Verification**:
- Workspace state is preserved
- No need to re-index

### 8. Test No-Config Prompt

1. In Extension Development Host, open a **different** workspace (not the indexed one)
2. Press `Ctrl+Shift+P` → `DevCopilot: Search Codebase`
3. **Expected**: Warning message prompts to index a repository first

**Verification**:
- Clear guidance to user
- Option to index repository

## Debug Console

To see debug output:
1. In the Extension Development Host, go to **View → Output**
2. Select **DevCopilot** or **Extension Host** from dropdown
3. Look for messages like:
   - `Parsed X results from CLI output`
   - `=== RAW CLI OUTPUT ===`

## Common Issues and Solutions

### Issue: "No results found" after search

**Solution**:
1. Check Output panel for CLI errors
2. Verify the collection was created (check `.devcopilot/chroma_db` folder)
3. Try re-indexing with "Index Repository" command

### Issue: Clicking results doesn't open file

**Solution**:
1. Check browser console in Developer Tools (`Help → Toggle Developer Tools`)
2. Look for JavaScript errors
3. Verify file paths are not relative to wrong directory

### Issue: Indexing fails

**Solution**:
1. Check Python environment is activated
2. Verify CLI path in settings
3. Check Output panel for detailed error
4. Ensure repository has Python files to index

### Issue: Extension doesn't activate

**Solution**:
1. Check Developer Tools console for errors
2. Verify compilation succeeded (`npm run compile`)
3. Look for TypeScript errors in Problems panel

## Success Criteria

All features working if:
- ✅ Repository indexes successfully
- ✅ Search returns relevant results
- ✅ Clicking results opens files at correct lines
- ✅ Pipeline status shows current configuration
- ✅ Workspace state persists across sessions
- ✅ Error messages are clear and helpful

## Next Steps After Testing

1. **Package the extension**: `vsce package`
2. **Install locally**: `code --install-extension devcopilot-extension-0.1.0.vsix`
3. **Share with team** for feedback
4. **Consider publishing** to VS Code Marketplace

## Feedback Collection

When testing, note:
- Is the workflow intuitive?
- Are error messages helpful?
- Is navigation smooth?
- Are results formatted well?
- Any missing features?
- Performance issues?

Happy testing! 🚀
