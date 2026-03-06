// ============================================================
// CLI Runner – Spawns AI CLI tools and captures output
// Prompts are piped via stdin to avoid shell escaping issues
// ============================================================

import { spawn, type ChildProcess } from 'child_process';
import type { Agent } from '../types.js';

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
 * NOTE: Prompt and system prompt are NOT in args – they are piped via stdin.
 * This avoids shell escaping issues with multi-line, multi-word prompts.
 */
function buildCommand(agent: Agent, workspacePath: string): { cmd: string; args: string[] } {
    const { cliTool, model, extraArgs } = agent;

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
            };

        case 'gemini':
            return {
                cmd: 'gemini',
                args: [
                    ...(model ? ['-m', model] : []),
                    '--approval-mode', 'yolo',
                    ...extraArgs,
                ],
            };

        case 'codex':
            return {
                cmd: 'codex',
                args: [
                    ...(model ? ['-m', model] : []),
                    '-C', workspacePath,
                    '--full-auto',
                    ...extraArgs,
                ],
            };

        case 'opencode':
            return {
                cmd: 'opencode',
                args: [
                    ...(model ? ['-m', model] : []),
                    ...extraArgs,
                ],
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
    const { cmd, args } = buildCommand(agent, workspacePath);
    const fullPrompt = buildFullPrompt(agent, prompt);

    console.log(`[CLI Runner] ─────────────────────────────────────`);
    console.log(`[CLI Runner] Agent: ${agent.name} (${agent.cliTool})`);
    console.log(`[CLI Runner] Command: ${cmd} ${args.join(' ')}`);
    console.log(`[CLI Runner] Prompt length: ${fullPrompt.length} chars`);
    console.log(`[CLI Runner] Workspace: ${workspacePath}`);
    console.log(`[CLI Runner] Piping prompt via stdin...`);

    const cwd = ['codex', 'opencode'].includes(agent.cliTool) ? workspacePath : undefined;

    const child = spawn(cmd, args, {
        cwd,
        shell: true,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
    });

    // ─── Pipe prompt through stdin (avoids shell escaping) ────
    if (child.stdin) {
        child.stdin.write(fullPrompt);
        child.stdin.end();
        console.log(`[CLI Runner] Prompt piped to stdin ✓`);
    }

    let fullOutput = '';

    child.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        fullOutput += chunk;
        console.log(`[CLI Runner] stdout: ${chunk.substring(0, 100)}...`);
        onData(chunk);
    });

    child.stderr?.on('data', (data: Buffer) => {
        const errChunk = data.toString();
        // Some CLIs write progress/status to stderr – forward as output
        fullOutput += errChunk;
        console.log(`[CLI Runner] stderr: ${errChunk.substring(0, 100)}...`);
        onData(errChunk);
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
