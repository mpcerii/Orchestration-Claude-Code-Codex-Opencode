// ============================================================
// CLI Runner – Spawns AI CLI tools and captures output
// Prompts are piped via stdin to avoid shell escaping issues
// ============================================================

import { type ChildProcess, spawn as nodeSpawn } from 'child_process';
import spawn from 'cross-spawn';
import type { Agent, CliTool } from '../types.js';

// Define the precise model names accepted by each CLI to prevent ModelNotFoundError
const MODELS: Record<CliTool, string[]> = {
    claude: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-3.1-pro-preview'],
    codex: ['o3', 'o4-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-5.4', 'gpt-5.3-codex'],
    opencode: [
        // Antigravity models (thinking)
        'google/antigravity-gemini-3-pro',
        'google/antigravity-gemini-3.1-pro',
        'google/antigravity-gemini-3-flash',
        'google/antigravity-claude-sonnet-4-6',
        'google/antigravity-claude-opus-4-6-thinking',
        // Gemini CLI quota models
        'google/gemini-2.5-flash',
        'google/gemini-2.5-pro',
        'google/gemini-3-flash-preview',
        'google/gemini-3-pro-preview',
        'google/gemini-3.1-pro-preview',
        'google/gemini-3.1-pro-preview-customtools',
        // OpenAI models
        'openai/gpt-5.4',
        'openai/gpt-5.3',
        'openai/gpt-5.2',
        // Other providers
        'opencode/minimax-m2.5-free',
    ],
};

export function getAvailableModels(tool: CliTool): string[] {
    return MODELS[tool] || [];
}

/**
 * Checks if a CLI tool is installed and accessible by running it with --help.
 */
export async function checkToolStatus(tool: string): Promise<boolean> {
    return new Promise((resolve) => {
        try {
            const child = spawn(tool, ['--help'], { stdio: 'ignore' });

            child.on('error', () => resolve(false));
            child.on('close', (code) => resolve(code === 0));

            // Timeout after 3 seconds so we don't hang forever
            setTimeout(() => {
                child.kill();
                resolve(false);
            }, 3000);
        } catch (err) {
            resolve(false);
        }
    });
}

interface RunOptions {
    agent: Agent;
    prompt: string;
    workspacePath: string;
    onData: (chunk: string) => void;
    onError: (error: string) => void;
    onComplete: (fullOutput: string) => void;
}

/**
 * Build the command + args for each CLI tool.
 * For Claude, we pipe via stdin. For others, we pass the prompt as an argument.
 */
function buildCommand(agent: Agent, workspacePath: string, fullPrompt: string): { cmd: string; args: string[], useStdin: boolean } {
    const { cliTool, extraArgs } = agent;

    // Ensure the model is valid for the selected tool, or fallback to the recommended default
    const available = MODELS[cliTool];
    let model = agent.model?.trim();

    // OpenCode uses provider/model format which changes frequently – trust user input
    if (cliTool === 'opencode') {
        if (!model && available && available.length > 0) {
            model = available[0];
        }
    } else if (model && available && !available.includes(model)) {
        console.warn(`[CLI Runner] Invalid model '${model}' for tool '${cliTool}'. Falling back to default: '${available[0]}'`);
        model = available[0];
    } else if (!model && available && available.length > 0) {
        model = available[0]; // Strict default
    }

    switch (cliTool) {
        case 'claude':
            return {
                cmd: 'claude',
                args: [
                    '--print',        // non-interactive mode
                    ...(model ? ['--model', model] : []),
                    '--output-format', 'text',
                    '--dangerously-skip-permissions',
                    '--add-dir', workspacePath,
                    ...extraArgs,
                ],
                useStdin: true
            };

        case 'gemini':
            return {
                cmd: 'gemini',
                args: [
                    ...(model ? ['-m', model] : []),
                    '-y',                 // yolo mode: auto-approve all actions
                    '-p', 'process the instructions from stdin', // short trigger for headless mode
                    '-o', 'text',         // plain text output
                    '--include-directories', workspacePath,
                    ...extraArgs,
                ],
                useStdin: true            // actual prompt piped via stdin (avoids Windows cmd length limit)
            };

        case 'codex':
            return {
                cmd: 'codex',
                args: [
                    'exec',               // non-interactive mode
                    ...(model ? ['-m', model] : []),
                    '--color', 'never',
                    '--skip-git-repo-check',
                    ...extraArgs,
                    '-',                  // read prompt from stdin
                ],
                useStdin: true
            };

        case 'opencode':
            return {
                cmd: 'opencode',
                args: [
                    'run',
                    ...(model ? ['-m', model] : []),
                    ...extraArgs,
                ],
                useStdin: true
            };

        default:
            throw new Error(`Unknown CLI tool: ${cliTool satisfies never}`);
    }
}


/**
 * Build the full prompt text that will be piped via stdin.
 * Includes system prompt context if available.
 */
function buildFullPrompt(agent: Agent, userPrompt: string): string {
    const parts: string[] = [];

    if (agent.systemPrompt) {
        parts.push(`[SYSTEM INSTRUCTIONS]\n${agent.systemPrompt}\n`);
    }

    parts.push(userPrompt);

    return parts.join('\n');
}

/**
 * Run an agent's CLI tool with a prompt piped through stdin
 */
export function runAgent(options: RunOptions): ChildProcess {
    const { agent, prompt, workspacePath, onData, onError, onComplete } = options;
    const fullPrompt = buildFullPrompt(agent, prompt);
    const { cmd, args, useStdin } = buildCommand(agent, workspacePath, fullPrompt);

    console.log(`[CLI Runner] ─────────────────────────────────────`);
    console.log(`[CLI Runner] Agent: ${agent.name} (${agent.cliTool})`);
    console.log(`[CLI Runner] Command: ${cmd} ${args.join(' ')}`);
    console.log(`[CLI Runner] Prompt length: ${fullPrompt.length} chars`);
    console.log(`[CLI Runner] Workspace: ${workspacePath}`);
    console.log(`[CLI Runner] Using stdin: ${useStdin}`);

    // All tools run from the workspace directory
    const cwd = workspacePath;

    // stdin: 'pipe' for tools that receive prompt via stdin, 'ignore' for the rest
    const stdinMode = useStdin ? 'pipe' : 'ignore';

    const spawnEnv = { ...process.env, TERM: 'dumb', NO_COLOR: '1', FORCE_COLOR: undefined };

    // Gemini CLI uses node-pty (ConPTY) internally which needs a Windows console.
    // Spawning with shell:true via native spawn gives cmd.exe a console context.
    const child = agent.cliTool === 'gemini'
        ? nodeSpawn(cmd, args, {
            cwd,
            shell: true,
            env: spawnEnv,
            stdio: [stdinMode, 'pipe', 'pipe'],
            windowsHide: false,
        })
        : spawn(cmd, args, {
            cwd,
            shell: false,
            env: spawnEnv,
            stdio: [stdinMode, 'pipe', 'pipe'],
        });

    // ─── Pipe prompt through stdin (avoids shell escaping) ────
    if (useStdin && child.stdin) {
        child.stdin.write(fullPrompt);
        child.stdin.end();
        console.log(`[CLI Runner] Prompt piped to stdin ✓`);
    }

    let fullOutput = '';
    let skipCodexToolOutput = false;

    child.stdout?.on('data', (data: Buffer) => {
        let chunk = data.toString();
        console.log(`[CLI Runner] stdout: ${chunk.substring(0, 100)}...`);

        // OpenCode: filter startup noise from stdout (bun install, ANSI codes, shell resets)
        if (agent.cliTool === 'opencode') {
            // Strip ANSI escape codes
            chunk = chunk.replace(/\x1b\[[0-9;]*m/g, '');
            // Filter out bun install lines, shell cwd resets, and empty-ish lines
            const lines = chunk.split('\n');
            const cleanLines = lines.filter((line) => {
                const t = line.trim();
                if (!t) return false;
                if (t.startsWith('bun install')) return false;
                if (t.startsWith('Checked ') && t.includes('installs')) return false;
                if (t.startsWith('Shell cwd was reset')) return false;
                if (t.startsWith('> ') && (t.includes('Ultraworker') || t.includes('·'))) return false;
                if (t.startsWith('dotenv@')) return false;
                if (t.includes('injecting env')) return false;
                return true;
            });
            chunk = cleanLines.join('\n');
            if (!chunk.trim()) return; // Skip entirely empty chunks
        }

        fullOutput += chunk;
        onData(chunk);
    });

    child.stderr?.on('data', (data: Buffer) => {
        const errChunk = data.toString();
        console.log(`[CLI Runner] stderr: ${errChunk.substring(0, 100)}...`);

        // Filter out MCP/startup noise but keep agent progress
        const isNoise = /^(mcp:|Loading extension:|Loaded cached|YOLO mode|2\d{3}-\d{2}-\d{2}T|ERROR rmcp|OpenAI Codex v|--------|\s*$)/.test(errChunk.trim())
            || errChunk.includes('MCP client for')
            || errChunk.includes('startup_timeo')
            || errChunk.includes('MCP info')
            || errChunk.includes('mcp startup:')
            || errChunk.includes('"isError"')
            || errChunk.includes('"content"')
            || errChunk.includes('worker quit with fatal')
            // OpenCode noise
            || errChunk.includes('config-context')
            || errChunk.includes('getConfigContext')
            || errChunk.includes('Sisyphus')
            || /^\[0m/.test(errChunk.trim())
            || /^\x1b\[/.test(errChunk);

        if (!isNoise) {
            // For codex: extract the useful "codex thinking" lines and command outputs
            if (agent.cliTool === 'codex') {
                // Use state to mute entire blocks of tool execution (preventing file dumps in UI)
                const lines = errChunk.split('\n');
                const cleanLines: string[] = [];

                for (const line of lines) {
                    const t = line.trim();
                    if (t.length === 0) continue;

                    // 'codex' by itself means the assistant is writing a natural language thought
                    if (t === 'codex') {
                        skipCodexToolOutput = false;
                        continue; // Omit the header itself
                    }

                    // Tools start with command words. Mute everything until the next 'codex' block
                    if (t === 'exec' || t === 'python' || t.startsWith('codex.')) {
                        skipCodexToolOutput = true;
                        continue;
                    }

                    // Unconditional filters for pure JSON or system noises
                    if (t.startsWith('{') || t.startsWith('}') || t.startsWith('"') ||
                        t.startsWith('tool ') || t.startsWith('approval_') || t.startsWith('provider') ||
                        t.match(/^succeeded in \d+ms:/) || t.match(/^exited [-]?\d+ in \d+ms:/)) {
                        continue;
                    }

                    if (!skipCodexToolOutput) {
                        cleanLines.push(line);
                    }
                }

                if (cleanLines.length > 0) {
                    const cleaned = cleanLines.join('\n');
                    fullOutput += cleaned + '\n';
                    onData(cleaned + '\n');
                }
            } else {
                fullOutput += errChunk;
                onData(errChunk);
            }
        }
    });

    child.on('error', (err) => {
        console.error(`[CLI Runner] ERROR: Failed to start ${cmd}: ${err.message}`);
        onError(`Failed to start ${cmd}: ${err.message}`);
    });

    child.on('close', (code) => {
        console.log(`[CLI Runner] Process exited with code ${code}`);
        if (code !== 0 && code !== null) {
            onError(`${cmd} exited with code ${code}`);
        }
        onComplete(fullOutput);
    });

    return child;
}
