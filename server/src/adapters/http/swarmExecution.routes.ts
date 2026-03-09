import { Router } from 'express';
import { startSwarmExecution, stopSwarmExecution } from '../../controllers/swarmExecution.js';
import type { Broadcaster } from '../../core/events/Broadcaster.js';
import type { RuntimeState } from '../../core/runtime/RuntimeState.js';
import type { RunEngine } from '../../core/runtime/RunEngine.js';
import { runEngine as globalRunEngine } from '../../core/runtime/RunEngine.js';

export interface SwarmExecutionRouteDependencies {
    runtimeState: RuntimeState;
    broadcaster: Broadcaster;
    runEngine?: RunEngine;
}

export function createSwarmExecutionRouter(deps: SwarmExecutionRouteDependencies): Router {
    const router = Router();
    const runEngine = deps.runEngine ?? globalRunEngine;

    router.post('/swarms/:id/execute', async (req, res) => {
        const result = await startSwarmExecution(req.params.id, { 
            runtimeState: deps.runtimeState, 
            broadcaster: deps.broadcaster,
            runEngine 
        });
        res.status(result.status).json(result.body);
    });

    router.post('/swarms/:id/stop', (req, res) => {
        const result = stopSwarmExecution(req.params.id, { 
            runtimeState: deps.runtimeState, 
            broadcaster: deps.broadcaster,
            runEngine 
        });
        res.status(result.status).json(result.body);
    });

    return router;
}
