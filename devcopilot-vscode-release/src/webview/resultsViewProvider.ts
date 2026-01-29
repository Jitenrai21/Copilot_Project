import * as vscode from 'vscode';

import * as path from 'path';
import { simpleMarkdownToHtml } from './simpleMarkdownToHtml';

export class ResultsViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'devcopilotV3.resultsView';
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        console.log('DevCopilot v3: resolveWebviewView called - view is being initialized');
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getInitialHtml();

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'openFile':
                    await this._openFileAtLine(message.filePath, message.line);
                    break;
                case 'retrySummarization':
                    await this._retrySummarization(message.repoPath, message.timeout);
                    break;
                case 'showCliCommand':
                    await this._showCliCommand(message.cliCommand);
                    break;
            }
        });
    }

    private async _openFileAtLine(filePath: string, line?: number) {
        try {
            // Convert relative path to absolute if needed
            let absolutePath = filePath;
            if (!path.isAbsolute(filePath)) {
                const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                if (workspaceRoot) {
                    absolutePath = path.join(workspaceRoot, filePath);
                }
            }

            const uri = vscode.Uri.file(absolutePath);
            const document = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(document);

            if (line !== undefined && line > 0) {
                const position = new vscode.Position(line - 1, 0);
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(
                    new vscode.Range(position, position),
                    vscode.TextEditorRevealType.InCenter
                );
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open file: ${error}`);
        }
    }

    public showSearchResults(query: string, results: any[]) {
        console.log(`DevCopilot v2: showSearchResults called with ${results.length} results`);
        if (this._view) {
            console.log('DevCopilot v2: View exists, updating HTML');
            this._view.show?.(true);
            this._view.webview.html = this._getSearchResultsHtml(query, results);
        } else {
            console.error('DevCopilot v2: View not initialized! The webview panel may not be open.');
            vscode.window.showErrorMessage('DevCopilot v2 Results panel is not initialized. Try opening the panel from the Explorer sidebar first.');
        }
    }

    public showRagResults(query: string, answer: string, sources: any[]) {
        console.log(`DevCopilot v2: showRagResults called with answer length ${answer.length} and ${sources.length} sources`);
        console.log('DevCopilot v2: Answer preview (first 200 chars):', answer.substring(0, 200));
        console.log('DevCopilot v2: Sources array:', JSON.stringify(sources, null, 2));
        
        if (this._view) {
            console.log('DevCopilot v2: View exists, updating HTML');
            this._view.show?.(true);
            this._view.webview.html = this._getRagResultsHtml(query, answer, sources);
        } else {
            console.error('DevCopilot v2: View not initialized! The webview panel may not be open.');
            vscode.window.showErrorMessage('DevCopilot v2 Results panel is not initialized. Try opening the panel from the Explorer sidebar first.');
        }
    }

    public showPRSummary(summary: string, repoPath?: string, timeout?: number) {
        console.log(`DevCopilot v2: showPRSummary called with summary length ${summary.length}`);
        if (this._view) {
            console.log('DevCopilot v2: View exists, updating HTML');
            this._view.show?.(true);
            this._view.webview.html = this._getPRSummaryHtml(summary, repoPath, timeout);
        } else {
            console.error('DevCopilot v2: View not initialized! The webview panel may not be open.');
            vscode.window.showErrorMessage('DevCopilot v2 Results panel is not initialized. Try opening the panel from the Explorer sidebar first.');
        }
    }

    public showError(title: string, message: string, repoPath?: string, timeout?: number, cliCommand?: string) {
        if (this._view) {
            this._view.show?.(true);
            this._view.webview.html = this._getErrorHtml(title, message, repoPath, timeout, cliCommand);
        }
    }

    private _getInitialHtml(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DevCopilot Results</title>
    <style>
        body {
            padding: 10px;
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        .welcome {
            text-align: center;
            padding: 40px 20px;
        }
        .welcome h2 {
            color: var(--vscode-textLink-foreground);
        }
        .welcome p {
            color: var(--vscode-descriptionForeground);
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="welcome">
        <h2>🔍 DevCopilot</h2>
        <p>Use the command palette to:</p>
        <p><strong>Search Codebase</strong> - Semantic code search</p>
        <p><strong>Summarize PR</strong> - Generate PR summary</p>
    </div>
</body>
</html>`;
    }

    private _getSearchResultsHtml(query: string, results: any[]): string {
        const resultsHtml = results.map((result, index) => `
            <div class="result-card">
                <div class="result-header">
                    <span class="result-number">${index + 1}</span>
                    <span class="result-type">${result.type.toUpperCase()}</span>
                    <strong class="result-name">${this._escapeHtml(result.name)}</strong>
                </div>
                <div class="result-meta">
                    <div class="meta-item">
                        📄 <a href="#" class="file-link" data-file="${this._escapeHtml(result.file_path || '')}" data-line="${result.start_line || 0}">
                            <code>${this._escapeHtml(result.file_path || 'N/A')}</code>
                            ${result.start_line ? `<span class="line-range">:${result.start_line}-${result.end_line}</span>` : ''}
                        </a>
                    </div>
                    ${result.similarity ? `
                    <div class="meta-item">
                        📊 Similarity: <span class="similarity">${(result.similarity * 100).toFixed(1)}%</span>
                    </div>
                    ` : ''}
                </div>
                ${result.docstring ? `
                <div class="result-doc">
                    📝 ${this._escapeHtml(result.docstring)}
                </div>
                ` : ''}
            </div>
        `).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Search Results</title>
    <style>
        body {
            padding: 10px;
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        h2 {
            color: var(--vscode-textLink-foreground);
            margin-bottom: 5px;
        }
        .query {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            margin-bottom: 20px;
        }
        .result-count {
            color: var(--vscode-charts-green);
            font-weight: bold;
            margin-bottom: 15px;
        }
        .result-card {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 12px;
            margin-bottom: 15px;
        }
        .result-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        }
        .result-number {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 12px;
            font-weight: bold;
        }
        .result-type {
            color: var(--vscode-symbolIcon-functionForeground);
            font-size: 11px;
            font-weight: bold;
        }
        .result-name {
            color: var(--vscode-editor-foreground);
        }
        .result-meta {
            margin-bottom: 8px;
        }
        .meta-item {
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
            margin: 4px 0;
        }
        .line-range {
            color: var(--vscode-textLink-foreground);
        }
        .similarity {
            color: var(--vscode-charts-green);
            font-weight: bold;
        }
        .result-doc {
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid var(--vscode-panel-border);
        }
        code {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 4px;
            border-radius: 3px;
            font-size: 12px;
        }
        .file-link {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
            cursor: pointer;
        }
        .file-link:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <h2>🔍 Search Results</h2>
    <div class="query">"${this._escapeHtml(query)}"</div>
    <div class="result-count">Found ${results.length} results</div>
    ${resultsHtml}
    
    <script>
        const vscode = acquireVsCodeApi();
        
        // Add click handlers to file links
        document.querySelectorAll('.file-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const filePath = link.getAttribute('data-file');
                const line = parseInt(link.getAttribute('data-line') || '0');
                vscode.postMessage({
                    command: 'openFile',
                    filePath: filePath,
                    line: line
                });
            });
        });
    </script>
</body>
</html>`;
    }

    private _getRagResultsHtml(query: string, answer: string, sources: any[]): string {
        // Use the markdown-to-HTML converter for the answer
        const formattedAnswer = simpleMarkdownToHtml(answer);

        // TEMPORARILY set threshold to 0.0 for debugging - will show all sources with similarity values
        const RELEVANCE_THRESHOLD = 0.0;
        console.log('DEBUG: Filtering sources with threshold', RELEVANCE_THRESHOLD);
        console.log('DEBUG: Sources before filtering:', sources.length, sources.map(s => ({ name: s.name, similarity: s.similarity, type: typeof s.similarity })));
        const relevantSources = sources.filter(s => typeof s.similarity === 'number' && s.similarity >= RELEVANCE_THRESHOLD);
        console.log('DEBUG: Sources after filtering:', relevantSources.length);

        let sourcesHtml = '';
        if (relevantSources.length === 0) {
            sourcesHtml = `<div class="no-sources">No highly relevant code sections found.</div>`;
        } else {
            sourcesHtml = relevantSources.map((source, index) => `
                <div class="source-card">
                    <div class="source-header">
                        <span class="source-number">${index + 1}</span>
                        <strong class="source-name">${this._escapeHtml(source.name)}</strong>
                        <span class="source-type">${source.type ? source.type.toUpperCase() : ''}</span>
                    </div>
                    <div class="source-meta">
                        <div class="meta-item">
                            📄 <a href="#" class="file-link" data-file="${this._escapeHtml(source.file_path || '')}" data-line="${source.start_line || 0}">
                                <code>${this._escapeHtml(source.file_path || 'N/A')}</code>
                                ${source.start_line ? `<span class="line-range">:${source.start_line}-${source.end_line}</span>` : ''}
                            </a>
                        </div>
                        ${source.similarity ? `
                        <div class="meta-item">
                            📊 Relevance: <span class="similarity">${(source.similarity * 100).toFixed(1)}%</span>
                        </div>
                        ` : ''}
                    </div>
                    ${source.docstring ? `
                    <div class="source-doc">
                        📝 ${this._escapeHtml(source.docstring)}
                    </div>
                    ` : ''}
                </div>
            `).join('');
        }

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RAG Query Results</title>
    <style>
        body {
            padding: 10px;
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        h2 {
            color: var(--vscode-textLink-foreground);
            margin-bottom: 5px;
        }
        .query {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            margin-bottom: 20px;
        }
        .answer-section {
            background: linear-gradient(135deg, var(--vscode-editor-selectionBackground) 0%, var(--vscode-editor-inactiveSelectionBackground) 100%);
            border-left: 5px solid var(--vscode-charts-blue);
            padding: 20px;
            margin-bottom: 30px;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        .answer-label {
            color: var(--vscode-charts-blue);
            font-weight: bold;
            font-size: 16px;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .answer-content {
            color: var(--vscode-editor-foreground);
            line-height: 1.8;
            font-size: 14px;
        }
        .answer-content p {
            margin: 12px 0;
        }
        .answer-content ul {
            margin: 12px 0;
            padding-left: 24px;
        }
        .answer-content li {
            margin: 8px 0;
            line-height: 1.6;
        }
        .answer-content strong {
            color: var(--vscode-textLink-activeForeground);
            font-weight: 600;
        }
        .answer-content code {
            background-color: var(--vscode-textCodeBlock-background);
            color: var(--vscode-textPreformat-foreground);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
            font-size: 13px;
        }
        .answer-content em {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }
        .sources-section {
            margin-top: 25px;
        }
        .sources-label {
            color: var(--vscode-textLink-foreground);
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .source-count {
            color: var(--vscode-charts-green);
            font-weight: bold;
            margin-bottom: 15px;
        }
        .no-sources {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            margin-bottom: 15px;
        }
        .source-card {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 12px;
            margin-bottom: 12px;
        }
        .source-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        }
        .source-number {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 12px;
            font-weight: bold;
        }
        .source-type {
            color: var(--vscode-symbolIcon-functionForeground);
            font-size: 11px;
            font-weight: bold;
        }
        .source-name {
            color: var(--vscode-editor-foreground);
        }
        .source-meta {
            margin-bottom: 8px;
        }
        .meta-item {
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
            margin: 4px 0;
        }
        .line-range {
            color: var(--vscode-textLink-foreground);
        }
        .similarity {
            color: var(--vscode-charts-green);
            font-weight: bold;
        }
        .source-doc {
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid var(--vscode-panel-border);
        }
        code {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 4px;
            border-radius: 3px;
            font-size: 12px;
        }
        .file-link {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
            cursor: pointer;
        }
        .file-link:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <h2>💬 RAG Query Results</h2>
    <div class="query">"${this._escapeHtml(query)}"</div>
    
    <div class="answer-section">
        <div class="answer-label">✨ Answer</div>
        <div class="answer-content">${formattedAnswer}</div>
    </div>
    
    <div class="sources-section">
        <div class="sources-label">📚 Supporting Sources</div>
        <div class="source-count">${relevantSources.length} relevant code section${relevantSources.length === 1 ? '' : 's'}</div>
        ${sourcesHtml}
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        // Add click handlers to file links
        document.querySelectorAll('.file-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const filePath = link.getAttribute('data-file');
                const line = parseInt(link.getAttribute('data-line') || '0');
                vscode.postMessage({
                    command: 'openFile',
                    filePath: filePath,
                    line: line
                });
            });
        });
    </script>
</body>
</html>`;
    }

    private _formatAnswer(answer: string): string {
        // Format the answer with proper HTML structure for better readability
        let formatted = this._escapeHtml(answer);
        
        // Convert bullet points (lines starting with * or -) to HTML list items
        const lines = formatted.split(/\n/);
        let inList = false;
        let result = '';
        
        for (let line of lines) {
            const trimmed = line.trim();
            
            // Check if line starts with a bullet point
            if (trimmed.match(/^[*-]\s+/)) {
                if (!inList) {
                    result += '<ul>';
                    inList = true;
                }
                // Remove the bullet character and add as list item
                const content = trimmed.replace(/^[*-]\s+/, '');
                result += `<li>${content}</li>`;
            } else if (trimmed === '') {
                // Close list on empty line
                if (inList) {
                    result += '</ul>';
                    inList = false;
                }
                // Add paragraph break for empty lines
                if (result.length > 0 && !result.endsWith('<ul>')) {
                    result += '</p><p>';
                }
            } else {
                // Close list if we were in one
                if (inList) {
                    result += '</ul>';
                    inList = false;
                }
                // Add regular text
                if (result.length === 0 || result.endsWith('</p>') || result.endsWith('</ul>')) {
                    result += '<p>' + trimmed;
                } else {
                    result += ' ' + trimmed;
                }
            }
        }
        
        // Close any open list
        if (inList) {
            result += '</ul>';
        }
        
        // Close final paragraph if open
        if (result.length > 0 && !result.endsWith('</p>') && !result.endsWith('</ul>')) {
            result += '</p>';
        }
        
        // Enhance inline code snippets (text in backticks)
        result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // Make **bold** text stand out
        result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        
        // Make *italic* text italic
        result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        
        return result || '<p>No answer generated.</p>';
    }

    private _getPRSummaryHtml(summary: string, repoPath?: string, timeout?: number): string {
        // Parse the summary output into structured sections
        const parsed = this._parsePRSummary(summary);
        
        // Build HTML sections
        let html = '';
        
        // Main PR Summary Card
        if (parsed.meta.branch || parsed.meta.commits || parsed.meta.changedFiles) {
            html += this._buildMainSummaryCard(parsed);
        }
        
        // File-specific change cards
        if (parsed.fileChanges.length > 0) {
            html += this._buildFileChangeCards(parsed.fileChanges);
        }
        
        // Overall PR summary card
        if (parsed.overallSummary) {
            html += this._buildOverallSummaryCard(parsed.overallSummary);
        }
        
        // Pipeline info (optional, can be collapsible)
        if (parsed.pipelineInfo) {
            html += this._buildPipelineInfoCard(parsed.pipelineInfo);
        }
        
        return this._wrapInHtmlDocument(html);
    }

    /**
     * Parse the CLI output into structured data
     */
    private _parsePRSummary(summary: string): any {
        const lines = summary.split('\n');
        const result: any = {
            meta: { branch: '', commits: 0, changedFiles: 0 },
            commitHistory: [],
            fileChanges: [],
            overallSummary: '',
            pipelineInfo: '',
            warnings: []
        };
        
        let currentSection = 'header';
        let currentFileChange: any = null;
        let fileChangeContent = '';
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            
            // Skip empty lines and separator lines
            if (!trimmed || trimmed.match(/^=+$/)) {
                continue;
            }
            
            // Parse meta information
            if (trimmed.startsWith('Branch:')) {
                result.meta.branch = trimmed.substring(7).trim();
            } else if (trimmed.startsWith('Commits:')) {
                result.meta.commits = parseInt(trimmed.substring(8).trim()) || 0;
            } else if (trimmed.startsWith('Changed files:')) {
                result.meta.changedFiles = parseInt(trimmed.substring(14).trim()) || 0;
            }
            // Parse commit history
            else if (trimmed.match(/^•\s+[0-9a-f]{8}\s+-/)) {
                result.commitHistory.push(trimmed);
            }
            // Detect file change sections (box with 🔹)
            else if (trimmed.match(/^┌.*🔹\s+(.+?)\s+─*┐/)) {
                // Save previous file change if exists
                if (currentFileChange) {
                    currentFileChange.content = fileChangeContent.trim();
                    result.fileChanges.push(currentFileChange);
                }
                
                // Extract filename
                const fileMatch = trimmed.match(/🔹\s+(.+?)\s+─/);
                const filename = fileMatch ? fileMatch[1].trim() : 'Unknown file';
                
                currentFileChange = {
                    filename: filename,
                    content: ''
                };
                fileChangeContent = '';
                currentSection = 'fileChange';
            }
            // Inside a file change box
            else if (currentSection === 'fileChange' && line.match(/^│/)) {
                // Remove box characters and add to content
                const content = line.replace(/^│\s*/, '').replace(/\s*│$/, '').trim();
                if (content) {
                    fileChangeContent += content + ' ';
                }
            }
            // End of file change box
            else if (currentSection === 'fileChange' && line.match(/^└/)) {
                if (currentFileChange) {
                    currentFileChange.content = fileChangeContent.trim();
                    result.fileChanges.push(currentFileChange);
                    currentFileChange = null;
                    fileChangeContent = '';
                }
                currentSection = 'between';
            }
            // Overall PR Summary section
            else if (trimmed.startsWith('📝 Overall PR Summary:')) {
                currentSection = 'overallSummary';
            }
            else if (currentSection === 'overallSummary' && trimmed && !trimmed.match(/^[┌└─│]+$/)) {
                result.overallSummary += trimmed + ' ';
            }
            // Pipeline info section
            else if (trimmed.includes('PR SUMMARIZATION PIPELINE') || trimmed.match(/^\[\d+\/\d+\]/)) {
                currentSection = 'pipeline';
                result.pipelineInfo += trimmed + '\n';
            }
            else if (currentSection === 'pipeline') {
                result.pipelineInfo += trimmed + '\n';
            }
            // Warnings
            else if (trimmed.startsWith('⚠️')) {
                result.warnings.push(trimmed);
            }
        }
        
        // Clean up overall summary
        result.overallSummary = result.overallSummary.trim();
        result.pipelineInfo = result.pipelineInfo.trim();
        
        return result;
    }

    /**
     * Build the main PR summary card with metadata
     */
    private _buildMainSummaryCard(parsed: any): string {
        let commitsHtml = '';
        if (parsed.commitHistory.length > 0) {
            commitsHtml = '<div class="commits-section"><h3>Recent Commits</h3><ul class="commit-list">';
            parsed.commitHistory.forEach((commit: string) => {
                commitsHtml += `<li class="commit-item">${this._escapeHtml(commit.substring(1).trim())}</li>`;
            });
            commitsHtml += '</ul></div>';
        }
        
        return `
        <div class="summary-card">
            <h2>📝 Pull Request Summary</h2>
            <div class="meta-section">
                <div class="meta-item"><strong>Branch:</strong> ${this._escapeHtml(parsed.meta.branch)}</div>
                <div class="meta-item"><strong>Commits:</strong> ${parsed.meta.commits}</div>
                <div class="meta-item"><strong>Changed files:</strong> ${parsed.meta.changedFiles}</div>
            </div>
            ${commitsHtml}
        </div>`;
    }

    /**
     * Build individual cards for each file change
     */
    private _buildFileChangeCards(fileChanges: any[]): string {
        let html = '<div class="file-changes-container">';
        html += '<h2 class="section-title">📂 File Changes</h2>';
        
        fileChanges.forEach((fileChange: any) => {
            html += `
            <div class="file-card">
                <div class="file-header">
                    <span class="file-icon">🔹</span>
                    <span class="file-name">${this._escapeHtml(fileChange.filename)}</span>
                </div>
                <div class="file-summary">
                    ${this._escapeHtml(fileChange.content)}
                </div>
            </div>`;
        });
        
        html += '</div>';
        return html;
    }

    /**
     * Build the overall PR summary card
     */
    private _buildOverallSummaryCard(summary: string): string {
        return `
        <div class="summary-card overall-summary-card">
            <h2>💡 Overall Summary</h2>
            <p class="overall-summary-text">${this._escapeHtml(summary)}</p>
        </div>`;
    }

    /**
     * Build the pipeline info card (collapsible)
     */
    private _buildPipelineInfoCard(pipelineInfo: string): string {
        if (!pipelineInfo) return '';
        
        return `
        <details class="pipeline-details">
            <summary class="pipeline-summary">⚙️ Pipeline Details</summary>
            <div class="pipeline-content">
                <pre><code>${this._escapeHtml(pipelineInfo)}</code></pre>
            </div>
        </details>`;
    }

    /**
     * Wrap content in full HTML document with styles
     */
    private _wrapInHtmlDocument(content: string): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PR Summary</title>
    <style>
        body {
            padding: 16px;
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            line-height: 1.6;
        }
        
        /* Card styles */
        .summary-card {
            background: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 16px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .file-card {
            background: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .file-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        /* Headers */
        h2 {
            color: var(--vscode-textLink-foreground);
            margin: 0 0 16px 0;
            font-size: 1.4em;
            font-weight: 600;
        }
        
        h3 {
            color: var(--vscode-textLink-activeForeground);
            margin: 16px 0 12px 0;
            font-size: 1.1em;
            font-weight: 500;
        }
        
        .section-title {
            color: var(--vscode-textLink-foreground);
            margin: 24px 0 16px 0;
            font-size: 1.3em;
            font-weight: 600;
        }
        
        /* Meta section */
        .meta-section {
            background: var(--vscode-textCodeBlock-background);
            border-left: 3px solid var(--vscode-textLink-foreground);
            padding: 12px 16px;
            margin-bottom: 16px;
            border-radius: 4px;
        }
        
        .meta-item {
            margin: 6px 0;
            font-size: 0.95em;
        }
        
        .meta-item strong {
            color: var(--vscode-textLink-foreground);
            font-weight: 600;
        }
        
        /* File header */
        .file-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 12px;
            padding-bottom: 10px;
            border-bottom: 2px solid var(--vscode-panel-border);
        }
        
        .file-icon {
            font-size: 1.2em;
        }
        
        .file-name {
            font-family: var(--vscode-editor-font-family);
            font-size: 1.05em;
            font-weight: 600;
            color: var(--vscode-textLink-activeForeground);
        }
        
        /* File summary content */
        .file-summary {
            font-size: 0.95em;
            line-height: 1.6;
            color: var(--vscode-descriptionForeground);
            padding: 8px 0;
        }
        
        /* Commits section */
        .commits-section {
            margin-top: 16px;
        }
        
        .commit-list {
            list-style: none;
            padding: 0;
            margin: 8px 0;
        }
        
        .commit-item {
            padding: 8px 12px;
            margin: 4px 0;
            background: var(--vscode-textCodeBlock-background);
            border-left: 3px solid var(--vscode-charts-blue);
            border-radius: 4px;
            font-family: var(--vscode-editor-font-family);
            font-size: 0.9em;
            color: var(--vscode-descriptionForeground);
        }
        
        /* Overall summary */
        .overall-summary-card {
            background: linear-gradient(135deg, 
                var(--vscode-editor-inactiveSelectionBackground) 0%, 
                var(--vscode-editor-selectionBackground) 100%);
        }
        
        .overall-summary-text {
            font-size: 1.05em;
            line-height: 1.7;
            margin: 0;
            padding: 8px 0;
        }
        
        /* File changes container */
        .file-changes-container {
            margin: 16px 0;
        }
        
        /* Pipeline details (collapsible) */
        .pipeline-details {
            background: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 12px;
            margin-top: 16px;
        }
        
        .pipeline-summary {
            cursor: pointer;
            font-weight: 600;
            color: var(--vscode-textLink-foreground);
            font-size: 1.05em;
            list-style: none;
            user-select: none;
        }
        
        .pipeline-summary::-webkit-details-marker {
            display: none;
        }
        
        .pipeline-summary::before {
            content: '▶ ';
            display: inline-block;
            transition: transform 0.2s;
        }
        
        .pipeline-details[open] .pipeline-summary::before {
            transform: rotate(90deg);
        }
        
        .pipeline-content {
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid var(--vscode-panel-border);
        }
        
        .pipeline-content pre {
            margin: 0;
            font-size: 0.85em;
            line-height: 1.4;
            overflow-x: auto;
        }
        
        .pipeline-content code {
            font-family: var(--vscode-editor-font-family);
            color: var(--vscode-descriptionForeground);
        }
        
        /* Success badge */
        .success-badge {
            display: inline-block;
            background: var(--vscode-testing-iconPassed);
            color: var(--vscode-editor-background);
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.9em;
            font-weight: 500;
            margin-bottom: 12px;
        }
        
        /* Warning section */
        .warning-section {
            background: var(--vscode-inputValidation-warningBackground);
            border-left: 3px solid var(--vscode-inputValidation-warningBorder);
            padding: 12px;
            margin: 16px 0;
            border-radius: 4px;
        }
        
        .warning-item {
            color: var(--vscode-inputValidation-warningForeground);
            font-weight: 500;
            margin-bottom: 8px;
        }
        
        /* Responsive adjustments */
        @media (max-width: 600px) {
            body {
                padding: 12px;
            }
            
            .summary-card, .file-card {
                padding: 16px;
            }
            
            h2 {
                font-size: 1.2em;
            }
            
            .section-title {
                font-size: 1.15em;
            }
        }
    </style>
</head>
<body>
    ${content}
    <script>
        const vscode = acquireVsCodeApi();
    </script>
</body>
</html>`;
    }

    private _getErrorHtml(title: string, message: string, repoPath?: string, timeout?: number, cliCommand?: string): string {
        // Check if this is a timeout error
        const isTimeout = message.toLowerCase().includes('timeout') || title.toLowerCase().includes('timeout');
        const newTimeout = timeout ? timeout * 2 : 600; // Double the timeout or default to 600s
        
        const actionButtons = isTimeout && repoPath ? `
            <div class="action-buttons">
                <button class="btn btn-primary" onclick="retryWithTimeout()">
                    🔄 Retry with Longer Timeout (${newTimeout}s)
                </button>
                <button class="btn btn-secondary" onclick="openRepo()">
                    📂 Open Repository
                </button>
                ${cliCommand ? `<button class="btn btn-secondary" onclick="showCliCommand()">
                    💻 Show CLI Command
                </button>` : ''}
            </div>
        ` : '';
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error</title>
    <style>
        body {
            padding: 16px;
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        .error-card {
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 2px solid var(--vscode-inputValidation-errorBorder);
            border-radius: 8px;
            padding: 20px;
            margin: 10px 0;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }
        .error-title {
            color: var(--vscode-errorForeground);
            font-weight: 600;
            font-size: 1.2em;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .error-message {
            color: var(--vscode-foreground);
            font-family: var(--vscode-editor-font-family);
            font-size: 0.95em;
            line-height: 1.6;
            margin-bottom: 20px;
            padding: 12px;
            background: var(--vscode-textCodeBlock-background);
            border-radius: 4px;
        }
        .action-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 16px;
        }
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            font-size: 0.9em;
            font-weight: 500;
            cursor: pointer;
            transition: opacity 0.2s;
            font-family: var(--vscode-font-family);
        }
        .btn:hover {
            opacity: 0.8;
        }
        .btn-primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .info-text {
            margin-top: 12px;
            padding: 10px;
            background: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-textLink-foreground);
            font-size: 0.9em;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="error-card">
        <div class="error-title">❌ ${this._escapeHtml(title)}</div>
        <div class="error-message">${this._escapeHtml(message)}</div>
        ${actionButtons}
        ${isTimeout ? '<div class="info-text">💡 <strong>Tip:</strong> Timeout errors can occur with large PRs or slow LLM responses. Retrying with a longer timeout often resolves the issue.</div>' : ''}
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        
        function retryWithTimeout() {
            vscode.postMessage({
                command: 'retrySummarization',
                repoPath: '${repoPath ? this._escapeHtml(repoPath) : ''}',
                timeout: ${newTimeout}
            });
        }
        
        function openRepo() {
            vscode.postMessage({
                command: 'openFile',
                filePath: '${repoPath ? this._escapeHtml(repoPath) : ''}'
            });
        }
        
        function showCliCommand() {
            vscode.postMessage({
                command: 'showCliCommand',
                cliCommand: '${cliCommand ? this._escapeHtml(cliCommand) : ''}'
            });
        }
    </script>
</body>
</html>`;
    }

    private _escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Handle retry summarization request from webview
     */
    private async _retrySummarization(repoPath: string, timeout: number) {
        if (!repoPath) {
            vscode.window.showErrorMessage('Repository path not available for retry');
            return;
        }

        // Show progress indicator
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Retrying PR summarization with ${timeout}s timeout...`,
            cancellable: false
        }, async () => {
            try {
                // Trigger the summarize command with the new timeout
                await vscode.commands.executeCommand('devcopilotV3.summarizePR', repoPath, timeout);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Retry failed: ${errorMessage}`);
            }
        });
    }

    /**
     * Handle show CLI command request from webview
     */
    private async _showCliCommand(cliCommand: string) {
        if (!cliCommand) {
            return;
        }

        const action = await vscode.window.showInformationMessage(
            'CLI Command',
            { modal: true, detail: cliCommand },
            'Copy to Clipboard',
            'Close'
        );

        if (action === 'Copy to Clipboard') {
            await vscode.env.clipboard.writeText(cliCommand);
            vscode.window.showInformationMessage('Command copied to clipboard');
        }
    }
}
