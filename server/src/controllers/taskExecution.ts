import * as store from '../data/store.js';
import type { RunContext } from '../core/runtime/RunContext.js';
import { createRunContext } from '../core/runtime/RunContext.js';
import { runEngine } from '../core/runtime/RunEngine.js';
import { executeTask } from '../engine/orchestrator.js';
import type { TaskSocketExecutionContext, TaskExecutionContext } from '../core/runtime/ExecutionContexts.js';

interface TaskExecutionOptions {
    manageRunLifecycle?: boolean;
    runContext?: RunContext;
}

export async function startTaskExecutionWithOptions(
    taskId: string,
    context: TaskExecutionContext,
    options: TaskExecutionOptions = {}
): Promise<{ status: number; body: unknown }> {
    const manageRunLifecycle = options.manageRunLifecycle ?? true;

    if (context.runtimeState.isTaskRunning(taskId)) {
        if (manageRunLifecycle && options.runContext) {
            runEngine.registerRun(options.runContext);
            runEngine.failRun(options.runContext.runId, 'Task is already running');
        }
        return { status: 409, body: { error: 'Task is already running' } };
    }

    const task = store.getTaskById(taskId);
    if (!task) {
        if (manageRunLifecycle && options.runContext) {
            runEngine.registerRun(options.runContext);
            runEngine.failRun(options.runContext.runId, 'Task not found');
        }
        return { status: 404, body: { error: 'Task not found' } };
    }

    if (!task.assignedTreeId) {
        if (manageRunLifecycle && options.runContext) {
            runEngine.registerRun(options.runContext);
            runEngine.failRun(options.runContext.runId, 'No agent tree assigned to this task');
        }
        return { status: 400, body: { error: 'No agent tree assigned to this task' } };
    }

    const tree = store.getTreeById(task.assignedTreeId);
    if (!tree || !tree.workspacePath) {
        if (manageRunLifecycle && options.runContext) {
            runEngine.registerRun(options.runContext);
            runEngine.failRun(options.runContext.runId, 'Assigned tree is missing or has no workspace path');
        }
        return { status: 400, body: { error: 'Assigned tree is missing or has no workspace path' } };
    }

    store.updateTask(taskId, { status: 'in_progress' });
    context.runtimeState.startTask(taskId);
    const runContext = options.runContext ?? createRunContext({
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
    if (manageRunLifecycle) {
        runEngine.startRun(runContext);
    }

    void (async () => {
        try {
            const outputs = await executeTask(task, tree, context.broadcaster.broadcastLegacy);
            store.updateTask(taskId, { status: 'done', outputs });
            if (manageRunLifecycle) {
                runEngine.finishRun(runContext.runId);
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            store.updateTask(taskId, { status: 'review' });
            context.broadcaster.broadcastLegacy({ type: 'agent_error', taskId, error: message });
            if (manageRunLifecycle) {
                runEngine.failRun(runContext.runId, message);
            }
        } finally {
            context.runtimeState.finishTask(taskId);
        }
    })();

    return { status: 200, body: { status: 'started', taskId } };
}

export async function startTaskExecution(taskId: string, context: TaskExecutionContext): Promise<{ status: number; body: unknown }> {
    return startTaskExecutionWithOptions(taskId, context);
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
