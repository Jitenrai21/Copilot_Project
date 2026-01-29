import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { StateManager } from '../stateManager';

export async function selectRepositoryCommand(stateManager: StateManager): Promise<void> {
    // Show folder picker dialog
    const folderUri = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Repository',
        title: 'Select Repository for DevCopilot'
    });

    if (!folderUri || folderUri.length === 0) {
        return; // User cancelled
    }

    const repoPath = folderUri[0].fsPath;
    
    // Generate dbPath and collectionName using StateManager static methods
    const dbPath = StateManager.generateDbPath(repoPath);
    const collectionName = StateManager.generateCollectionName(repoPath);
    
    // Check if ChromaDB and collection exist
    const chromaDbExists = fs.existsSync(dbPath);
    const collectionPath = path.join(dbPath, 'chroma.sqlite3');
    const collectionExists = chromaDbExists && fs.existsSync(collectionPath);
    
    if (!collectionExists) {
        // ChromaDB or collection doesn't exist - prompt user to index
        const choice = await vscode.window.showWarningMessage(
            `Repository "${path.basename(repoPath)}" has not been indexed yet. Would you like to index it now?`,
            'Index Now',
            'Cancel'
        );
        
        if (choice === 'Index Now') {
            // Update state first so indexing uses the new repo
            await stateManager.setPipelineConfig(repoPath, dbPath, collectionName);
            
            // Trigger index command
            await vscode.commands.executeCommand('devcopilotV3.indexRepository');
        }
        return;
    }
    
    // Collection exists - update pipeline configuration
    await stateManager.setPipelineConfig(repoPath, dbPath, collectionName);
    
    // Show success message
    vscode.window.showInformationMessage(
        `✓ Repository selected: ${path.basename(repoPath)}\nCollection: ${collectionName}\nYou can now use Search, RAG, and PR Summarization features.`
    );
}
