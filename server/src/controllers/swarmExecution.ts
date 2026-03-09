import * as store from '../data/store.js';
import type { RunContext } from '../core/runtime/RunContext.js';
import type { SwarmExecutionContext } from '../core/runtime/ExecutionContexts.js';
import { executeSwarm } from '../engine/swarm-orchestrator.js';
import { runEngine } from '../core/runtime/RunEngine.js';
import {
    failEarlyIfLifecycleEnabled,
    createRunContextWithFallback,
    startRunIfLifecycleEnabled,
    executeWithLifecycle,
    type RunStartConfig,
} from './runStartHelper.js';

interface SwarmExecutionOptions {
    manageRunLifecycle?: boolean;
    runContext?: RunContext;
}

export async function startSwarmExecutionWithOptions(
    swarmId: string,
    executionContext: SwarmExecutionContext,
    options: SwarmExecutionOptions = {}
): Promise<{ status: number; body: unknown }> {
    const config: RunStartConfig = {
        manageRunLifecycle: options.manageRunLifecycle ?? true,
        runContext: options.runContext,
    };

    if (executionContext.runtimeState.isSwarmRunning(swarmId)) {
        return (
            failEarlyIfLifecycleEnabled(config, {
                status: 409,
                message: 'Swarm is already running',
            }) ?? { status: 409, body: { error: 'Swarm is already running' } }
        );
    }

    const swarm = store.getSwarmById(swarmId);
    if (!swarm || !swarm.workspacePath || swarm.agents.length === 0) {
        return (
            failEarlyIfLifecycleEnabled(config, {
                status: 400,
                message: 'Swarm is missing, has no workspace path, or contains no agents',
            }) ?? { status: 400, body: { error: 'Swarm is missing, has no workspace path, or contains no agents' } }
        );
    }

    store.updateSwarm(swarmId, { status: 'running', rounds: [], currentRound: 0 });
    executionContext.runtimeState.startSwarm(swarmId);

    const runContext = createRunContextWithFallback(config, {
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

    startRunIfLifecycleEnabled(config, runContext);

    void (async () => {
        await executeWithLifecycle(
            config,
            runContext,
            () =>
                executeSwarm(
                    { ...swarm, status: 'running', rounds: [], currentRound: 0 },
                    executionContext.broadcaster.broadcastLegacy,
                    (updates) => {
                        store.updateSwarm(swarmId, updates);
                    }
                ),
            {
                onSuccess: () => {
                    // Swarm updates are handled via callback during execution
                },
                onError: (message) => {
                    store.updateSwarm(swarmId, { status: 'error' });
                    executionContext.broadcaster.broadcastLegacy({
                        type: 'swarm_error',
                        taskId: swarmId,
                        error: message,
                    });
                },
            }
        );
        executionContext.runtimeState.finishSwarm(swarmId);
    })();

    return { status: 200, body: { status: 'started', swarmId } };
}

export async function startSwarmExecution(
    swarmId: string,
    executionContext: SwarmExecutionContext
): Promise<{ status: number; body: unknown }> {
    return startSwarmExecutionWithOptions(swarmId, executionContext);
}

export function stopSwarmExecution(
    swarmId: string,
    executionContext: SwarmExecutionContext
): { status: number; body: unknown } {
    store.updateSwarm(swarmId, { status: 'completed' });
    executionContext.runtimeState.finishSwarm(swarmId);
    runEngine.cancelRun(swarmId);
    executionContext.broadcaster.broadcastLegacy({
        type: 'swarm_complete',
        taskId: swarmId,
        data: 'Swarm manually stopped.',
    });
    return { status: 200, body: { status: 'stopped' } };
}
