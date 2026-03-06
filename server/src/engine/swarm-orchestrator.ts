// ============================================================
// Swarm Orchestrator – Autonomous multi-agent collaboration loop
// Runs in rounds: Coordinator decides -> Workers execute -> Repeat
// ============================================================

import type { Swarm, SwarmAgent, SwarmRound, WsMessage } from '../types.js';
import { runAgent } from './cli-runner.js';
import { getAgentById, getSwarmById } from '../data/store.js';

type WsBroadcast = (msg: WsMessage) => void;

/**
 * Execute an autonomous agent swarm loop.
 *
 * Each round:
 * 1. Coordinator receives accumulated context and decides what to do next
 * 2. Worker agent executes the assigned task
 * 3. Coordinator reviews and decides: continue or SWARM_COMPLETE
 *
 * Safety: maxRounds prevents infinite loops.
 */
export async function executeSwarm(
    swarm: Swarm,
    broadcast: WsBroadcast,
    onUpdate: (updates: Partial<Swarm>) => void
): Promise<void> {
    const { agents, workspacePath, maxRounds } = swarm;

    // Find the coordinator agent
    const coordinatorSwarmAgent = agents.find((a) => a.role === 'coordinator');
    if (!coordinatorSwarmAgent) {
        const error = 'No coordinator agent found in swarm. At least one agent must have the "coordinator" role.';
        broadcast({ type: 'swarm_error', taskId: swarm.id, error });
        onUpdate({ status: 'error' });
        return;
    }

    const coordinatorAgent = getAgentById(coordinatorSwarmAgent.agentId);
    if (!coordinatorAgent) {
        const error = `Coordinator agent "${coordinatorSwarmAgent.agentId}" not found in agent store.`;
        broadcast({ type: 'swarm_error', taskId: swarm.id, error });
        onUpdate({ status: 'error' });
        return;
    }

    // Collect all worker swarm agents (non-coordinator)
    const workerSwarmAgents = agents.filter((a) => a.role !== 'coordinator');

    // Build team description for the coordinator
    const teamDescription = workerSwarmAgents
        .map((sa) => {
            const agent = getAgentById(sa.agentId);
            const name = agent?.name ?? sa.agentId;
            return `- ${name} (${sa.role}) [id: ${sa.agentId}]: ${sa.instructions}`;
        })
        .join('\n');

    const rounds: SwarmRound[] = [...swarm.rounds];
    let currentRound = swarm.currentRound || 0;

    onUpdate({ status: 'running', currentRound });

    broadcast({
        type: 'swarm_status',
        taskId: swarm.id,
        data: `Swarm "${swarm.name}" starting with ${agents.length} agent(s), max ${maxRounds} rounds.`,
    });

    try {
        while (currentRound < maxRounds) {
            currentRound++;

            // ── Step 1: Coordinator decides what to do next ──────────
            // Check if swarm was stopped externally
            const currentSwarm = getSwarmById(swarm.id);
            if (currentSwarm && currentSwarm.status !== 'running') {
                broadcast({ type: 'swarm_complete', taskId: swarm.id, data: `Swarm stopped.` });
                return;
            }

            const coordinatorPrompt = buildCoordinatorPrompt(
                workspacePath,
                swarm.name,
                coordinatorSwarmAgent,
                teamDescription,
                rounds,
                swarm.description
            );

            broadcast({
                type: 'swarm_round',
                taskId: swarm.id,
                agentId: coordinatorAgent.id,
                agentName: coordinatorAgent.name,
                data: `Round ${currentRound}: Coordinator "${coordinatorAgent.name}" is planning...`,
            });

            broadcast({
                type: 'agent_start',
                taskId: swarm.id,
                agentId: coordinatorAgent.id,
                agentName: coordinatorAgent.name,
            });

            const coordinatorOutput = await runAgentAsync(
                coordinatorAgent,
                coordinatorPrompt,
                workspacePath,
                swarm.id,
                broadcast
            );

            const coordinatorRound: SwarmRound = {
                round: currentRound,
                agentId: coordinatorAgent.id,
                agentName: coordinatorAgent.name,
                role: 'coordinator',
                input: coordinatorPrompt,
                output: coordinatorOutput,
                timestamp: new Date().toISOString(),
            };
            rounds.push(coordinatorRound);

            // Output already streamed via agent_output, no need to re-broadcast full text

            // Persist after coordinator round
            onUpdate({ rounds: [...rounds], currentRound });

            // ── Check if the coordinator says we are done ────────────
            if (coordinatorOutput.includes('SWARM_COMPLETE')) {
                broadcast({
                    type: 'swarm_complete',
                    taskId: swarm.id,
                    data: `Swarm "${swarm.name}" completed after ${currentRound} round(s).`,
                });
                onUpdate({ rounds: [...rounds], currentRound, status: 'completed' });
                return;
            }

            // ── Step 2: Parse coordinator's delegation ───────────────
            const delegation = parseDelegation(coordinatorOutput, workerSwarmAgents);

            if (!delegation) {
                // Coordinator didn't produce a valid delegation; treat as error
                const errorMsg = `Round ${currentRound}: Coordinator did not output a valid NEXT_AGENT/TASK delegation or SWARM_COMPLETE. Raw output saved.`;
                broadcast({
                    type: 'swarm_error',
                    taskId: swarm.id,
                    agentId: coordinatorAgent.id,
                    agentName: coordinatorAgent.name,
                    error: errorMsg,
                });
                // Continue to next round so coordinator can try again
                continue;
            }

            // ── Step 3: Run the assigned worker agent ────────────────
            const workerAgent = getAgentById(delegation.agentId);
            if (!workerAgent) {
                const errorMsg = `Worker agent "${delegation.agentId}" not found in agent store.`;
                broadcast({
                    type: 'swarm_error',
                    taskId: swarm.id,
                    error: errorMsg,
                });
                continue;
            }

            const workerSwarmAgent = workerSwarmAgents.find((sa) => sa.agentId === delegation.agentId);
            const workerPrompt = buildWorkerPrompt(
                workspacePath,
                workerSwarmAgent,
                workerAgent,
                delegation.task,
                rounds
            );

            broadcast({
                type: 'swarm_round',
                taskId: swarm.id,
                agentId: workerAgent.id,
                agentName: workerAgent.name,
                data: `Round ${currentRound}: Worker "${workerAgent.name}" executing task...`,
            });

            broadcast({
                type: 'agent_start',
                taskId: swarm.id,
                agentId: workerAgent.id,
                agentName: workerAgent.name,
            });

            const workerOutput = await runAgentAsync(
                workerAgent,
                workerPrompt,
                workspacePath,
                swarm.id,
                broadcast
            );

            const workerRound: SwarmRound = {
                round: currentRound,
                agentId: workerAgent.id,
                agentName: workerAgent.name,
                role: workerSwarmAgent?.role ?? 'developer',
                input: delegation.task,
                output: workerOutput,
                timestamp: new Date().toISOString(),
            };
            rounds.push(workerRound);

            // Output already streamed via agent_output, no need to re-broadcast full text

            // Persist after worker round
            onUpdate({ rounds: [...rounds], currentRound });
        }

        // Reached maxRounds without SWARM_COMPLETE
        broadcast({
            type: 'swarm_complete',
            taskId: swarm.id,
            data: `Swarm "${swarm.name}" reached maximum rounds (${maxRounds}). Stopping.`,
        });
        onUpdate({ rounds: [...rounds], currentRound, status: 'completed' });

    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        broadcast({
            type: 'swarm_error',
            taskId: swarm.id,
            error: `Swarm error: ${errorMsg}`,
        });
        onUpdate({ rounds: [...rounds], currentRound, status: 'error' });
    }
}

// ── Prompt Builders ─────────────────────────────────────────────

/**
 * Build the coordinator's prompt with accumulated context from all rounds.
 */
function buildCoordinatorPrompt(
    workspacePath: string,
    swarmName: string,
    coordinatorSwarmAgent: SwarmAgent,
    teamDescription: string,
    rounds: SwarmRound[],
    swarmDescription: string
): string {
    const previousContext = rounds.length > 0
        ? rounds
            .map((r) => `[Round ${r.round} | ${r.agentName} (${r.role})]:\n${r.output}`)
            .join('\n\n---\n\n')
        : '(No previous rounds yet. This is the first round. Start by analyzing the project structure.)';

    const objective = swarmDescription || swarmName;

    return `You are the COORDINATOR of an autonomous agent swarm.

PROJECT PATH: ${workspacePath}
SWARM NAME: ${swarmName}

YOUR OBJECTIVE:
${objective}

${coordinatorSwarmAgent.instructions ? `YOUR ADDITIONAL INSTRUCTIONS:\n${coordinatorSwarmAgent.instructions}\n` : ''}

YOUR TEAM (use the exact agent ID when delegating):
${teamDescription}

IMPORTANT RULES:
- You MUST delegate work to your team members. Do NOT try to do the work yourself.
- First analyze the project directory to understand what exists and what needs to be done.
- Break down the objective into concrete tasks for your team.
- Each round, assign ONE specific task to ONE team member.
- Give detailed, actionable instructions including file paths, what to create/modify, and expected outcomes.
- After a team member completes their task, review their output and decide the next step.
- Only output SWARM_COMPLETE when the entire objective has been fully achieved across multiple rounds.
- Do NOT output SWARM_COMPLETE on the first round - always delegate at least one task first.

PREVIOUS ROUNDS:
${previousContext}

OUTPUT FORMAT (you MUST follow this exactly):
NEXT_AGENT: <the agent ID from the team list above>
TASK: <detailed description of what this agent should do, including specific files, code structure, and expected results>`;
}

/**
 * Build a worker agent's prompt with its assigned task and context.
 */
function buildWorkerPrompt(
    workspacePath: string,
    swarmAgent: SwarmAgent | undefined,
    workerAgent: { name: string; roleLabel: string },
    taskDescription: string,
    rounds: SwarmRound[]
): string {
    const role = swarmAgent?.role ?? 'worker';
    const instructions = swarmAgent?.instructions ?? '';

    // Only include the last few rounds to avoid context overflow
    const recentRounds = rounds.slice(-6);
    const previousContext = recentRounds.length > 0
        ? recentRounds
            .map((r) => `[Round ${r.round} | ${r.agentName} (${r.role})]:\n${r.output.slice(0, 2000)}`)
            .join('\n\n---\n\n')
        : '';

    return `PROJECT PATH: ${workspacePath}
YOUR ROLE: ${role} (${workerAgent.name})
${instructions ? `YOUR STANDING INSTRUCTIONS: ${instructions}\n` : ''}
ASSIGNED TASK FROM COORDINATOR:
${taskDescription}

${previousContext ? `RECENT TEAM CONTEXT:\n${previousContext}\n` : ''}
IMPORTANT: Execute the task above thoroughly. Create, modify, or analyze files as needed. Be specific and complete in your work. Output your results clearly.`;
}

// ── Delegation Parser ───────────────────────────────────────────

interface Delegation {
    agentId: string;
    task: string;
}

/**
 * Parse the coordinator's output to extract the next agent and task.
 * Expects format:
 *   NEXT_AGENT: <agentId>
 *   TASK: <description>
 */
function parseDelegation(
    coordinatorOutput: string,
    workerSwarmAgents: SwarmAgent[]
): Delegation | null {
    const agentMatch = coordinatorOutput.match(/NEXT_AGENT:\s*(.+)/i);
    const taskMatch = coordinatorOutput.match(/TASK:\s*([\s\S]*?)(?=\n(?:NEXT_AGENT:|$)|\s*$)/i);

    if (!agentMatch || !taskMatch) {
        return null;
    }

    const rawAgentId = agentMatch[1].trim();
    const task = taskMatch[1].trim();

    if (!task) {
        return null;
    }

    // Try exact match first
    const exactMatch = workerSwarmAgents.find((sa) => sa.agentId === rawAgentId);
    if (exactMatch) {
        return { agentId: exactMatch.agentId, task };
    }

    // Try matching by agent name (coordinator might use the name instead of ID)
    const nameMatch = workerSwarmAgents.find((sa) => {
        const agent = getAgentById(sa.agentId);
        return agent?.name.toLowerCase() === rawAgentId.toLowerCase();
    });
    if (nameMatch) {
        return { agentId: nameMatch.agentId, task };
    }

    // Try partial / fuzzy match on ID or name
    const partialMatch = workerSwarmAgents.find((sa) => {
        const agent = getAgentById(sa.agentId);
        const lowerRaw = rawAgentId.toLowerCase();
        return (
            sa.agentId.toLowerCase().includes(lowerRaw) ||
            lowerRaw.includes(sa.agentId.toLowerCase()) ||
            agent?.name.toLowerCase().includes(lowerRaw) ||
            lowerRaw.includes(agent?.name.toLowerCase() ?? '')
        );
    });
    if (partialMatch) {
        return { agentId: partialMatch.agentId, task };
    }

    // If no match found, default to the first worker so the swarm doesn't stall
    if (workerSwarmAgents.length > 0) {
        return { agentId: workerSwarmAgents[0].agentId, task };
    }

    return null;
}

// ── CLI Runner Promise Wrapper ──────────────────────────────────

/**
 * Promise wrapper around the CLI runner (same pattern as orchestrator.ts)
 */
function runAgentAsync(
    agent: Parameters<typeof runAgent>[0]['agent'],
    prompt: string,
    workspacePath: string,
    swarmId: string,
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
                    taskId: swarmId,
                    agentId: agent.id,
                    agentName: agent.name,
                    data: chunk,
                });
            },
            onError: (error) => {
                console.error(`[Swarm Orchestrator] Agent "${agent.name}" error:`, error);
                broadcast({
                    type: 'swarm_error',
                    taskId: swarmId,
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
