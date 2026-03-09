import * as store from '../data/store.js';
import type { RunContext } from '../core/runtime/RunContext.js';
import type { TaskSocketExecutionContext, TaskExecutionContext } from '../core/runtime/ExecutionContexts.js';
import { executeTask } from '../engine/orchestrator.js';
import {
    failEarlyIfLifecycleEnabled,
    createRunContextWithFallback,
    startRunIfLifecycleEnabled,
    executeWithLifecycle,
    type RunStartConfig,
} from './runStartHelper.js';

interface TaskExecutionOptions {
    manageRunLifecycle?: boolean;
    runContext?: RunContext;
}

export async function startTaskExecutionWithOptions(
    taskId: string,
    executionContext: TaskExecutionContext,
    options: TaskExecutionOptions = {}
): Promise<{ status: number; body: unknown }> {
    const config: RunStartConfig = {
        manageRunLifecycle: options.manageRunLifecycle ?? true,
        runContext: options.runContext,
    };

    if (executionContext.runtimeState.isTaskRunning(taskId)) {
        return (
            failEarlyIfLifecycleEnabled(config, {
                status: 409,
                message: 'Task is already running',
            }) ?? { status: 409, body: { error: 'Task is already running' } }
        );
    }

    const task = store.getTaskById(taskId);
    if (!task) {
        return (
            failEarlyIfLifecycleEnabled(config, {
                status: 404,
                message: 'Task not found',
            }) ?? { status: 404, body: { error: 'Task not found' } }
        );
    }

    if (!task.assignedTreeId) {
        return (
            failEarlyIfLifecycleEnabled(config, {
                status: 400,
                message: 'No agent tree assigned to this task',
            }) ?? { status: 400, body: { error: 'No agent tree assigned to this task' } }
        );
    }

    const tree = store.getTreeById(task.assignedTreeId);
    if (!tree || !tree.workspacePath) {
        return (
            failEarlyIfLifecycleEnabled(config, {
                status: 400,
                message: 'Assigned tree is missing or has no workspace path',
            }) ?? { status: 400, body: { error: 'Assigned tree is missing or has no workspace path' } }
        );
    }

    store.updateTask(taskId, { status: 'in_progress' });
    executionContext.runtimeState.startTask(taskId);

    const runContext = createRunContextWithFallback(config, {
        runId: taskId,
        runType: 'task',
        sourceId: task.id,
        rootGoal: task.prompt?.trim() || task.description?.trim() || task.title,
        metadata: {
            kind: 'task',
            taskId: task.id,
            treeId: tree.id,
            workspacePath: tree.workspacePath,
        },
    });

    startRunIfLifecycleEnabled(config, runContext);

    void (async () => {
        await executeWithLifecycle(
            config,
            runContext,
            () => executeTask(task, tree, executionContext.broadcaster.broadcastLegacy),
            {
                onSuccess: (outputs) => {
                    store.updateTask(taskId, { status: 'done', outputs });
                },
                onError: (message) => {
                    store.updateTask(taskId, { status: 'review' });
                    executionContext.broadcaster.broadcastLegacy({
                        type: 'agent_error',
                        taskId,
                        error: message,
                    });
                },
            }
        );
        executionContext.runtimeState.finishTask(taskId);
    })();

    return { status: 200, body: { status: 'started', taskId } };
}

export async function startTaskExecution(
    taskId: string,
    executionContext: TaskExecutionContext
): Promise<{ status: number; body: unknown }> {
    return startTaskExecutionWithOptions(taskId, executionContext);
}

export async function executeTaskFromSocket(
    payload: { type?: string; taskId?: string },
    socketContext: TaskSocketExecutionContext
): Promise<void> {
    if (payload.type !== 'execute_task' || !payload.taskId) {
        return;
    }

    const result = await startTaskExecution(payload.taskId, socketContext);
    if (result.status >= 400) {
        socketContext.ws.send(
            JSON.stringify({
                type: 'agent_error',
                taskId: payload.taskId,
                error: (result.body as { error: string }).error,
            })
        );
    }
}
