import * as vscode from 'vscode';

/**
 * Manages secure storage and retrieval of LLM API keys.
 * Priority order:
 * 1. VS Code SecretStorage (most secure)
 * 2. Environment variable (LLM_API_KEY)
 * 3. VS Code settings (fallback, not recommended for security)
 */
export class ApiKeyManager {
    private static readonly SECRET_KEY = 'devcopilotV3.llmApiKey';
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * Get the API key from available sources (SecretStorage -> env -> settings).
     * Returns empty string if no key is found.
     */
    async getApiKey(): Promise<string> {
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
        const settingsKey = config.get<string>('apiKey', '');
        if (settingsKey && settingsKey.trim()) {
            return settingsKey;
        }

        return '';
    }

    /**
     * Store the API key securely in SecretStorage.
     */
    async setApiKey(apiKey: string): Promise<void> {
        if (!apiKey || !apiKey.trim()) {
            throw new Error('API key cannot be empty');
        }
        await this.context.secrets.store(ApiKeyManager.SECRET_KEY, apiKey);
    }

    /**
     * Delete the API key from SecretStorage.
     */
    async deleteApiKey(): Promise<void> {
        await this.context.secrets.delete(ApiKeyManager.SECRET_KEY);
    }

    /**
     * Prompt the user to enter their API key and store it securely.
     * Returns true if the key was stored successfully, false otherwise.
     */
    async promptAndStoreApiKey(): Promise<boolean> {
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
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to store API key: ${error}`);
            return false;
        }
    }

    /**
     * Get the API key, prompting the user if not found.
     * Returns empty string if user cancels or no key available.
     */
    async getApiKeyWithPrompt(): Promise<string> {
        let apiKey = await this.getApiKey();

        if (!apiKey || !apiKey.trim()) {
            const choice = await vscode.window.showWarningMessage(
                'No LLM API key configured. Set one now?',
                'Set API Key',
                'Use Environment Variable',
                'Cancel'
            );

            if (choice === 'Set API Key') {
                const stored = await this.promptAndStoreApiKey();
                if (stored) {
                    apiKey = await this.getApiKey();
                }
            } else if (choice === 'Use Environment Variable') {
                vscode.window.showInformationMessage(
                    'Set the LLM_API_KEY environment variable and restart VS Code.'
                );
            }
        }

        return apiKey;
    }

    /**
     * Get the API key source for display purposes (without exposing the actual key).
     */
    async getApiKeySource(): Promise<string> {
        const secretKey = await this.context.secrets.get(ApiKeyManager.SECRET_KEY);
        if (secretKey && secretKey.trim()) {
            return 'SecretStorage (Secure)';
        }

        const envKey = process.env.LLM_API_KEY;
        if (envKey && envKey.trim()) {
            return 'Environment Variable';
        }

        const config = vscode.workspace.getConfiguration('devcopilotV3');
        const settingsKey = config.get<string>('apiKey', '');
        if (settingsKey && settingsKey.trim()) {
            return 'VS Code Settings (Not Recommended)';
        }

        return 'Not Configured';
    }
}
