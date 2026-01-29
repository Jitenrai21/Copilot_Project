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
exports.searchCodeHydeCommand = searchCodeHydeCommand;
const vscode = __importStar(require("vscode"));
const cliIntegration_1 = require("../cliIntegration");
async function searchCodeHydeCommand(resultsProvider, stateManager, apiKeyManager) {
    // Check if pipeline is configured
    if (!stateManager.isPipelineConfigured()) {
        const action = await vscode.window.showWarningMessage('No repository is indexed yet. Would you like to index one now?', 'Index Repository', 'Cancel');
        if (action === 'Index Repository') {
            vscode.commands.executeCommand('devcopilot.indexRepository');
        }
        return;
    }
    // Prompt user for search query
    const query = await vscode.window.showInputBox({
        prompt: 'Enter your code search query (HyDE Mode)\nHyDE Mode generates hypothetical code via API and finds similar real code.',
        placeHolder: 'e.g., "error handling functions", "database connection code"'
    });
    if (!query) {
        return;
    }
    // Show progress
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'HyDE Search: Generating hypothetical code and searching...',
        cancellable: false
    }, async () => {
        try {
            // Get API key
            const apiKey = await apiKeyManager.getApiKeyWithPrompt();
            if (!apiKey) {
                vscode.window.showWarningMessage('Search cancelled: No API key configured');
                return;
            }
            const results = await (0, cliIntegration_1.searchCodeHyde)(query, 10, stateManager, apiKey);
            console.log(`HyDE search returned ${results.length} results`);
            if (results.length === 0) {
                vscode.window.showInformationMessage('No results found.');
                return;
            }
            // Display results in webview
            resultsProvider.showSearchResults(query, results);
            // Focus the webview
            vscode.commands.executeCommand('devcopilot.resultsView.focus');
            vscode.window.showInformationMessage(`HyDE Search: Found ${results.length} results. Check the DevCopilot Results panel.`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`HyDE Search failed: ${errorMessage}`);
            // Show error in webview
            resultsProvider.showError('HyDE Search Error', errorMessage);
        }
    });
}
//# sourceMappingURL=searchCodeHyde.js.map