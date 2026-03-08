import * as store from '../data/store.js';
import { executeSwarm } from '../engine/swarm-orchestrator.js';
import type { SwarmExecutionContext } from '../core/runtime/ExecutionContexts.js';

export async function startSwarmExecution(swarmId: string, context: SwarmExecutionContext): Promise<{ status: number; body: unknown }> {
    if (context.runtimeState.isSwarmRunning(swarmId)) {
        return { status: 409, body: { error: 'Swarm is already running' } };
    }

    const swarm = store.getSwarmById(swarmId);
    if (!swarm || !swarm.workspacePath || swarm.agents.length === 0) {
        return { status: 400, body: { error: 'Swarm is missing, has no workspace path, or contains no agents' } };
    }

    store.updateSwarm(swarmId, { status: 'running', rounds: [], currentRound: 0 });
    context.runtimeState.startSwarm(swarmId);

    void (async () => {
        try {
            await executeSwarm(
                { ...swarm, status: 'running', rounds: [], currentRound: 0 },
                context.broadcaster.broadcastLegacy,
                (updates) => {
                    store.updateSwarm(swarmId, updates);
                }
            );
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            store.updateSwarm(swarmId, { status: 'error' });
            context.broadcaster.broadcastLegacy({ type: 'swarm_error', taskId: swarmId, error: message });
        } finally {
            context.runtimeState.finishSwarm(swarmId);
        }
    })();

    return { status: 200, body: { status: 'started', swarmId } };
}

export function stopSwarmExecution(swarmId: string, context: SwarmExecutionContext): { status: number; body: unknown } {
    store.updateSwarm(swarmId, { status: 'completed' });
    context.runtimeState.finishSwarm(swarmId);
    context.broadcaster.broadcastLegacy({ type: 'swarm_complete', taskId: swarmId, data: 'Swarm manually stopped.' });
    return { status: 200, body: { status: 'stopped' } };
}
