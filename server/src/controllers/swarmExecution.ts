import * as store from '../data/store.js';
import type { RunContext } from '../core/runtime/RunContext.js';
import { createRunContext } from '../core/runtime/RunContext.js';
import { runEngine } from '../core/runtime/RunEngine.js';
import { executeSwarm } from '../engine/swarm-orchestrator.js';
import type { SwarmExecutionContext } from '../core/runtime/ExecutionContexts.js';

interface SwarmExecutionOptions {
    manageRunLifecycle?: boolean;
    runContext?: RunContext;
}

export async function startSwarmExecutionWithOptions(
    swarmId: string,
    context: SwarmExecutionContext,
    options: SwarmExecutionOptions = {}
): Promise<{ status: number; body: unknown }> {
    const manageRunLifecycle = options.manageRunLifecycle ?? true;

    if (context.runtimeState.isSwarmRunning(swarmId)) {
        if (manageRunLifecycle && options.runContext) {
            runEngine.registerRun(options.runContext);
            runEngine.failRun(options.runContext.runId, 'Swarm is already running');
        }
        return { status: 409, body: { error: 'Swarm is already running' } };
    }

    const swarm = store.getSwarmById(swarmId);
    if (!swarm || !swarm.workspacePath || swarm.agents.length === 0) {
        if (manageRunLifecycle && options.runContext) {
            runEngine.registerRun(options.runContext);
            runEngine.failRun(options.runContext.runId, 'Swarm is missing, has no workspace path, or contains no agents');
        }
        return { status: 400, body: { error: 'Swarm is missing, has no workspace path, or contains no agents' } };
    }

    store.updateSwarm(swarmId, { status: 'running', rounds: [], currentRound: 0 });
    context.runtimeState.startSwarm(swarmId);
    const runContext = options.runContext ?? createRunContext({
        runId: swarmId,
        runType: 'swarm',
        sourceId: swarm.id,
        rootGoal: swarm.description?.trim() || swarm.name,
        metadata: {
            kind: 'swarm',
            swarmId: swarm.id,
            workspacePath: swarm.workspacePath,
            minRounds: swarm.minRounds,
            maxRounds: swarm.maxRounds,
        },
    });
    if (manageRunLifecycle) {
        runEngine.startRun(runContext);
    }

    void (async () => {
        try {
            await executeSwarm(
                { ...swarm, status: 'running', rounds: [], currentRound: 0 },
                context.broadcaster.broadcastLegacy,
                (updates) => {
                    store.updateSwarm(swarmId, updates);
                }
            );
            if (manageRunLifecycle) {
                runEngine.finishRun(runContext.runId);
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            store.updateSwarm(swarmId, { status: 'error' });
            context.broadcaster.broadcastLegacy({ type: 'swarm_error', taskId: swarmId, error: message });
            if (manageRunLifecycle) {
                runEngine.failRun(runContext.runId, message);
            }
        } finally {
            context.runtimeState.finishSwarm(swarmId);
        }
    })();

    return { status: 200, body: { status: 'started', swarmId } };
}

export async function startSwarmExecution(swarmId: string, context: SwarmExecutionContext): Promise<{ status: number; body: unknown }> {
    return startSwarmExecutionWithOptions(swarmId, context);
}

export function stopSwarmExecution(swarmId: string, context: SwarmExecutionContext): { status: number; body: unknown } {
    store.updateSwarm(swarmId, { status: 'completed' });
    context.runtimeState.finishSwarm(swarmId);
    runEngine.cancelRun(swarmId);
    context.broadcaster.broadcastLegacy({ type: 'swarm_complete', taskId: swarmId, data: 'Swarm manually stopped.' });
    return { status: 200, body: { status: 'stopped' } };
}
