import * as vscode from 'vscode';
import { searchCode } from '../cliIntegration';
import { ResultsViewProvider } from '../webview/resultsViewProvider';
import { StateManager } from '../stateManager';

export async function searchCodeCommand(resultsProvider: ResultsViewProvider, stateManager: StateManager) {
    // Check if pipeline is configured
    if (!stateManager.isPipelineConfigured()) {
        const action = await vscode.window.showWarningMessage(
            'No repository is indexed yet. Would you like to index one now?',
            'Index Repository',
            'Cancel'
        );
        if (action === 'Index Repository') {
            vscode.commands.executeCommand('devcopilot.indexRepository');
        }
        return;
    }

    // Prompt user for search query
    const query = await vscode.window.showInputBox({
        prompt: 'Enter your code search query',
        placeHolder: 'e.g., "how does Flask handle routing"'
    });

    if (!query) {
        return;
    }

    // Show progress
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Searching codebase...',
        cancellable: false
    }, async () => {
        try {
            const results = await searchCode(query, 10, stateManager);
            
            console.log(`Search returned ${results.length} results`);
            
            if (results.length === 0) {
                vscode.window.showInformationMessage('No results found.');
                return;
            }

            // Display results in webview
            resultsProvider.showSearchResults(query, results);
            
            // Focus the webview
            vscode.commands.executeCommand('devcopilot.resultsView.focus');
            
            vscode.window.showInformationMessage(`Found ${results.length} results. Check the DevCopilot Results panel in the Explorer sidebar.`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Search failed: ${errorMessage}`);
            
            // Show error in webview
            resultsProvider.showError('Search Error', errorMessage);
        }
    });
}
