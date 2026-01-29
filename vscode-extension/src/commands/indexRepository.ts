import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { executeCLI } from '../cliIntegration';
import { StateManager } from '../stateManager';

export async function indexRepositoryCommand(stateManager: StateManager) {
    // Step 1: Prompt user to select repository folder
    const folderUris = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Repository to Index',
        title: 'DevCopilot: Select Repository'
    });

    if (!folderUris || folderUris.length === 0) {
        return; // User cancelled
    }

    const repoPath = folderUris[0].fsPath;
    
    // Step 2: Generate DB path and collection name
    const dbPath = StateManager.generateDbPath(repoPath);
    const collectionName = StateManager.generateCollectionName(repoPath);

    // Step 3: Confirm with user
    const repoName = path.basename(repoPath);
    const confirmed = await vscode.window.showInformationMessage(
        `Index repository: ${repoName}?\n\nThis will create:\n- Database: ${dbPath}\n- Collection: ${collectionName}`,
        { modal: true },
        'Index Now',
        'Cancel'
    );

    if (confirmed !== 'Index Now') {
        return;
    }

    // Step 4: Create DB directory if it doesn't exist
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    // Step 5: Store pipeline configuration
    await stateManager.setPipelineConfig(repoPath, dbPath, collectionName);

    // Step 6: Run indexing with progress indicator
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Indexing ${repoName}...`,
        cancellable: false
    }, async (progress) => {
        try {
            progress.report({ message: 'Scanning repository and extracting code...' });

            const args = [
                'index',
                '--repo', repoPath,
                '--db', dbPath,
                '--collection', collectionName,
                '--force' // Force reindexing if collection exists
            ];

            const result = await executeCLI(args);

            if (!result.success) {
                throw new Error(`Indexing failed: ${result.stderr || result.error?.message}`);
            }

            // Parse output to show progress
            const output = result.stdout || result.stderr;
            console.log('Indexing output:', output);

            vscode.window.showInformationMessage(
                `✅ Successfully indexed ${repoName}! You can now search and summarize this codebase.`,
                'Search Now'
            ).then(action => {
                if (action === 'Search Now') {
                    vscode.commands.executeCommand('devcopilot.searchCode');
                }
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Indexing failed: ${errorMessage}`);
            
            // Clear the pipeline config since indexing failed
            await stateManager.clearPipelineConfig();
        }
    });
}

export async function showPipelineStatusCommand(stateManager: StateManager) {
    if (!stateManager.isPipelineConfigured()) {
        const action = await vscode.window.showInformationMessage(
            'No repository is currently indexed.',
            'Index Repository'
        );
        if (action === 'Index Repository') {
            vscode.commands.executeCommand('devcopilot.indexRepository');
        }
        return;
    }

    const summary = stateManager.getPipelineConfigSummary();
    const action = await vscode.window.showInformationMessage(
        `Current Pipeline:\n${summary}`,
        'Search Code',
        'Summarize PR',
        'Change Repository'
    );

    if (action === 'Search Code') {
        vscode.commands.executeCommand('devcopilot.searchCode');
    } else if (action === 'Summarize PR') {
        vscode.commands.executeCommand('devcopilot.summarizePR');
    } else if (action === 'Change Repository') {
        vscode.commands.executeCommand('devcopilot.indexRepository');
    }
}
