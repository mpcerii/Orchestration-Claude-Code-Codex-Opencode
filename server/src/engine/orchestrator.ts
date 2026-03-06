// ============================================================
// Orchestrator – Walks the Agent Tree and routes I/O
// ============================================================

import type { Agent, AgentTree, TreeNode, Task, TaskOutput, WsMessage } from '../types.js';
import { runAgent } from './cli-runner.js';
import { getAgentById } from '../data/store.js';

type WsBroadcast = (msg: WsMessage) => void;

/**
 * Execute a full task through an agent tree
 * Walks the tree depth-first, passing each agent's output to its children
 */
export async function executeTask(
    task: Task,
    tree: AgentTree,
    broadcast: WsBroadcast
): Promise<TaskOutput[]> {
    const outputs: TaskOutput[] = [];

    // Ensure there is always a valid prompt to begin with
    const initialPrompt = task.prompt?.trim() || task.description?.trim() || task.title;

    // Walk each root node with the task's initial prompt
    for (const rootNode of tree.rootNodes) {
        await walkNode(rootNode, initialPrompt, task, tree, outputs, broadcast);
    }

    broadcast({
        type: 'task_complete',
        taskId: task.id,
        data: `Task "${task.title}" completed with ${outputs.length} agent(s).`,
    });

    return outputs;
}

/**
 * Recursively walk a tree node:
 * 1. Run this agent with the given input
 * 2. Pass the output to each child node
 */
async function walkNode(
    node: TreeNode,
    input: string,
    task: Task,
    tree: AgentTree,
    outputs: TaskOutput[],
    broadcast: WsBroadcast
): Promise<string> {
    const agent = getAgentById(node.agentId);
    if (!agent) {
        const errMsg = `Agent ${node.agentId} not found`;
        broadcast({ type: 'agent_error', taskId: task.id, agentId: node.agentId, error: errMsg });
        return errMsg;
    }

    // Prepend system context about the agent's role
    const enrichedPrompt = buildEnrichedPrompt(agent, input);

    // Notify: agent starting
    broadcast({
        type: 'agent_start',
        taskId: task.id,
        agentId: agent.id,
        agentName: agent.name,
        data: `Agent "${agent.name}" (${agent.roleLabel}) starting...`,
    });

    const output = await runAgentAsync(agent, enrichedPrompt, tree.workspacePath, task.id, broadcast);

    const taskOutput: TaskOutput = {
        agentId: agent.id,
        agentName: agent.name,
        input,
        output,
        status: 'completed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
    };
    outputs.push(taskOutput);

    // Notify: agent completed
    broadcast({
        type: 'agent_complete',
        taskId: task.id,
        agentId: agent.id,
        agentName: agent.name,
        data: output,
    });

    // If this node has children, pass the output to them
    if (node.children.length > 0) {
        if (node.executionMode === 'parallel') {
            // Run all children in parallel
            await Promise.all(
                node.children.map((child) => walkNode(child, output, task, tree, outputs, broadcast))
            );
        } else {
            // Run children sequentially – each gets the accumulated context
            let childInput = output;
            for (const child of node.children) {
                childInput = await walkNode(child, childInput, task, tree, outputs, broadcast);
            }
        }
    }

    return output;
}

/**
 * Build an enriched prompt that includes the agent's role context.
 * This text is piped via stdin to the CLI (not as a shell argument).
 */
function buildEnrichedPrompt(agent: Agent, userInput: string): string {
    return `[ROLE: ${agent.roleLabel}]
You are the ${agent.roleLabel} in this team.

[TASK INPUT]
${userInput}

Please process this input according to your role and responsibilities.`;
}

/**
 * Promise wrapper around the CLI runner
 */
function runAgentAsync(
    agent: Agent,
    prompt: string,
    workspacePath: string,
    taskId: string,
    broadcast: WsBroadcast
): Promise<string> {
    return new Promise((resolve, reject) => {
        let hasResolved = false;

        const child = runAgent({
            agent,
            prompt,
            workspacePath,
            onData: (chunk) => {
                broadcast({
                    type: 'agent_output',
                    taskId,
                    agentId: agent.id,
                    agentName: agent.name,
                    data: chunk,
                });
            },
            onError: (error) => {
                console.error(`[Orchestrator] Agent "${agent.name}" error:`, error);
                broadcast({
                    type: 'agent_error',
                    taskId,
                    agentId: agent.id,
                    agentName: agent.name,
                    error,
                });
                // If process couldn't start, reject
                if (!hasResolved && error.startsWith('Failed to start')) {
                    hasResolved = true;
                    reject(new Error(error));
                }
            },
            onComplete: (fullOutput) => {
                if (!hasResolved) {
                    hasResolved = true;
                    resolve(fullOutput);
                }
            },
        });
    });
}
