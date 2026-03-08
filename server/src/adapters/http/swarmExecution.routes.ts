import { Router } from 'express';
import { startSwarmExecution, stopSwarmExecution } from '../../controllers/swarmExecution.js';
import type { Broadcaster } from '../../core/events/Broadcaster.js';
import type { RuntimeState } from '../../core/runtime/RuntimeState.js';

interface SwarmExecutionRouteDependencies {
    runtimeState: RuntimeState;
    broadcaster: Broadcaster;
}

export function createSwarmExecutionRouter(deps: SwarmExecutionRouteDependencies): Router {
    const router = Router();

    router.post('/swarms/:id/execute', async (req, res) => {
        const result = await startSwarmExecution(req.params.id, deps);
        res.status(result.status).json(result.body);
    });

    router.post('/swarms/:id/stop', (req, res) => {
        const result = stopSwarmExecution(req.params.id, deps);
        res.status(result.status).json(result.body);
    });

    return router;
}
