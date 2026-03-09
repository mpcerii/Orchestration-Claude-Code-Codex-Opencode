// ============================================================
// Swarm Orchestrator – Enterprise Multi-Agent Pipeline
//
// Architecture:
//   Coordinator (CEO) ─── the brain, delegates & reviews
//        │
//   ┌────┼────┬────────┐
//   ↓    ↓    ↓        ↓
//  Dev  Designer  ...  Analyst   ← workers (parallel possible)
//   │    │
//   ↓    ↓
//  Code  UI        ← reviewers check via AFTER chains
//  Rev   Rev
//   │    │
//   └──→─┘──→ Coordinator reviews STATUS
//              APPROVED → next stage
//              NEEDS_FIX → feedback loop back to worker
//
// Features:
//   - Multi-agent delegation per round (parallel execution)
//   - Agent-to-agent output routing via AFTER keyword
//   - Feedback loops: Reviewer → NEEDS_FIX → Coordinator → Worker
//   - Pipeline stages with iteration tracking
//   - Max 3 feedback iterations per stage to prevent infinite loops
// ============================================================

import type { Swarm, SwarmAgent, SwarmRound, WsMessage } from '../types.js';
import type { RunContext } from '../core/runtime/RunContext.js';
import { runEngine } from '../core/runtime/RunEngine.js';
import { runAgent } from './cli-runner.js';
import { getAgentById, getSwarmById } from '../data/store.js';

type WsBroadcast = (msg: WsMessage) => void;

// ── Types ────────────────────────────────────────────────────

interface Delegation {
    agentId: string;
    task: string;
    afterAgentId?: string;
}

const MAX_FEEDBACK_ITERATIONS = 3;

// ── Main Entry Point ─────────────────────────────────────────

export async function executeSwarm(
    swarm: Swarm,
    broadcast: WsBroadcast,
    onUpdate: (updates: Partial<Swarm>) => void,
    runContext: RunContext
): Promise<void> {
    runEngine.startRun(runContext);
    const { agents, workspacePath, maxRounds } = swarm;
    const minRounds = swarm.minRounds || 1;

    // ── Validate coordinator ──
    const coordinatorSwarmAgent = agents.find((a) => a.role === 'coordinator');
    if (!coordinatorSwarmAgent) {
        broadcast({ type: 'swarm_error', taskId: swarm.id, error: 'No coordinator agent found in swarm.' });
        onUpdate({ status: 'error' });
        runEngine.failRun(runContext.runId, 'No coordinator agent found in swarm.');
        return;
    }

    const coordinatorAgent = getAgentById(coordinatorSwarmAgent.agentId);
    if (!coordinatorAgent) {
        broadcast({ type: 'swarm_error', taskId: swarm.id, error: `Coordinator agent "${coordinatorSwarmAgent.agentId}" not found.` });
        onUpdate({ status: 'error' });
        runEngine.failRun(runContext.runId, `Coordinator agent "${coordinatorSwarmAgent.agentId}" not found.`);
        return;
    }

    // ── Collect workers ──
    const workerSwarmAgents = agents.filter((a) => a.role !== 'coordinator');

    // Count how many times each agent appears to add suffix for disambiguation
    const agentCounts = new Map<string, number>();
    for (const sa of workerSwarmAgents) {
        agentCounts.set(sa.agentId, (agentCounts.get(sa.agentId) ?? 0) + 1);
    }
    const agentIndex = new Map<string, number>();

    const teamDescription = workerSwarmAgents
        .map((sa) => {
            const agent = getAgentById(sa.agentId);
            const baseName = agent?.name ?? sa.agentId;
            const tool = agent?.cliTool ?? 'unknown';
            // If same agent used multiple times, add role suffix for clarity
            const count = agentCounts.get(sa.agentId) ?? 1;
            let displayName = baseName;
            if (count > 1) {
                const idx = (agentIndex.get(sa.agentId) ?? 0) + 1;
                agentIndex.set(sa.agentId, idx);
                displayName = `${baseName} [${sa.role}]`;
            }
            return `- ${displayName} (${sa.role}, ${tool}) [id: ${sa.agentId}]: ${sa.instructions}`;
        })
        .join('\n');

    const rounds: SwarmRound[] = [...swarm.rounds];
    let currentRound = swarm.currentRound || 0;

    // Track latest output per agent (for AFTER routing)
    const agentOutputs = new Map<string, string>();
    for (const r of rounds) {
        agentOutputs.set(r.agentId, r.output);
    }

    // Track feedback iterations per agent to prevent infinite loops
    const feedbackCount = new Map<string, number>();

    onUpdate({ status: 'running', currentRound });

    broadcast({
        type: 'swarm_status',
        taskId: swarm.id,
        data: `Swarm "${swarm.name}" starting with ${agents.length} agent(s), max ${maxRounds} rounds.`,
    });

    try {
        while (currentRound < maxRounds) {
            currentRound++;

            // ── Check if stopped externally ──
            const currentSwarm = getSwarmById(swarm.id);
            if (currentSwarm && currentSwarm.status !== 'running') {
                broadcast({ type: 'swarm_complete', taskId: swarm.id, data: 'Swarm stopped.' });
                runEngine.finishRun(runContext.runId);
                return;
            }

            // ═══════════════════════════════════════════════════════
            // PHASE 1: Coordinator plans the next step(s)
            // ═══════════════════════════════════════════════════════

            const coordinatorPrompt = buildCoordinatorPrompt(
                workspacePath, swarm.name, coordinatorSwarmAgent,
                teamDescription, rounds, swarm.description, feedbackCount,
                currentRound, minRounds, maxRounds
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
                coordinatorAgent, coordinatorPrompt, workspacePath, swarm.id, broadcast
            );
            runContext.agentChain.push(coordinatorAgent.name);

            broadcast({
                type: 'agent_complete',
                taskId: swarm.id,
                agentId: coordinatorAgent.id,
                agentName: coordinatorAgent.name,
            });

            const coordinatorRound: SwarmRound = {
                round: currentRound,
                agentId: coordinatorAgent.id,
                agentName: coordinatorAgent.name,
                role: 'coordinator',
                input: '(coordinator prompt)',
                output: coordinatorOutput,
                timestamp: new Date().toISOString(),
            };
            rounds.push(coordinatorRound);
            onUpdate({ rounds: [...rounds], currentRound });

            // ── Check completion ──
            if (coordinatorOutput.includes('SWARM_COMPLETE')) {
                if (currentRound < minRounds) {
                    // Not enough rounds yet — skip to next coordinator round with forced continuation
                    broadcast({
                        type: 'swarm_status',
                        taskId: swarm.id,
                        data: `Round ${currentRound}: SWARM_COMPLETE ignored — minimum ${minRounds} rounds required (${currentRound}/${minRounds}). Forcing next round...`,
                    });
                    continue; // Skip delegation parsing, go straight to next coordinator round
                } else {
                    broadcast({
                        type: 'swarm_complete',
                        taskId: swarm.id,
                        data: `Swarm "${swarm.name}" completed after ${currentRound} round(s).`,
                    });
                    onUpdate({ rounds: [...rounds], currentRound, status: 'completed' });
                    runEngine.finishRun(runContext.runId);
                    return;
                }
            }

            // ── Check for missing delegation (coordinator wrote analysis but no NEXT_AGENT) ──
            if (!coordinatorOutput.match(/NEXT_AGENT:/i)) {
                broadcast({
                    type: 'swarm_status',
                    taskId: swarm.id,
                    data: `Round ${currentRound}: Coordinator output has no NEXT_AGENT delegation. Retrying...`,
                });
                continue; // Skip to next round — coordinator will see its own output and try again
            }

            // ═══════════════════════════════════════════════════════
            // PHASE 2: Parse delegations
            // ═══════════════════════════════════════════════════════

            const delegations = parseDelegations(coordinatorOutput, workerSwarmAgents);

            if (delegations.length === 0) {
                broadcast({
                    type: 'swarm_error',
                    taskId: swarm.id,
                    agentId: coordinatorAgent.id,
                    agentName: coordinatorAgent.name,
                    error: `Round ${currentRound}: No valid NEXT_AGENT/TASK delegation found. Retrying next round.`,
                });
                continue;
            }

            // ═══════════════════════════════════════════════════════
            // PHASE 3: Execute workers with dependency resolution
            // ═══════════════════════════════════════════════════════

            const independent = delegations.filter((d) => !d.afterAgentId);
            const dependent = delegations.filter((d) => d.afterAgentId);

            if (independent.length > 1) {
                broadcast({
                    type: 'swarm_status',
                    taskId: swarm.id,
                    data: `Round ${currentRound}: Executing ${independent.length} agents in parallel...`,
                });
            }

            // ── Run independent agents in parallel ──
            if (independent.length > 0) {
                const parallelResults = await Promise.all(
                    independent.map((delegation) =>
                        executeWorker(
                            delegation, workerSwarmAgents, workspacePath,
                            currentRound, rounds, agentOutputs, swarm.id, broadcast
                        )
                    )
                );

                for (let i = 0; i < independent.length; i++) {
                    const result = parallelResults[i];
                    if (result) {
                        agentOutputs.set(independent[i].agentId, result.output);
                        rounds.push(result.round);
                        runContext.agentChain.push(result.round.agentName);

                        // Track feedback iterations
                        trackFeedbackStatus(result.output, independent[i].agentId, feedbackCount);
                    }
                }
            }

            // ── Run dependent agents sequentially (AFTER chains) ──
            for (const delegation of dependent) {
                // Check feedback iteration limit
                const count = feedbackCount.get(delegation.agentId) ?? 0;
                if (count >= MAX_FEEDBACK_ITERATIONS) {
                    broadcast({
                        type: 'swarm_status',
                        taskId: swarm.id,
                        data: `Agent "${getAgentById(delegation.agentId)?.name}" reached max feedback iterations (${MAX_FEEDBACK_ITERATIONS}). Moving on.`,
                    });
                    continue;
                }

                const result = await executeWorker(
                    delegation, workerSwarmAgents, workspacePath,
                    currentRound, rounds, agentOutputs, swarm.id, broadcast
                );
                if (result) {
                    agentOutputs.set(delegation.agentId, result.output);
                    rounds.push(result.round);
                    runContext.agentChain.push(result.round.agentName);

                    trackFeedbackStatus(result.output, delegation.agentId, feedbackCount);
                }
            }

            // Persist after all workers complete
            onUpdate({ rounds: [...rounds], currentRound });
        }

        // Reached maxRounds
        broadcast({
            type: 'swarm_complete',
            taskId: swarm.id,
            data: `Swarm "${swarm.name}" reached maximum rounds (${maxRounds}). Stopping.`,
        });
        onUpdate({ rounds: [...rounds], currentRound, status: 'completed' });
        runEngine.finishRun(runContext.runId);

    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        broadcast({ type: 'swarm_error', taskId: swarm.id, error: `Swarm error: ${errorMsg}` });
        onUpdate({ rounds: [...rounds], currentRound, status: 'error' });
        runEngine.failRun(runContext.runId, errorMsg);
    }
}

// ── Feedback Status Tracking ─────────────────────────────────

function trackFeedbackStatus(output: string, agentId: string, feedbackCount: Map<string, number>): void {
    // Check if this is a reviewer giving feedback
    if (/STATUS:\s*NEEDS_FIX/i.test(output)) {
        const current = feedbackCount.get(agentId) ?? 0;
        feedbackCount.set(agentId, current + 1);
        console.log(`[Swarm] Feedback iteration ${current + 1}/${MAX_FEEDBACK_ITERATIONS} for agent ${agentId}`);
    } else if (/STATUS:\s*APPROVED/i.test(output)) {
        // Reset feedback count on approval - stage passed
        feedbackCount.delete(agentId);
        console.log(`[Swarm] Agent ${agentId} output APPROVED. Feedback counter reset.`);
    }
}

// ── Worker Execution ─────────────────────────────────────────

interface WorkerResult {
    output: string;
    round: SwarmRound;
}

async function executeWorker(
    delegation: Delegation,
    workerSwarmAgents: SwarmAgent[],
    workspacePath: string,
    currentRound: number,
    rounds: SwarmRound[],
    agentOutputs: Map<string, string>,
    swarmId: string,
    broadcast: WsBroadcast
): Promise<WorkerResult | null> {
    const workerAgent = getAgentById(delegation.agentId);
    if (!workerAgent) {
        broadcast({
            type: 'swarm_error',
            taskId: swarmId,
            error: `Worker agent "${delegation.agentId}" not found.`,
        });
        return null;
    }

    const workerSwarmAgent = workerSwarmAgents.find((sa) => sa.agentId === delegation.agentId);

    // Get output from AFTER agent for direct routing
    let afterContext: string | null = null;
    let afterAgentName: string | undefined;
    if (delegation.afterAgentId) {
        afterContext = agentOutputs.get(delegation.afterAgentId) ?? null;
        const afterAgent = getAgentById(delegation.afterAgentId);
        afterAgentName = afterAgent?.name;
    }

    const isReviewer = workerSwarmAgent?.role === 'reviewer' || workerSwarmAgent?.role === 'tester';

    const workerPrompt = buildWorkerPrompt(
        workspacePath, workerSwarmAgent, workerAgent,
        delegation.task, rounds, afterContext, afterAgentName, isReviewer
    );

    const routingInfo = delegation.afterAgentId
        ? ` (receives output from ${afterAgentName ?? delegation.afterAgentId})`
        : '';

    broadcast({
        type: 'swarm_round',
        taskId: swarmId,
        agentId: workerAgent.id,
        agentName: workerAgent.name,
        data: `Round ${currentRound}: Worker "${workerAgent.name}" executing task...${routingInfo}`,
    });

    broadcast({
        type: 'agent_start',
        taskId: swarmId,
        agentId: workerAgent.id,
        agentName: workerAgent.name,
    });

    const output = await runAgentAsync(workerAgent, workerPrompt, workspacePath, swarmId, broadcast);

    broadcast({
        type: 'agent_complete',
        taskId: swarmId,
        agentId: workerAgent.id,
        agentName: workerAgent.name,
    });

    const round: SwarmRound = {
        round: currentRound,
        agentId: workerAgent.id,
        agentName: workerAgent.name,
        role: workerSwarmAgent?.role ?? 'worker',
        input: delegation.task,
        output,
        timestamp: new Date().toISOString(),
    };

    return { output, round };
}

// ── Prompt Builders ──────────────────────────────────────────

function buildCoordinatorPrompt(
    workspacePath: string,
    swarmName: string,
    coordinatorSwarmAgent: SwarmAgent,
    teamDescription: string,
    rounds: SwarmRound[],
    swarmDescription: string,
    feedbackCount: Map<string, number>,
    currentRound: number,
    minRounds: number,
    maxRounds: number
): string {
    const objective = swarmDescription || swarmName;

    // Build previous context grouped by round
    let previousContext: string;
    if (rounds.length === 0) {
        previousContext = '(No previous rounds. This is the first round. Analyze the project and create a plan.)';
    } else {
        const roundGroups = new Map<number, SwarmRound[]>();
        for (const r of rounds) {
            const group = roundGroups.get(r.round) ?? [];
            group.push(r);
            roundGroups.set(r.round, group);
        }

        const parts: string[] = [];
        for (const [roundNum, entries] of roundGroups) {
            const roundParts = entries.map((r) => {
                const output = r.output.length > 3000
                    ? r.output.slice(0, 3000) + '\n... (truncated)'
                    : r.output;
                return `  [${r.agentName} (${r.role})]: ${output}`;
            });
            parts.push(`── Round ${roundNum} ──\n${roundParts.join('\n\n')}`);
        }
        previousContext = parts.join('\n\n');
    }

    // Build feedback status summary
    let feedbackStatus = '';
    if (feedbackCount.size > 0) {
        const entries: string[] = [];
        for (const [agentId, count] of feedbackCount) {
            const agent = getAgentById(agentId);
            entries.push(`  ${agent?.name ?? agentId}: ${count}/${MAX_FEEDBACK_ITERATIONS} feedback iterations used`);
        }
        feedbackStatus = `\nFEEDBACK LOOP STATUS:\n${entries.join('\n')}\n`;
    }

    return `You are the COORDINATOR (CEO) of an autonomous AI agent swarm for software development.
You manage a team of specialized agents and orchestrate their work through a structured pipeline.

PROJECT PATH: ${workspacePath}
SWARM OBJECTIVE: ${objective}

ROUND STATUS: ${currentRound} / ${maxRounds} (min: ${minRounds}, max: ${maxRounds})
${currentRound < minRounds ? `⚠ You MUST continue working. Minimum ${minRounds} rounds required before you can complete. ${minRounds - currentRound} more round(s) needed.` : `You may output SWARM_COMPLETE if the objective is fully achieved.`}
${coordinatorSwarmAgent.instructions ? `\nYOUR INSTRUCTIONS:\n${coordinatorSwarmAgent.instructions}\n` : ''}
YOUR TEAM (use the agent ID or name when delegating):
${teamDescription}
${feedbackStatus}
═══ ENTERPRISE PIPELINE WORKFLOW ═══

You MUST follow this structured development pipeline:

STAGE 1 – PLANNING (You, the Coordinator)
  Analyze the project structure and create a development plan.
  Break the objective into concrete, actionable tasks.

STAGE 2 – IMPLEMENTATION
  Delegate coding/design tasks to the appropriate workers.
  Multiple workers CAN run in parallel if their tasks are independent.
  Use AFTER to chain dependent tasks.

STAGE 3 – REVIEW (Feedback Loop)
  After a worker completes, delegate a REVIEWER to check their work.
  Use AFTER so the reviewer receives the worker's output directly.

  The reviewer will respond with:
    STATUS: APPROVED – work meets quality standards, proceed to next stage
    STATUS: NEEDS_FIX – specific issues listed that need fixing

STAGE 4 – FEEDBACK ROUTING
  If a reviewer says NEEDS_FIX:
    → Re-delegate to the ORIGINAL worker with the reviewer's feedback
    → Use AFTER pointing to the reviewer so the worker sees exactly what to fix
    → Then send back to reviewer (AFTER the worker) for re-review

  If a reviewer says APPROVED:
    → Proceed to the next stage (e.g., design, testing, integration)

  Maximum ${MAX_FEEDBACK_ITERATIONS} feedback iterations per stage. After that, move on.

STAGE 5 – COMPLETION
  When ALL tasks are done and ALL reviews passed: output SWARM_COMPLETE

═══ RULES ═══
- NEVER do the work yourself. ALWAYS delegate.
- NEVER ask the user questions. YOU decide what is best for the project. You are autonomous.
- NEVER offer options like "Option A / Option B / Option C". Just pick the best one and execute.
- Your output MUST ALWAYS contain at least one NEXT_AGENT/TASK block. No exceptions.
- Do NOT write long analysis without delegation. Keep your reasoning brief, then delegate.
- Give detailed instructions: file paths, what to create/modify, expected outcomes.
- On first round: analyze project structure and plan the work.
- Do NOT output SWARM_COMPLETE before round ${minRounds}. You must work for at least ${minRounds} round(s).
- Review ALL previous round outputs before deciding the next step.
- When a reviewer reports NEEDS_FIX, you MUST route the feedback back.

═══ PREVIOUS ROUNDS ═══
${previousContext}

═══ OUTPUT FORMAT ═══

Single delegation:
NEXT_AGENT: <agent name or id>
TASK: <detailed task description>

Multiple delegations (parallel + chained):
NEXT_AGENT: <agent name or id>
TASK: <detailed task>

NEXT_AGENT: <reviewer name or id>
TASK: Review the code/design from <worker>. Check for quality, correctness, and completeness.
AFTER: <worker name or id>

Feedback routing (after NEEDS_FIX):
NEXT_AGENT: <original worker name or id>
TASK: Fix the issues reported by the reviewer: <list specific issues>
AFTER: <reviewer name or id>

NEXT_AGENT: <reviewer name or id>
TASK: Re-review the fixed code/design.
AFTER: <original worker name or id>

When complete:
SWARM_COMPLETE
<summary of what was accomplished>`;
}

function buildWorkerPrompt(
    workspacePath: string,
    swarmAgent: SwarmAgent | undefined,
    workerAgent: { name: string; roleLabel: string },
    taskDescription: string,
    rounds: SwarmRound[],
    afterContext: string | null,
    afterAgentName?: string,
    isReviewer: boolean = false
): string {
    const role = swarmAgent?.role ?? 'worker';
    const instructions = swarmAgent?.instructions ?? '';

    let prompt = `PROJECT PATH: ${workspacePath}
YOUR ROLE: ${role} (${workerAgent.name})
${instructions ? `YOUR STANDING INSTRUCTIONS: ${instructions}\n` : ''}
═══ YOUR ASSIGNED TASK ═══
${taskDescription}
`;

    // Direct output from a previous agent (AFTER chain)
    if (afterContext && afterAgentName) {
        prompt += `
═══ DIRECT INPUT FROM ${afterAgentName.toUpperCase()} ═══
${afterContext}
═══ END OF ${afterAgentName.toUpperCase()}'S OUTPUT ═══
`;
    }

    // Recent rounds for general team awareness
    const recentRounds = rounds.slice(-6);
    if (recentRounds.length > 0) {
        const contextParts = recentRounds.map((r) => {
            const output = r.output.length > 2000
                ? r.output.slice(0, 2000) + '\n... (truncated)'
                : r.output;
            return `[Round ${r.round} | ${r.agentName} (${r.role})]: ${output}`;
        });
        prompt += `\nRECENT TEAM CONTEXT:\n${contextParts.join('\n\n---\n\n')}\n`;
    }

    // Role-specific instructions
    if (isReviewer) {
        prompt += `
═══ REVIEW INSTRUCTIONS ═══
You are a REVIEWER. Your job is to critically evaluate the work done by your teammate.

Check for:
- Code correctness, type safety, and error handling
- Performance issues and potential bugs
- Architecture and design patterns
- Completeness: does it fulfill the task requirements?
- Security vulnerabilities
- Code quality and maintainability

You MUST end your review with exactly one of these status lines:

STATUS: APPROVED
(if the work meets all quality standards and is ready for the next stage)

STATUS: NEEDS_FIX
- Issue 1: <specific description of what's wrong and how to fix it>
- Issue 2: <specific description>
- ...

Be specific and actionable in your feedback. Point to exact files, lines, and code.
Do NOT just say "looks good" — explain WHY it's good or what specifically needs fixing.
`;
    } else {
        prompt += `
═══ EXECUTION INSTRUCTIONS ═══
Execute your task thoroughly. Create, modify, or analyze files as needed.
Be specific and complete in your work.
Output your results clearly so the reviewer and coordinator can evaluate them.
If you received feedback from a reviewer (via DIRECT INPUT above), address EVERY issue listed.
Explain what you changed and why.
`;
    }

    return prompt;
}

// ── Delegation Parser ────────────────────────────────────────

function parseDelegations(
    coordinatorOutput: string,
    workerSwarmAgents: SwarmAgent[]
): Delegation[] {
    const delegations: Delegation[] = [];

    // Split output into blocks starting with NEXT_AGENT
    const blocks = coordinatorOutput
        .split(/(?=NEXT_AGENT:)/i)
        .filter((b) => /NEXT_AGENT:/i.test(b));

    for (const block of blocks) {
        const agentMatch = block.match(/NEXT_AGENT:\s*(.+)/i);
        const taskMatch = block.match(/TASK:\s*([\s\S]*?)(?=(?:AFTER:|NEXT_AGENT:|SWARM_COMPLETE|$))/i);
        const afterMatch = block.match(/AFTER:\s*(.+)/i);

        if (!agentMatch || !taskMatch) continue;

        const rawAgentId = agentMatch[1].trim();
        const task = taskMatch[1].trim();
        if (!task) continue;

        const resolvedId = resolveAgentId(rawAgentId, workerSwarmAgents);
        if (!resolvedId) continue;

        let afterAgentId: string | undefined;
        if (afterMatch) {
            const rawAfterId = afterMatch[1].trim();
            // AFTER can also reference the coordinator or any agent by name
            afterAgentId = resolveAgentId(rawAfterId, workerSwarmAgents) ?? undefined;
        }

        delegations.push({ agentId: resolvedId, task, afterAgentId });
    }

    return delegations;
}

// ── Agent ID Resolution ──────────────────────────────────────

function resolveAgentId(raw: string, workerSwarmAgents: SwarmAgent[]): string | null {
    // Exact ID match
    const exact = workerSwarmAgents.find((sa) => sa.agentId === raw);
    if (exact) return exact.agentId;

    // Exact name match (case-insensitive)
    const byName = workerSwarmAgents.find((sa) => {
        const agent = getAgentById(sa.agentId);
        return agent?.name.toLowerCase() === raw.toLowerCase();
    });
    if (byName) return byName.agentId;

    // Partial / fuzzy match
    const partial = workerSwarmAgents.find((sa) => {
        const agent = getAgentById(sa.agentId);
        const lower = raw.toLowerCase();
        return (
            sa.agentId.toLowerCase().includes(lower) ||
            lower.includes(sa.agentId.toLowerCase()) ||
            agent?.name.toLowerCase().includes(lower) ||
            lower.includes(agent?.name.toLowerCase() ?? '')
        );
    });
    if (partial) return partial.agentId;

    // Fallback to first worker
    if (workerSwarmAgents.length > 0) {
        console.warn(`[Swarm] Could not resolve agent "${raw}", falling back to first worker.`);
        return workerSwarmAgents[0].agentId;
    }

    return null;
}

// ── CLI Runner Promise Wrapper ───────────────────────────────

function runAgentAsync(
    agent: Parameters<typeof runAgent>[0]['agent'],
    prompt: string,
    workspacePath: string,
    swarmId: string,
    broadcast: WsBroadcast
): Promise<string> {
    return new Promise((resolve, reject) => {
        let hasResolved = false;

        runAgent({
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
                console.error(`[Swarm] Agent "${agent.name}" error:`, error);
                broadcast({
                    type: 'swarm_error',
                    taskId: swarmId,
                    agentId: agent.id,
                    agentName: agent.name,
                    error,
                });
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
