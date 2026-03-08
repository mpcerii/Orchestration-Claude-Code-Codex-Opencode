import { Router } from 'express';
import { startTaskExecution } from '../../controllers/taskExecution.js';
import type { Broadcaster } from '../../core/events/Broadcaster.js';
import type { RuntimeState } from '../../core/runtime/RuntimeState.js';

interface TaskExecutionRouteDependencies {
    runtimeState: RuntimeState;
    broadcaster: Broadcaster;
}

export function createTaskExecutionRouter(deps: TaskExecutionRouteDependencies): Router {
    const router = Router();

    router.post('/tasks/:id/execute', async (req, res) => {
        const result = await startTaskExecution(req.params.id, deps);
        res.status(result.status).json(result.body);
    });

    return router;
}
