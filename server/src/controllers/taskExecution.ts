import * as store from '../data/store.js';
import { executeTask } from '../engine/orchestrator.js';
import type { TaskSocketExecutionContext, TaskExecutionContext } from '../core/runtime/ExecutionContexts.js';

export async function startTaskExecution(taskId: string, context: TaskExecutionContext): Promise<{ status: number; body: unknown }> {
    if (context.runtimeState.isTaskRunning(taskId)) {
        return { status: 409, body: { error: 'Task is already running' } };
    }

    const task = store.getTaskById(taskId);
    if (!task) {
        return { status: 404, body: { error: 'Task not found' } };
    }

    if (!task.assignedTreeId) {
        return { status: 400, body: { error: 'No agent tree assigned to this task' } };
    }

    const tree = store.getTreeById(task.assignedTreeId);
    if (!tree || !tree.workspacePath) {
        return { status: 400, body: { error: 'Assigned tree is missing or has no workspace path' } };
    }

    store.updateTask(taskId, { status: 'in_progress' });
    context.runtimeState.startTask(taskId);

    void (async () => {
        try {
            const outputs = await executeTask(task, tree, context.broadcaster.broadcastLegacy);
            store.updateTask(taskId, { status: 'done', outputs });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            store.updateTask(taskId, { status: 'review' });
            context.broadcaster.broadcastLegacy({ type: 'agent_error', taskId, error: message });
        } finally {
            context.runtimeState.finishTask(taskId);
        }
    })();

    return { status: 200, body: { status: 'started', taskId } };
}

export async function executeTaskFromSocket(
    payload: { type?: string; taskId?: string },
    context: TaskSocketExecutionContext
): Promise<void> {
    if (payload.type !== 'execute_task' || !payload.taskId) {
        return;
    }

    const result = await startTaskExecution(payload.taskId, context);
    if (result.status >= 400) {
        context.ws.send(JSON.stringify({
            type: 'agent_error',
            taskId: payload.taskId,
            error: (result.body as { error: string }).error,
        }));
    }
}
