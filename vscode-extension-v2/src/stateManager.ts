import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Manages extension state for pipeline configuration
 */
export class StateManager {
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * Get the currently configured repository path
     */
    getRepoPath(): string | undefined {
        return this.context.workspaceState.get<string>('devcopilotV2.repoPath');
    }

    /**
     * Get the ChromaDB path for the current pipeline
     */
    getDbPath(): string | undefined {
        return this.context.workspaceState.get<string>('devcopilotV2.dbPath');
    }

    /**
     * Get the collection name for the current pipeline
     */
    getCollectionName(): string | undefined {
        return this.context.workspaceState.get<string>('devcopilotV2.collectionName');
    }

    /**
     * Set all pipeline configuration values at once
     */
    async setPipelineConfig(repoPath: string, dbPath: string, collectionName: string): Promise<void> {
        await this.context.workspaceState.update('devcopilotV2.repoPath', repoPath);
        await this.context.workspaceState.update('devcopilotV2.dbPath', dbPath);
        await this.context.workspaceState.update('devcopilotV2.collectionName', collectionName);
    }

    /**
     * Check if pipeline is configured
     */
    isPipelineConfigured(): boolean {
        return !!(this.getRepoPath() && this.getDbPath() && this.getCollectionName());
    }

    /**
     * Clear all pipeline configuration
     */
    async clearPipelineConfig(): Promise<void> {
        await this.context.workspaceState.update('devcopilotV2.repoPath', undefined);
        await this.context.workspaceState.update('devcopilotV2.dbPath', undefined);
        await this.context.workspaceState.update('devcopilotV2.collectionName', undefined);
    }

    /**
     * Generate a collection name from a repository path
     */
    static generateCollectionName(repoPath: string): string {
        const baseName = path.basename(repoPath);
        // Sanitize: lowercase, replace spaces and special chars with underscore
        return baseName.toLowerCase().replace(/[^a-z0-9_]/g, '_') + '_code';
    }

    /**
     * Generate a ChromaDB path from a repository path
     * Creates a .devcopilot folder inside the repo
     */
    static generateDbPath(repoPath: string): string {
        return path.join(repoPath, '.devcopilot', 'chroma_db');
    }

    /**
     * Get pipeline configuration summary
     */
    getPipelineConfigSummary(): string {
        if (!this.isPipelineConfigured()) {
            return 'No pipeline configured. Use "DevCopilot: Index Repository" to get started.';
        }

        const repo = this.getRepoPath();
        const collection = this.getCollectionName();
        return `Repository: ${repo}\nCollection: ${collection}`;
    }
}
