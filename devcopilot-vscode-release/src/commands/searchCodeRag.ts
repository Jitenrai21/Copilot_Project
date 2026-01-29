import * as vscode from 'vscode';
import { searchCodeRag } from '../cliIntegration';
import { ResultsViewProvider } from '../webview/resultsViewProvider';
import { StateManager } from '../stateManager';
import { ApiKeyManager } from '../apiKeyManager';

export async function searchCodeRagCommand(resultsProvider: ResultsViewProvider, stateManager: StateManager, apiKeyManager: ApiKeyManager) {
    // Check if pipeline is configured
    if (!stateManager.isPipelineConfigured()) {
        const action = await vscode.window.showWarningMessage(
            'No repository is indexed yet. Would you like to index one now?',
            'Index Repository',
            'Cancel'
        );
        if (action === 'Index Repository') {
            vscode.commands.executeCommand('devcopilotV3.indexRepository');
        }
        return;
    }

    // Prompt user for search query
    const query = await vscode.window.showInputBox({
        prompt: 'Ask a question about the codebase using RAG (Retrieval-Augmented Generation)',
        placeHolder: 'e.g., "How does Flask handle routing?", "What is the Blueprint class used for?"',
        title: 'RAG Topic Query'
    });

    if (!query) {
        return;
    }

    // Show progress
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'RAG Query: Retrieving context and generating answer...',
        cancellable: false
    }, async () => {
        try {
            // Get API key
            const apiKey = await apiKeyManager.getApiKeyWithPrompt();
            if (!apiKey) {
                vscode.window.showWarningMessage('Query cancelled: No API key configured');
                return;
            }
            
            const result = await searchCodeRag(query, 10, stateManager, apiKey);
            
            console.log(`RAG query returned answer (${result.answer.length} chars) with ${result.sources.length} sources`);
            
            if (!result.answer && result.sources.length === 0) {
                vscode.window.showInformationMessage('No results found.');
                return;
            }

            // Focus the webview FIRST to ensure it's initialized
            await vscode.commands.executeCommand('devcopilotV3.resultsView.focus');
            
            // Small delay to ensure view is resolved
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Display RAG results in webview (answer + sources)
            resultsProvider.showRagResults(query, result.answer, result.sources);
            
            vscode.window.showInformationMessage(`Generated answer with ${result.sources.length} supporting sources. Check the DevCopilot v2 Results panel.`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`RAG query failed: ${errorMessage}`);
            
            // Show error in webview
            resultsProvider.showError('RAG Query Error', errorMessage);
        }
    });
}
