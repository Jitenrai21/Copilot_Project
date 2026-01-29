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

    // Initialize managers
    const stateManager = new StateManager(context);
    const apiKeyManager = new ApiKeyManager(context);

    // Register webview provider
    const resultsProvider = new ResultsViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'devcopilotV2.resultsView',
            resultsProvider
        )
    );

    // Register commands
    const indexCommand = vscode.commands.registerCommand(
        'devcopilotV2.indexRepository',
        () => indexRepositoryCommand(stateManager)
    );

    const statusCommand = vscode.commands.registerCommand(
        'devcopilotV2.showPipelineStatus',
        () => showPipelineStatusCommand(stateManager)
    );

    // Mode-based search commands
    const searchHydeCommand = vscode.commands.registerCommand(
        'devcopilotV2.searchCodeHyde',
        () => searchCodeHydeCommand(resultsProvider, stateManager)
    );

    const searchRagCommand = vscode.commands.registerCommand(
        'devcopilotV2.searchCodeRag',
        () => searchCodeRagCommand(resultsProvider, stateManager)
    );

    const summarizeCommand = vscode.commands.registerCommand(
        'devcopilotV2.summarizePR',
        (repoPath?: string, timeout?: number) => summarizePRCommand(resultsProvider, stateManager, repoPath, timeout)
    );

    const selectRepoCommand = vscode.commands.registerCommand(
        'devcopilotV2.selectRepository',
        () => selectRepositoryCommand(stateManager)
    );

    const setApiKeyCommand = vscode.commands.registerCommand(
        'devcopilotV2.setApiKey',
        async () => {
            const success = await apiKeyManager.promptAndStoreApiKey();
            if (success) {
                const source = await apiKeyManager.getApiKeySource();
                vscode.window.showInformationMessage(`API Key configured via: ${source}`);
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

    // Store apiKeyManager in context for use by other modules
    (context as any).apiKeyManager = apiKeyManager;
    
    // Export context for access by other modules
    return { context, apiKeyManager, stateManager };
}

export function deactivate() {}
