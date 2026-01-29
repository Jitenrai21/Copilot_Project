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
exports.StateManager = void 0;
const path = __importStar(require("path"));
/**
 * Manages extension state for pipeline configuration
 */
class StateManager {
    constructor(context) {
        this.context = context;
    }
    /**
     * Get the currently configured repository path
     */
    getRepoPath() {
        return this.context.workspaceState.get('devcopilotV3.repoPath');
    }
    /**
     * Get the ChromaDB path for the current pipeline
     */
    getDbPath() {
        return this.context.workspaceState.get('devcopilotV3.dbPath');
    }
    /**
     * Get the collection name for the current pipeline
     */
    getCollectionName() {
        return this.context.workspaceState.get('devcopilotV3.collectionName');
    }
    /**
     * Set all pipeline configuration values at once
     */
    async setPipelineConfig(repoPath, dbPath, collectionName) {
        await this.context.workspaceState.update('devcopilotV3.repoPath', repoPath);
        await this.context.workspaceState.update('devcopilotV3.dbPath', dbPath);
        await this.context.workspaceState.update('devcopilotV3.collectionName', collectionName);
    }
    /**
     * Check if pipeline is configured
     */
    isPipelineConfigured() {
        return !!(this.getRepoPath() && this.getDbPath() && this.getCollectionName());
    }
    /**
     * Clear all pipeline configuration
     */
    async clearPipelineConfig() {
        await this.context.workspaceState.update('devcopilotV3.repoPath', undefined);
        await this.context.workspaceState.update('devcopilotV3.dbPath', undefined);
        await this.context.workspaceState.update('devcopilotV3.collectionName', undefined);
    }
    /**
     * Generate a collection name from a repository path
     */
    static generateCollectionName(repoPath) {
        const baseName = path.basename(repoPath);
        // Sanitize: lowercase, replace spaces and special chars with underscore
        return baseName.toLowerCase().replace(/[^a-z0-9_]/g, '_') + '_code';
    }
    /**
     * Generate a ChromaDB path from a repository path
     * Creates a .devcopilot folder inside the repo
     */
    static generateDbPath(repoPath) {
        return path.join(repoPath, '.devcopilot', 'chroma_db');
    }
    /**
     * Get pipeline configuration summary
     */
    getPipelineConfigSummary() {
        if (!this.isPipelineConfigured()) {
            return 'No pipeline configured. Use "DevCopilot: Index Repository" to get started.';
        }
        const repo = this.getRepoPath();
        const collection = this.getCollectionName();
        return `Repository: ${repo}\nCollection: ${collection}`;
    }
}
exports.StateManager = StateManager;
//# sourceMappingURL=stateManager.js.map