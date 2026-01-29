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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const searchCodeHyde_1 = require("./commands/searchCodeHyde");
const searchCodeRag_1 = require("./commands/searchCodeRag");
const summarizePR_1 = require("./commands/summarizePR");
const indexRepository_1 = require("./commands/indexRepository");
const selectRepository_1 = require("./commands/selectRepository");
const resultsViewProvider_1 = require("./webview/resultsViewProvider");
const stateManager_1 = require("./stateManager");
const apiKeyManager_1 = require("./apiKeyManager");
function activate(context) {
    console.log('DevCopilot v2 extension is now active');
    // Initialize API key manager
    const apiKeyManager = new apiKeyManager_1.ApiKeyManager(context);
    // Initialize state manager
    const stateManager = new stateManager_1.StateManager(context);
    // Register webview provider
    const resultsProvider = new resultsViewProvider_1.ResultsViewProvider(context.extensionUri);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('devcopilotV3.resultsView', resultsProvider));
    // Register commands
    const indexCommand = vscode.commands.registerCommand('devcopilotV3.indexRepository', () => (0, indexRepository_1.indexRepositoryCommand)(stateManager));
    const statusCommand = vscode.commands.registerCommand('devcopilotV3.showPipelineStatus', () => (0, indexRepository_1.showPipelineStatusCommand)(stateManager));
    // Mode-based search commands
    const searchHydeCommand = vscode.commands.registerCommand('devcopilotV3.searchCodeHyde', () => (0, searchCodeHyde_1.searchCodeHydeCommand)(resultsProvider, stateManager, apiKeyManager));
    const searchRagCommand = vscode.commands.registerCommand('devcopilotV3.searchCodeRag', () => (0, searchCodeRag_1.searchCodeRagCommand)(resultsProvider, stateManager, apiKeyManager));
    const summarizeCommand = vscode.commands.registerCommand('devcopilotV3.summarizePR', (repoPath, timeout) => (0, summarizePR_1.summarizePRCommand)(resultsProvider, stateManager, apiKeyManager, repoPath, timeout));
    const selectRepoCommand = vscode.commands.registerCommand('devcopilotV3.selectRepository', () => (0, selectRepository_1.selectRepositoryCommand)(stateManager));
    // API Key management command
    const setApiKeyCommand = vscode.commands.registerCommand('devcopilotV3.setApiKey', async () => {
        const success = await apiKeyManager.promptAndStoreApiKey();
        if (success) {
            const source = await apiKeyManager.getApiKeySource();
            vscode.window.showInformationMessage(`API Key configured successfully. Source: ${source}`);
        }
    });
    context.subscriptions.push(indexCommand, statusCommand, searchHydeCommand, searchRagCommand, summarizeCommand, selectRepoCommand, setApiKeyCommand);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map