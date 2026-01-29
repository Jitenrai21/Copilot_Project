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
exports.getConfig = getConfig;
exports.executeCLI = executeCLI;
exports.searchCode = searchCode;
exports.searchCodeHyde = searchCodeHyde;
exports.searchCodeRag = searchCodeRag;
exports.summarizePR = summarizePR;
const vscode = __importStar(require("vscode"));
const child_process = __importStar(require("child_process"));
const path = __importStar(require("path"));
function getConfig(stateManager) {
    const config = vscode.workspace.getConfiguration('devcopilotV3');
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const cliPath = config.get('cliPath') || path.join(workspaceRoot, 'cli_v2.py');
    // Use workspace state if available (from Index Repository), otherwise use settings
    let chromaDbPath;
    let collectionName;
    let repoPath;
    if (stateManager && stateManager.isPipelineConfigured()) {
        chromaDbPath = stateManager.getDbPath();
        collectionName = stateManager.getCollectionName();
        repoPath = stateManager.getRepoPath();
    }
    else {
        chromaDbPath = config.get('chromaDbPath') || 'data/chroma_db_api';
        collectionName = config.get('collectionName') || 'code_collection';
    }
    // Get API configuration
    const apiUrl = config.get('apiUrl') || 'https://api.groq.com/openai/v1/chat/completions';
    const modelName = config.get('modelName') || 'llama-3.3-70b-versatile';
    return {
        pythonPath: config.get('pythonPath') || 'python',
        cliPath,
        chromaDbPath,
        collectionName,
        apiUrl,
        modelName,
        repoPath
    };
}
async function executeCLI(args) {
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
        childProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        childProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        childProcess.on('error', (error) => {
            resolve({
                success: false,
                stdout,
                stderr,
                error
            });
        });
        childProcess.on('close', (code) => {
            resolve({
                success: code === 0,
                stdout,
                stderr
            });
        });
    });
}
async function searchCode(query, topK = 5, stateManager) {
    // Legacy function - redirects to HyDE search for backward compatibility
    return searchCodeHyde(query, topK, stateManager);
}
async function searchCodeHyde(query, topK = 5, stateManager, apiKey) {
    const config = getConfig(stateManager);
    if (!apiKey) {
        throw new Error('API key not provided. Please set your API key using the "DevCopilot: Set API Key" command.');
    }
    const args = [
        'search',
        '--mode', 'hyde',
        '--query', query,
        '--top-k', topK.toString(),
        '--db', config.chromaDbPath,
        '--collection', config.collectionName,
        '--api-key', apiKey,
        '--api-url', config.apiUrl,
        '--model', config.modelName,
        '--show-code' // Include code for display
    ];
    const result = await executeCLI(args);
    if (!result.success) {
        const errorOutput = result.stderr || result.stdout || result.error?.message || 'Unknown error';
        const tracebackMatch = errorOutput.match(/Traceback \(most recent call last\):[\s\S]+/);
        const errorMatch = errorOutput.match(/Error.*?:.*/i);
        let errorMsg = errorOutput;
        if (tracebackMatch) {
            errorMsg = tracebackMatch[0];
        }
        else if (errorMatch) {
            errorMsg = errorMatch[0];
        }
        throw new Error(`HyDE search error: ${errorMsg}`);
    }
    const output = result.stdout || result.stderr;
    return parseSearchOutput(output);
}
async function searchCodeRag(query, topK = 5, stateManager, apiKey) {
    const config = getConfig(stateManager);
    if (!apiKey) {
        throw new Error('API key not provided. Please set your API key using the "DevCopilot: Set API Key" command.');
    }
    const args = [
        'search',
        '--mode', 'rag',
        '--query', query,
        '--top-k', topK.toString(),
        '--db', config.chromaDbPath,
        '--collection', config.collectionName,
        '--api-key', apiKey,
        '--api-url', config.apiUrl,
        '--model', config.modelName,
        '--show-code'
    ];
    const result = await executeCLI(args);
    if (!result.success) {
        const errorOutput = result.stderr || result.stdout || result.error?.message || 'Unknown error';
        throw new Error(`RAG query error: ${errorOutput}`);
    }
    const output = result.stdout || result.stderr;
    return parseRagOutput(output);
}
async function summarizePR(stateManager, repoPath, timeout, apiKey) {
    const config = getConfig(stateManager);
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const repo = repoPath || config.repoPath || workspaceRoot;
    if (!apiKey) {
        throw new Error('API key not provided. Please set your API key using the "DevCopilot: Set API Key" command.');
    }
    const args = [
        'summarize',
        '--repo', repo,
        '--api-key', apiKey,
        '--api-url', config.apiUrl,
        '--model', config.modelName,
        '--verbose'
    ];
    // Add timeout parameter if provided
    if (timeout) {
        args.push('--timeout', timeout.toString());
    }
    const result = await executeCLI(args);
    if (!result.success) {
        throw new Error(`PR summarization error: ${result.stderr || result.error?.message}`);
    }
    return result.stdout;
}
function parseSearchOutput(output) {
    // Parse the rich-formatted output with panel boxes and Unicode characters
    const results = [];
    // Normalize line endings (remove \r) and split into lines
    const lines = output.replace(/\r/g, '').split('\n');
    let currentResult = null;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match panel title headers like "┌──────────────────────── 1. FUNCTION: routes_command ─────────────────────────┐"
        // Use \w+ to capture the function/class name (alphanumeric and underscore)
        const headerMatch = line.match(/(\d+)\.\s+(FUNCTION|CLASS):\s+(\w+)/);
        if (headerMatch) {
            if (currentResult) {
                results.push(currentResult);
            }
            const name = headerMatch[3]; // Name is already clean with \w+ pattern
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
    return results;
}
function parseRagOutput(output) {
    const lines = output.replace(/\r/g, '').split('\n');
    let answer = '';
    let sources = [];
    let currentSource = null;
    let inAnswerSection = false;
    let inSourcesSection = false;
    let inSourceBox = false;
    let collectingCode = false;
    let codeLines = [];
    let collectingFilePath = false;
    let filePathLines = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        // Skip empty lines (unless collecting code)
        if (!trimmed && !collectingCode) {
            continue;
        }
        // Detect answer section start (look for box with "Answer:" or answer emoji)
        if ((trimmed.includes('💡') || trimmed.includes('Answer:')) && !inSourcesSection) {
            inAnswerSection = true;
            continue;
        }
        // Skip query echo lines
        if (trimmed.startsWith('Code Search - RAG Mode Query:') || trimmed.startsWith('Query:')) {
            continue;
        }
        // Detect supporting sources section
        if (trimmed.includes('Supporting Sources')) {
            inAnswerSection = false;
            inSourcesSection = true;
            continue;
        }
        // If in sources section, look for source boxes
        if (inSourcesSection) {
            // Detect start of a source box: ┌──── 1. FUNCTION: hello ────┐
            const boxStartMatch = line.match(/^┌[─]+\s*(\d+)\.\s+(FUNCTION|CLASS):\s+(.+?)\s+[─]+┐/);
            if (boxStartMatch) {
                // Save previous source if collecting code
                if (currentSource && collectingCode) {
                    if (codeLines.length > 0) {
                        currentSource.code_snippet = codeLines.join('\n');
                    }
                    sources.push(currentSource);
                    codeLines = [];
                    collectingCode = false;
                }
                // Start new source
                currentSource = {
                    type: boxStartMatch[2].toLowerCase(),
                    name: boxStartMatch[3].trim()
                };
                inSourceBox = true;
                collectingFilePath = false;
                filePathLines = [];
                continue;
            }
            // Inside a source box, look for file path and similarity
            if (inSourceBox) {
                // Detect 📄 marker - start collecting file path lines
                if (line.includes('📄') && !collectingFilePath) {
                    collectingFilePath = true;
                    // Check if the path is on the same line
                    const pathMatch = line.match(/│\s*📄\s*(.+?)\s*│/);
                    if (pathMatch) {
                        const pathContent = pathMatch[1].trim();
                        if (pathContent) {
                            filePathLines.push(pathContent);
                        }
                    }
                    continue;
                }
                // Continue collecting file path lines
                if (collectingFilePath) {
                    const pathLineMatch = line.match(/│\s*(.+?)\s*│/);
                    if (pathLineMatch) {
                        const content = pathLineMatch[1].trim();
                        if (content && !content.match(/^[─┌┐└┘]+$/) && !content.includes('📊') && !content.includes('📝')) {
                            filePathLines.push(content);
                            // Check if we've completed the path (has :digits-digits)
                            const fullPath = filePathLines.join('');
                            const completeMatch = fullPath.match(/(.+?):(\d+)-(\d+)/);
                            if (completeMatch) {
                                currentSource.file_path = completeMatch[1].trim();
                                currentSource.start_line = parseInt(completeMatch[2]);
                                currentSource.end_line = parseInt(completeMatch[3]);
                                collectingFilePath = false;
                                filePathLines = [];
                            }
                        }
                    }
                    continue;
                }
                // Extract similarity: │ 📊 Similarity: 0.6498 │
                const simMatch = line.match(/│\s*📊\s+Similarity:\s+([\d.]+)\s*│/);
                if (simMatch && currentSource) {
                    currentSource.similarity = parseFloat(simMatch[1]);
                    continue;
                }
                // Extract docstring: │ 📝 text... │
                const docMatch = line.match(/│\s*📝\s+(.+?)\s*│/);
                if (docMatch && currentSource) {
                    currentSource.docstring = docMatch[1].trim();
                    continue;
                }
                // Detect end of source box: └────┘
                if (line.match(/^└[─]+┘/)) {
                    inSourceBox = false;
                    collectingCode = true;
                    collectingFilePath = false;
                    continue;
                }
            }
            // After a source box, collect code snippet lines until next box or end
            if (collectingCode && !inSourceBox) {
                // Stop collecting if we hit another box or empty line after code
                if (line.match(/^┌[─]+/) || (trimmed === '' && codeLines.length > 0)) {
                    // Don't continue here, let the next iteration handle the new box
                    if (line.match(/^┌[─]+/)) {
                        i--; // Reprocess this line as a new box
                        if (currentSource) {
                            if (codeLines.length > 0) {
                                currentSource.code_snippet = codeLines.join('\n');
                            }
                            sources.push(currentSource);
                            codeLines = [];
                            collectingCode = false;
                            currentSource = null;
                        }
                        continue;
                    }
                }
                else if (trimmed) {
                    codeLines.push(line);
                }
            }
            continue;
        }
        // Collect answer text (inside answer box, marked by │)
        if (inAnswerSection && !inSourcesSection) {
            // Remove box characters and extract content
            let content = line.replace(/^│\s*/, '').replace(/\s*│$/, '').trim();
            // Skip box boundaries and empty content
            if (content && !content.match(/^[─┌┐└┘]+$/) && content !== 'Answer:') {
                answer += content + ' ';
            }
            // Detect end of answer box
            if (line.match(/^└[─]+┘/)) {
                inAnswerSection = false;
            }
        }
    }
    // Save last source if exists
    if (currentSource && currentSource.file_path) {
        if (codeLines.length > 0) {
            currentSource.code_snippet = codeLines.join('\n');
        }
        sources.push(currentSource);
    }
    // Clean up answer
    answer = answer.trim();
    return { answer, sources };
}
//# sourceMappingURL=cliIntegration.js.map