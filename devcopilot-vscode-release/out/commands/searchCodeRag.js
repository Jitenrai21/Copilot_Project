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
exports.searchCodeRagCommand = searchCodeRagCommand;
const vscode = __importStar(require("vscode"));
const cliIntegration_1 = require("../cliIntegration");
async function searchCodeRagCommand(resultsProvider, stateManager, apiKeyManager) {
    // Check if pipeline is configured
    if (!stateManager.isPipelineConfigured()) {
        const action = await vscode.window.showWarningMessage('No repository is indexed yet. Would you like to index one now?', 'Index Repository', 'Cancel');
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
            const result = await (0, cliIntegration_1.searchCodeRag)(query, 10, stateManager, apiKey);
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
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`RAG query failed: ${errorMessage}`);
            // Show error in webview
            resultsProvider.showError('RAG Query Error', errorMessage);
        }
    });
}
//# sourceMappingURL=searchCodeRag.js.map