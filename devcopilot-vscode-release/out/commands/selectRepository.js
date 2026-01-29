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
exports.selectRepositoryCommand = selectRepositoryCommand;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const stateManager_1 = require("../stateManager");
async function selectRepositoryCommand(stateManager) {
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
    const dbPath = stateManager_1.StateManager.generateDbPath(repoPath);
    const collectionName = stateManager_1.StateManager.generateCollectionName(repoPath);
    // Check if ChromaDB and collection exist
    const chromaDbExists = fs.existsSync(dbPath);
    const collectionPath = path.join(dbPath, 'chroma.sqlite3');
    const collectionExists = chromaDbExists && fs.existsSync(collectionPath);
    if (!collectionExists) {
        // ChromaDB or collection doesn't exist - prompt user to index
        const choice = await vscode.window.showWarningMessage(`Repository "${path.basename(repoPath)}" has not been indexed yet. Would you like to index it now?`, 'Index Now', 'Cancel');
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
    vscode.window.showInformationMessage(`✓ Repository selected: ${path.basename(repoPath)}\nCollection: ${collectionName}\nYou can now use Search, RAG, and PR Summarization features.`);
}
//# sourceMappingURL=selectRepository.js.map