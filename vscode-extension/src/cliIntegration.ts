import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import { StateManager } from './stateManager';

export interface CLIConfig {
    pythonPath: string;
    cliPath: string;
    chromaDbPath: string;
    collectionName: string;
    repoPath?: string;
}

export function getConfig(stateManager?: StateManager): CLIConfig {
    const config = vscode.workspace.getConfiguration('devcopilot');
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    
    const cliPath = config.get<string>('cliPath') || path.join(workspaceRoot, 'cli.py');
    
    // Use workspace state if available (from Index Repository), otherwise use settings
    let chromaDbPath: string;
    let collectionName: string;
    let repoPath: string | undefined;
    
    if (stateManager && stateManager.isPipelineConfigured()) {
        chromaDbPath = stateManager.getDbPath()!;
        collectionName = stateManager.getCollectionName()!;
        repoPath = stateManager.getRepoPath();
    } else {
        chromaDbPath = config.get<string>('chromaDbPath') || 'data/chroma_db';
        collectionName = config.get<string>('collectionName') || 'flask_code';
    }
    
    return {
        pythonPath: config.get<string>('pythonPath') || 'python',
        cliPath,
        chromaDbPath,
        collectionName,
        repoPath
    };
}

export interface CLIResult {
    success: boolean;
    stdout: string;
    stderr: string;
    error?: Error;
}

export async function executeCLI(args: string[]): Promise<CLIResult> {
    const config = getConfig();
    const cliDir = path.dirname(config.cliPath);
    
    return new Promise((resolve) => {
        const childProcess = child_process.spawn(config.pythonPath, [config.cliPath, ...args], {
            cwd: cliDir,
            // Ensure proper environment and encoding
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
        });

        let stdout = '';
        let stderr = '';

        childProcess.stdout.on('data', (data: Buffer) => {
            stdout += data.toString();
        });

        childProcess.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
        });

        childProcess.on('error', (error: Error) => {
            resolve({
                success: false,
                stdout,
                stderr,
                error
            });
        });

        childProcess.on('close', (code: number | null) => {
            resolve({
                success: code === 0,
                stdout,
                stderr
            });
        });
    });
}

export async function searchCode(query: string, topK: number = 5, stateManager?: StateManager): Promise<any[]> {
    const config = getConfig(stateManager);
    
    const args = [
        'search',
        query,
        '--top-k', topK.toString(),
        '--db', config.chromaDbPath,
        '--collection', config.collectionName,
        '--no-code' // Get metadata only for faster response
    ];

    const result = await executeCLI(args);
    
    if (!result.success) {
        // Extract meaningful error from stderr/stdout
        const errorOutput = result.stderr || result.stdout || result.error?.message || 'Unknown error';
        
        // Look for actual Python traceback or error message
        const tracebackMatch = errorOutput.match(/Traceback \(most recent call last\):[\s\S]+/);
        const errorMatch = errorOutput.match(/Error.*?:.*/i);
        
        let errorMsg = errorOutput;
        if (tracebackMatch) {
            errorMsg = tracebackMatch[0];
        } else if (errorMatch) {
            errorMsg = errorMatch[0];
        }
        
        throw new Error(`CLI error: ${errorMsg}`);
    }

    // Rich console writes to stderr by default, so check both stdout and stderr
    const output = result.stdout || result.stderr;
    
    // Debug: Log raw output to help diagnose parsing issues
    console.log('=== RAW CLI OUTPUT ===');
    console.log('stdout length:', result.stdout.length);
    console.log('stderr length:', result.stderr.length);
    console.log('Using output from:', result.stdout ? 'stdout' : 'stderr');
    console.log('First 500 chars:', output.substring(0, 500));
    console.log('=== END RAW OUTPUT ===');
    
    return parseSearchOutput(output);
}

export async function summarizePR(stateManager?: StateManager, repoPath?: string, timeout?: number): Promise<string> {
    const config = getConfig(stateManager);
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const repo = repoPath || config.repoPath || workspaceRoot;
    
    const args = [
        'summarize',
        '--repo', repo,
        '--verbose'
    ];
    
    // Add timeout parameter if provided
    if (timeout) {
        args.push('--timeout', timeout.toString());
    }

    const result = await executeCLI(args);
    
    if (!result.success) {
        throw new Error(`CLI error: ${result.stderr || result.error?.message}`);
    }

    return result.stdout;
}

function parseSearchOutput(output: string): any[] {
    // Parse the rich-formatted output with panel boxes and Unicode characters
    const results: any[] = [];
    
    // Normalize line endings (remove \r) and split into lines
    const lines = output.replace(/\r/g, '').split('\n');
    
    let currentResult: any = null;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Match panel title headers like "┌──────────────────────── 1. FUNCTION: routes_command ─────────────────────────┐"
        // Use \w+ to capture the function/class name (alphanumeric and underscore)
        const headerMatch = line.match(/(\d+)\.\s+(FUNCTION|CLASS):\s+(\w+)/);
        if (headerMatch) {
            if (currentResult) {
                results.push(currentResult);
            }
            const name = headerMatch[3];  // Name is already clean with \w+ pattern
            currentResult = {
                type: headerMatch[2].toLowerCase(),
                name: name
            };
            continue;
        }
        
        if (currentResult) {
            // Match file path with emoji: "│ 📄 ../flask\src\flask\cli.py:1061-1107"
            const fileMatch = line.match(/📄\s+(.+?):(\d+)-(\d+)/);
            if (fileMatch) {
                // Clean up the file path (remove any trailing whitespace or box chars)
                const filePath = fileMatch[1].trim().replace(/[│└┘]+$/g, '').trim();
                currentResult.file_path = filePath;
                currentResult.start_line = parseInt(fileMatch[2]);
                currentResult.end_line = parseInt(fileMatch[3]);
                continue;
            }
            
            // Match similarity: "│ 📊 Similarity: 0.6058 (distance: 0.3942)"
            const simMatch = line.match(/📊\s+Similarity:\s+([\d.]+)/);
            if (simMatch) {
                currentResult.similarity = parseFloat(simMatch[1]);
                continue;
            }
            
            // Match docstring: "│ 📝 Show all registered routes with endpoints and methods."
            const docMatch = line.match(/📝\s+(.+)/);
            if (docMatch) {
                const docText = docMatch[1].trim();
                // Remove any trailing box characters
                currentResult.docstring = docText.replace(/[│└┘]+$/g, '').trim();
            }
        }
    }
    
    if (currentResult) {
        results.push(currentResult);
    }
    
    console.log(`Parsed ${results.length} results from CLI output`);
    if (results.length > 0) {
        console.log('First result:', JSON.stringify(results[0], null, 2));
    }
    
    return results;
}
