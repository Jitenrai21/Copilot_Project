"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.indexRepositoryCommand = indexRepositoryCommand;
exports.showPipelineStatusCommand = showPipelineStatusCommand;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const cliIntegration_1 = require("../cliIntegration");
const stateManager_1 = require("../stateManager");
async function indexRepositoryCommand(stateManager) {
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
    const dbPath = stateManager_1.StateManager.generateDbPath(repoPath);
    const collectionName = stateManager_1.StateManager.generateCollectionName(repoPath);
    // Step 3: Confirm with user
    const repoName = path.basename(repoPath);
    const confirmed = await vscode.window.showInformationMessage(`Index repository: ${repoName}?\n\nThis will create:\n- Database: ${dbPath}\n- Collection: ${collectionName}`, { modal: true }, 'Index Now', 'Cancel');
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
            const result = await (0, cliIntegration_1.executeCLI)(args);
            if (!result.success) {
                throw new Error(`Indexing failed: ${result.stderr || result.error?.message}`);
            }
            // Parse output to show progress
            const output = result.stdout || result.stderr;
            console.log('Indexing output:', output);
            vscode.window.showInformationMessage(`✅ Successfully indexed ${repoName}! You can now search and summarize this codebase.`, 'Search Now').then(action => {
                if (action === 'Search Now') {
                    vscode.commands.executeCommand('devcopilotV3.searchCodeHyde');
                }
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Indexing failed: ${errorMessage}`);
            // Clear the pipeline config since indexing failed
            await stateManager.clearPipelineConfig();
        }
    });
}
async function showPipelineStatusCommand(stateManager) {
    if (!stateManager.isPipelineConfigured()) {
        const action = await vscode.window.showInformationMessage('No repository is currently indexed.', 'Index Repository');
        if (action === 'Index Repository') {
            vscode.commands.executeCommand('devcopilotV3.indexRepository');
        }
        return;
    }
    const summary = stateManager.getPipelineConfigSummary();
    const action = await vscode.window.showInformationMessage(`Current Pipeline:\n${summary}`, 'Search Code', 'Summarize PR', 'Change Repository');
    if (action === 'Search Code') {
        vscode.commands.executeCommand('devcopilotV3.searchCodeHyde');
    }
    else if (action === 'Summarize PR') {
        vscode.commands.executeCommand('devcopilotV3.summarizePR');
    }
    else if (action === 'Change Repository') {
        vscode.commands.executeCommand('devcopilotV3.indexRepository');
    }
}
//# sourceMappingURL=indexRepository.js.map