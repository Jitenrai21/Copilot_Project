import * as vscode from 'vscode';
import { summarizePR } from '../cliIntegration';
import { ResultsViewProvider } from '../webview/resultsViewProvider';
import { StateManager } from '../stateManager';
import { ApiKeyManager } from '../apiKeyManager';

export async function summarizePRCommand(resultsProvider: ResultsViewProvider, stateManager: StateManager, apiKeyManager: ApiKeyManager, providedRepoPath?: string, providedTimeout?: number) {
    // Use provided repo path (from retry), configured repo path, or workspace root
    let repoPath: string | undefined = providedRepoPath;
    
    if (!repoPath && stateManager.isPipelineConfigured()) {
        repoPath = stateManager.getRepoPath();
    } else if (!repoPath) {
        repoPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }
    
    if (!repoPath) {
        const action = await vscode.window.showWarningMessage(
            'No repository configured. Would you like to index one now?',
            'Index Repository',
            'Cancel'
        );
        if (action === 'Index Repository') {
            vscode.commands.executeCommand('devcopilotV3.indexRepository');
        }
        return;
    }

    // Default timeout to 300 seconds if not provided
    const timeout = providedTimeout || 300;

    // Show progress
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Summarizing PR${providedTimeout ? ` with ${timeout}s timeout` : ''}...`,
        cancellable: false
    }, async () => {
        try {
            // Get API key
            const apiKey = await apiKeyManager.getApiKeyWithPrompt();
            if (!apiKey) {
                vscode.window.showWarningMessage('Summarization cancelled: No API key configured');
                return;
            }
            
            const summary = await summarizePR(stateManager, repoPath, timeout, apiKey);
            
            // Display summary in webview with repo path and timeout for potential retry
            resultsProvider.showPRSummary(summary, repoPath, timeout);
            
            vscode.window.showInformationMessage('PR summary generated successfully');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`PR summarization failed: ${errorMessage}`);
            
            // Build CLI command for "Show CLI Command" button
            const cliCommand = `python cli.py summarize --repo "${repoPath}" --timeout ${timeout * 2} --verbose`;
            
            // Show error in webview with retry options
            resultsProvider.showError('PR Summarization Error', errorMessage, repoPath, timeout, cliCommand);
        }
    });
}
