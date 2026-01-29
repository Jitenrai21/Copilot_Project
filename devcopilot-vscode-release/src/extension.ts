import * as vscode from 'vscode';
import { searchCodeHydeCommand } from './commands/searchCodeHyde';
import { searchCodeRagCommand } from './commands/searchCodeRag';
import { summarizePRCommand } from './commands/summarizePR';
import { indexRepositoryCommand, showPipelineStatusCommand } from './commands/indexRepository';
import { selectRepositoryCommand } from './commands/selectRepository';
import { ResultsViewProvider } from './webview/resultsViewProvider';
import { StateManager } from './stateManager';
import { ApiKeyManager } from './apiKeyManager';

export function activate(context: vscode.ExtensionContext) {
    console.log('DevCopilot v2 extension is now active');

    // Initialize API key manager
    const apiKeyManager = new ApiKeyManager(context);

    // Initialize state manager
    const stateManager = new StateManager(context);

    // Register webview provider
    const resultsProvider = new ResultsViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'devcopilotV3.resultsView',
            resultsProvider
        )
    );

    // Register commands
    const indexCommand = vscode.commands.registerCommand(
        'devcopilotV3.indexRepository',
        () => indexRepositoryCommand(stateManager)
    );

    const statusCommand = vscode.commands.registerCommand(
        'devcopilotV3.showPipelineStatus',
        () => showPipelineStatusCommand(stateManager)
    );

    // Mode-based search commands
    const searchHydeCommand = vscode.commands.registerCommand(
        'devcopilotV3.searchCodeHyde',
        () => searchCodeHydeCommand(resultsProvider, stateManager, apiKeyManager)
    );

    const searchRagCommand = vscode.commands.registerCommand(
        'devcopilotV3.searchCodeRag',
        () => searchCodeRagCommand(resultsProvider, stateManager, apiKeyManager)
    );

    const summarizeCommand = vscode.commands.registerCommand(
        'devcopilotV3.summarizePR',
        (repoPath?: string, timeout?: number) => summarizePRCommand(resultsProvider, stateManager, apiKeyManager, repoPath, timeout)
    );

    const selectRepoCommand = vscode.commands.registerCommand(
        'devcopilotV3.selectRepository',
        () => selectRepositoryCommand(stateManager)
    );

    // API Key management command
    const setApiKeyCommand = vscode.commands.registerCommand(
        'devcopilotV3.setApiKey',
        async () => {
            const success = await apiKeyManager.promptAndStoreApiKey();
            if (success) {
                const source = await apiKeyManager.getApiKeySource();
                vscode.window.showInformationMessage(`API Key configured successfully. Source: ${source}`);
            }
        }
    );

    context.subscriptions.push(
        indexCommand,
        statusCommand,
        searchHydeCommand,
        searchRagCommand,
        summarizeCommand,
        selectRepoCommand,
        setApiKeyCommand
    );
}

export function deactivate() {}
