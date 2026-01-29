import * as vscode from 'vscode';
import { searchCodeCommand } from './commands/searchCode';
import { summarizePRCommand } from './commands/summarizePR';
import { indexRepositoryCommand, showPipelineStatusCommand } from './commands/indexRepository';
import { ResultsViewProvider } from './webview/resultsViewProvider';
import { StateManager } from './stateManager';

export function activate(context: vscode.ExtensionContext) {
    console.log('DevCopilot extension is now active');

    // Initialize state manager
    const stateManager = new StateManager(context);

    // Register webview provider
    const resultsProvider = new ResultsViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'devcopilot.resultsView',
            resultsProvider
        )
    );

    // Register commands
    const indexCommand = vscode.commands.registerCommand(
        'devcopilot.indexRepository',
        () => indexRepositoryCommand(stateManager)
    );

    const statusCommand = vscode.commands.registerCommand(
        'devcopilot.showPipelineStatus',
        () => showPipelineStatusCommand(stateManager)
    );

    const searchCommand = vscode.commands.registerCommand(
        'devcopilot.searchCode',
        () => searchCodeCommand(resultsProvider, stateManager)
    );

    const summarizeCommand = vscode.commands.registerCommand(
        'devcopilot.summarizePR',
        (repoPath?: string, timeout?: number) => summarizePRCommand(resultsProvider, stateManager, repoPath, timeout)
    );

    context.subscriptions.push(indexCommand, statusCommand, searchCommand, summarizeCommand);
}

export function deactivate() {}
