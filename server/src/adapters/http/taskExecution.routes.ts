import { Router } from 'express';
import { startTaskExecution } from '../../controllers/taskExecution.js';
import type { Broadcaster } from '../../core/events/Broadcaster.js';
import type { RuntimeState } from '../../core/runtime/RuntimeState.js';
import type { RunEngine } from '../../core/runtime/RunEngine.js';
import { runEngine as globalRunEngine } from '../../core/runtime/RunEngine.js';

export interface TaskExecutionRouteDependencies {
    runtimeState: RuntimeState;
    broadcaster: Broadcaster;
    runEngine?: RunEngine;
}

export function createTaskExecutionRouter(deps: TaskExecutionRouteDependencies): Router {
    const router = Router();
    const runEngine = deps.runEngine ?? globalRunEngine;

    router.post('/tasks/:id/execute', async (req, res) => {
        const result = await startTaskExecution(req.params.id, { 
            runtimeState: deps.runtimeState, 
            broadcaster: deps.broadcaster,
            runEngine 
        });
        res.status(result.status).json(result.body);
    });

    return router;
}
