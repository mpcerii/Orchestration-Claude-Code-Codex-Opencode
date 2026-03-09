import type { RunContext, RunContextInput } from '../core/runtime/RunContext.js';
import { createRunContext } from '../core/runtime/RunContext.js';
import { runEngine } from '../core/runtime/RunEngine.js';

export interface ValidationError {
    status: number;
    message: string;
}

export interface RunStartConfig {
    manageRunLifecycle: boolean;
    runContext?: RunContext;
}

export function failEarlyIfLifecycleEnabled(
    config: RunStartConfig,
    error: ValidationError
): { status: number; body: unknown } | null {
    if (config.manageRunLifecycle && config.runContext) {
        runEngine.registerRun(config.runContext);
        runEngine.failRun(config.runContext.runId, error.message);
    }
    return { status: error.status, body: { error: error.message } };
}

export function createRunContextWithFallback(
    config: RunStartConfig,
    input: RunContextInput
): RunContext {
    return config.runContext ?? createRunContext(input);
}

export function startRunIfLifecycleEnabled(
    config: RunStartConfig,
    runContext: RunContext
): void {
    if (config.manageRunLifecycle) {
        runEngine.startRun(runContext);
    }
}

export interface ExecutionResult<T> {
    success: boolean;
    data?: T;
    error?: string;
}

export async function executeWithLifecycle<T>(
    config: RunStartConfig,
    runContext: RunContext,
    executeFn: () => Promise<T>,
    callbacks: {
        onSuccess: (data: T) => void;
        onError: (error: string) => void;
    }
): Promise<void> {
    try {
        const result = await executeFn();
        callbacks.onSuccess(result);
        if (config.manageRunLifecycle) {
            runEngine.finishRun(runContext.runId);
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        callbacks.onError(message);
        if (config.manageRunLifecycle) {
            runEngine.failRun(runContext.runId, message);
        }
    }
}
