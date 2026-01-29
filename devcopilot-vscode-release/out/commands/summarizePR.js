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
exports.summarizePRCommand = summarizePRCommand;
const vscode = __importStar(require("vscode"));
const cliIntegration_1 = require("../cliIntegration");
async function summarizePRCommand(resultsProvider, stateManager, apiKeyManager, providedRepoPath, providedTimeout) {
    // Use provided repo path (from retry), configured repo path, or workspace root
    let repoPath = providedRepoPath;
    if (!repoPath && stateManager.isPipelineConfigured()) {
        repoPath = stateManager.getRepoPath();
    }
    else if (!repoPath) {
        repoPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }
    if (!repoPath) {
        const action = await vscode.window.showWarningMessage('No repository configured. Would you like to index one now?', 'Index Repository', 'Cancel');
        if (action === 'Index Repository') {
            vscode.commands.executeCommand('devcopilotV3.indexRepository');
        }
        return;
    }
    // Default timeout to 300 seconds if not provided
    const timeout = providedTimeout || 300;
    // Show progress
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Summarizing PR${providedTimeout ? ` with ${timeout}s timeout` : ''}...`,
        cancellable: false
    }, async () => {
        try {
            // Get API key
            const apiKey = await apiKeyManager.getApiKeyWithPrompt();
            if (!apiKey) {
                vscode.window.showWarningMessage('Summarization cancelled: No API key configured');
                return;
            }
            const summary = await (0, cliIntegration_1.summarizePR)(stateManager, repoPath, timeout, apiKey);
            // Display summary in webview with repo path and timeout for potential retry
            resultsProvider.showPRSummary(summary, repoPath, timeout);
            vscode.window.showInformationMessage('PR summary generated successfully');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`PR summarization failed: ${errorMessage}`);
            // Build CLI command for "Show CLI Command" button
            const cliCommand = `python cli.py summarize --repo "${repoPath}" --timeout ${timeout * 2} --verbose`;
            // Show error in webview with retry options
            resultsProvider.showError('PR Summarization Error', errorMessage, repoPath, timeout, cliCommand);
        }
    });
}
//# sourceMappingURL=summarizePR.js.map