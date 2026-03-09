import type { RunContext, RunContextInput } from '../runtime/RunContext.js';
import { createRunContext } from '../runtime/RunContext.js';
import type { RunEngine } from '../runtime/RunEngine.js';
import type { Broadcaster } from '../events/Broadcaster.js';
import type { RuntimeState } from '../runtime/RuntimeState.js';

export interface ValidationError {
    status: number;
    message: string;
}

export interface ExecutionConfig {
    manageRunLifecycle: boolean;
    runContext?: RunContext;
}

export interface ExecutionDependencies {
    runEngine: RunEngine;
    runtimeState: RuntimeState;
    broadcaster: Broadcaster;
}

export interface ExecutionResult<T = unknown> {
    status: number;
    body: T;
}

export function mergeRunEngine<T extends { runEngine?: RunEngine }>(deps: T, fallback: RunEngine): T & { runEngine: RunEngine } {
    return { ...deps, runEngine: deps.runEngine ?? fallback } as T & { runEngine: RunEngine };
}

export class ExecutionLifecycleHelper {
    constructor(private deps: ExecutionDependencies) {}

    failEarlyIfLifecycleEnabled(
        config: ExecutionConfig,
        error: ValidationError
    ): ExecutionResult<{ error: string }> | null {
        if (config.manageRunLifecycle && config.runContext) {
            this.deps.runEngine.registerRun(config.runContext);
            this.deps.runEngine.failRun(config.runContext.runId, error.message);
        }
        return { status: error.status, body: { error: error.message } };
    }

    createRunContextWithFallback(
        config: ExecutionConfig,
        input: RunContextInput
    ): RunContext {
        return config.runContext ?? createRunContext(input);
    }

    startRunIfLifecycleEnabled(config: ExecutionConfig, runContext: RunContext): void {
        if (config.manageRunLifecycle) {
            this.deps.runEngine.startRun(runContext);
        }
    }

    finishRunIfLifecycleEnabled(config: ExecutionConfig, runId: string): void {
        if (config.manageRunLifecycle) {
            this.deps.runEngine.finishRun(runId);
        }
    }

    failRunIfLifecycleEnabled(config: ExecutionConfig, runId: string, error: string): void {
        if (config.manageRunLifecycle) {
            this.deps.runEngine.failRun(runId, error);
        }
    }

    async executeWithLifecycle<T>(
        config: ExecutionConfig,
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
            this.finishRunIfLifecycleEnabled(config, runContext.runId);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            callbacks.onError(message);
            this.failRunIfLifecycleEnabled(config, runContext.runId, message);
        }
    }
}

export function createExecutionLifecycleHelper(deps: ExecutionDependencies): ExecutionLifecycleHelper {
    return new ExecutionLifecycleHelper(deps);
}
