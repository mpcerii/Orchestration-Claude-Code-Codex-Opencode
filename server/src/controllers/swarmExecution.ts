import * as store from '../data/store.js';
import type { RunContext } from '../core/runtime/RunContext.js';
import type { SwarmExecutionContext } from '../core/runtime/ExecutionContexts.js';
import type { RunEngine } from '../core/runtime/RunEngine.js';
import { runEngine as globalRunEngine } from '../core/runtime/RunEngine.js';
import { executeSwarm } from '../engine/swarm-orchestrator.js';
import {
    ExecutionLifecycleHelper,
    mergeRunEngine,
    type ExecutionConfig,
    type ValidationError,
} from '../core/execution/ExecutionLifecycleHelper.js';

interface SwarmExecutionOptions {
    manageRunLifecycle?: boolean;
    runContext?: RunContext;
}

type SwarmExecutionDependencies = SwarmExecutionContext & { runEngine?: RunEngine };

function validateSwarmExecution(
    swarmId: string,
    deps: SwarmExecutionDependencies,
    config: ExecutionConfig
): { error: ValidationError } | null {
    if (deps.runtimeState.isSwarmRunning(swarmId)) {
        return { error: { status: 409, message: 'Swarm is already running' } };
    }

    const swarm = store.getSwarmById(swarmId);
    if (!swarm || !swarm.workspacePath || swarm.agents.length === 0) {
        return { error: { status: 400, message: 'Swarm is missing, has no workspace path, or contains no agents' } };
    }

    return null;
}

export async function startSwarmExecutionWithOptions(
    swarmId: string,
    deps: SwarmExecutionDependencies,
    options: SwarmExecutionOptions = {}
): Promise<{ status: number; body: unknown }> {
    const config: ExecutionConfig = {
        manageRunLifecycle: options.manageRunLifecycle ?? true,
        runContext: options.runContext,
    };

    const lifecycleHelper = new ExecutionLifecycleHelper(mergeRunEngine(deps, globalRunEngine));

    const validation = validateSwarmExecution(swarmId, deps, config);
    if (validation) {
        const result = lifecycleHelper.failEarlyIfLifecycleEnabled(config, validation.error);
        return result ?? { status: validation.error.status, body: { error: validation.error.message } };
    }

    const swarm = store.getSwarmById(swarmId)!;

    store.updateSwarm(swarmId, { status: 'running', rounds: [], currentRound: 0 });
    deps.runtimeState.startSwarm(swarmId);

    const runContext = lifecycleHelper.createRunContextWithFallback(config, {
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

    lifecycleHelper.startRunIfLifecycleEnabled(config, runContext);

    void (async () => {
        await lifecycleHelper.executeWithLifecycle(
            config,
            runContext,
            () =>
                executeSwarm(
                    { ...swarm, status: 'running', rounds: [], currentRound: 0 },
                    deps.broadcaster.broadcastLegacy,
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
                    deps.broadcaster.broadcastLegacy({
                        type: 'swarm_error',
                        taskId: swarmId,
                        error: message,
                    });
                },
            }
        );
        deps.runtimeState.finishSwarm(swarmId);
    })();

    return { status: 200, body: { status: 'started', swarmId } };
}

export async function startSwarmExecution(
    swarmId: string,
    deps: SwarmExecutionDependencies
): Promise<{ status: number; body: unknown }> {
    return startSwarmExecutionWithOptions(swarmId, deps);
}

export function stopSwarmExecution(
    swarmId: string,
    deps: SwarmExecutionDependencies
): { status: number; body: unknown } {
    store.updateSwarm(swarmId, { status: 'completed' });
    deps.runtimeState.finishSwarm(swarmId);
    mergeRunEngine(deps, globalRunEngine).runEngine.cancelRun(swarmId);
    deps.broadcaster.broadcastLegacy({
        type: 'swarm_complete',
        taskId: swarmId,
        data: 'Swarm manually stopped.',
    });
    return { status: 200, body: { status: 'stopped' } };
}
