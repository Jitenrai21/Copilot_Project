import * as vscode from 'vscode';
import { searchCodeHyde } from '../cliIntegration';
import { ResultsViewProvider } from '../webview/resultsViewProvider';
import { StateManager } from '../stateManager';
import { ApiKeyManager } from '../apiKeyManager';

export async function searchCodeHydeCommand(resultsProvider: ResultsViewProvider, stateManager: StateManager) {
    // Get API key manager from extension context
    const extension = vscode.extensions.getExtension('undefined_publisher.devcopilot-v2');
    const apiKeyManager = extension?.isActive ? (extension.exports as any)?.apiKeyManager as ApiKeyManager : undefined;
    
    if (!apiKeyManager) {
        vscode.window.showErrorMessage('Extension not properly initialized');
        return;
    }
    
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
        prompt: 'Enter your code search query (HyDE Mode)\nHyDE Mode generates hypothetical code via API and finds similar real code.',
        placeHolder: 'e.g., "error handling functions", "database connection code"'
    });

    if (!query) {
        return;
    }

    // Show progress
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'HyDE Search: Generating hypothetical code and searching...',
        cancellable: false
    }, async () => {
        try {
            // Get API key
            const apiKey = await apiKeyManager.getApiKeyWithPrompt();
            if (!apiKey) {
                vscode.window.showWarningMessage('Search cancelled: No API key configured');
                return;
            }
            
            const results = await searchCodeHyde(query, 10, stateManager, apiKey);
            
            console.log(`HyDE search returned ${results.length} results`);
            
            if (results.length === 0) {
                vscode.window.showInformationMessage('No results found.');
                return;
            }

            // Display results in webview
            resultsProvider.showSearchResults(query, results);
            
            // Focus the webview
            vscode.commands.executeCommand('devcopilot.resultsView.focus');
            
            vscode.window.showInformationMessage(
                `HyDE Search: Found ${results.length} results. Check the DevCopilot Results panel.`
            );
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`HyDE Search failed: ${errorMessage}`);
            
            // Show error in webview
            resultsProvider.showError('HyDE Search Error', errorMessage);
        }
    });
}
