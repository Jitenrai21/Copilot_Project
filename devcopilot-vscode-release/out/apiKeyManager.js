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
exports.ApiKeyManager = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Manages secure storage and retrieval of LLM API keys.
 * Priority order:
 * 1. VS Code SecretStorage (most secure)
 * 2. Environment variable (LLM_API_KEY)
 * 3. VS Code settings (fallback, not recommended for security)
 */
class ApiKeyManager {
    constructor(context) {
        this.context = context;
    }
    /**
     * Get the API key from available sources (SecretStorage -> env -> settings).
     * Returns empty string if no key is found.
     */
    async getApiKey() {
        // 1. Check SecretStorage first (most secure)
        const secretKey = await this.context.secrets.get(ApiKeyManager.SECRET_KEY);
        if (secretKey && secretKey.trim()) {
            return secretKey;
        }
        // 2. Check environment variable
        const envKey = process.env.LLM_API_KEY;
        if (envKey && envKey.trim()) {
            return envKey;
        }
        // 3. Check VS Code settings (fallback, not recommended)
        const config = vscode.workspace.getConfiguration('devcopilotV3');
        const settingsKey = config.get('apiKey', '');
        if (settingsKey && settingsKey.trim()) {
            return settingsKey;
        }
        return '';
    }
    /**
     * Store the API key securely in SecretStorage.
     */
    async setApiKey(apiKey) {
        if (!apiKey || !apiKey.trim()) {
            throw new Error('API key cannot be empty');
        }
        await this.context.secrets.store(ApiKeyManager.SECRET_KEY, apiKey);
    }
    /**
     * Delete the API key from SecretStorage.
     */
    async deleteApiKey() {
        await this.context.secrets.delete(ApiKeyManager.SECRET_KEY);
    }
    /**
     * Prompt the user to enter their API key and store it securely.
     * Returns true if the key was stored successfully, false otherwise.
     */
    async promptAndStoreApiKey() {
        const apiKey = await vscode.window.showInputBox({
            prompt: 'Enter your LLM API Key (Groq, OpenAI, etc.)',
            placeHolder: 'sk-...',
            password: true,
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (!value || !value.trim()) {
                    return 'API key cannot be empty';
                }
                if (value.length < 10) {
                    return 'API key seems too short';
                }
                return null;
            }
        });
        if (!apiKey) {
            return false;
        }
        try {
            await this.setApiKey(apiKey);
            vscode.window.showInformationMessage('API key stored securely.');
            return true;
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to store API key: ${error}`);
            return false;
        }
    }
    /**
     * Get the API key, prompting the user if not found.
     * Returns empty string if user cancels or no key available.
     */
    async getApiKeyWithPrompt() {
        let apiKey = await this.getApiKey();
        if (!apiKey || !apiKey.trim()) {
            const choice = await vscode.window.showWarningMessage('No LLM API key configured. Set one now?', 'Set API Key', 'Use Environment Variable', 'Cancel');
            if (choice === 'Set API Key') {
                const stored = await this.promptAndStoreApiKey();
                if (stored) {
                    apiKey = await this.getApiKey();
                }
            }
            else if (choice === 'Use Environment Variable') {
                vscode.window.showInformationMessage('Set the LLM_API_KEY environment variable and restart VS Code.');
            }
        }
        return apiKey;
    }
    /**
     * Get the API key source for display purposes (without exposing the actual key).
     */
    async getApiKeySource() {
        const secretKey = await this.context.secrets.get(ApiKeyManager.SECRET_KEY);
        if (secretKey && secretKey.trim()) {
            return 'SecretStorage (Secure)';
        }
        const envKey = process.env.LLM_API_KEY;
        if (envKey && envKey.trim()) {
            return 'Environment Variable';
        }
        const config = vscode.workspace.getConfiguration('devcopilotV3');
        const settingsKey = config.get('apiKey', '');
        if (settingsKey && settingsKey.trim()) {
            return 'VS Code Settings (Not Recommended)';
        }
        return 'Not Configured';
    }
}
exports.ApiKeyManager = ApiKeyManager;
ApiKeyManager.SECRET_KEY = 'devcopilotV3.llmApiKey';
//# sourceMappingURL=apiKeyManager.js.map