import * as store from '../data/store.js';
import type { RunContext } from '../core/runtime/RunContext.js';
import type { TaskSocketExecutionContext, TaskExecutionContext } from '../core/runtime/ExecutionContexts.js';
import type { RunEngine } from '../core/runtime/RunEngine.js';
import { runEngine as globalRunEngine } from '../core/runtime/RunEngine.js';
import { executeTask } from '../engine/orchestrator.js';
import {
    ExecutionLifecycleHelper,
    mergeRunEngine,
    type ExecutionConfig,
    type ValidationError,
} from '../core/execution/ExecutionLifecycleHelper.js';

interface TaskExecutionOptions {
    manageRunLifecycle?: boolean;
    runContext?: RunContext;
}

type TaskExecutionDependencies = TaskExecutionContext & { runEngine?: RunEngine };

function validateTaskExecution(
    taskId: string,
    deps: TaskExecutionDependencies,
    config: ExecutionConfig
): { error: ValidationError } | null {
    if (deps.runtimeState.isTaskRunning(taskId)) {
        return { error: { status: 409, message: 'Task is already running' } };
    }

    const task = store.getTaskById(taskId);
    if (!task) {
        return { error: { status: 404, message: 'Task not found' } };
    }

    if (!task.assignedTreeId) {
        return { error: { status: 400, message: 'No agent tree assigned to this task' } };
    }

    const tree = store.getTreeById(task.assignedTreeId);
    if (!tree || !tree.workspacePath) {
        return { error: { status: 400, message: 'Assigned tree is missing or has no workspace path' } };
    }

    return null;
}

export async function startTaskExecutionWithOptions(
    taskId: string,
    deps: TaskExecutionDependencies,
    options: TaskExecutionOptions = {}
): Promise<{ status: number; body: unknown }> {
    const config: ExecutionConfig = {
        manageRunLifecycle: options.manageRunLifecycle ?? true,
        runContext: options.runContext,
    };

    const lifecycleHelper = new ExecutionLifecycleHelper(mergeRunEngine(deps, globalRunEngine));

    const validation = validateTaskExecution(taskId, deps, config);
    if (validation) {
        const result = lifecycleHelper.failEarlyIfLifecycleEnabled(config, validation.error);
        return result ?? { status: validation.error.status, body: { error: validation.error.message } };
    }

    const task = store.getTaskById(taskId)!;
    const tree = store.getTreeById(task.assignedTreeId!)!;

    store.updateTask(taskId, { status: 'in_progress' });
    deps.runtimeState.startTask(taskId);

    const runContext = lifecycleHelper.createRunContextWithFallback(config, {
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

    lifecycleHelper.startRunIfLifecycleEnabled(config, runContext);

    void (async () => {
        await lifecycleHelper.executeWithLifecycle(
            config,
            runContext,
            () => executeTask(task, tree, deps.broadcaster.broadcastLegacy),
            {
                onSuccess: (outputs) => {
                    store.updateTask(taskId, { status: 'done', outputs });
                },
                onError: (message) => {
                    store.updateTask(taskId, { status: 'review' });
                    deps.broadcaster.broadcastLegacy({
                        type: 'agent_error',
                        taskId,
                        error: message,
                    });
                },
            }
        );
        deps.runtimeState.finishTask(taskId);
    })();

    return { status: 200, body: { status: 'started', taskId } };
}

export async function startTaskExecution(
    taskId: string,
    deps: TaskExecutionDependencies
): Promise<{ status: number; body: unknown }> {
    return startTaskExecutionWithOptions(taskId, deps);
}

export async function executeTaskFromSocket(
    payload: { type?: string; taskId?: string },
    socketContext: TaskSocketExecutionContext & { runEngine?: RunEngine }
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
