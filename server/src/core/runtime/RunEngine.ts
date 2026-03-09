import type { Broadcaster } from '../events/Broadcaster.js';
import type { RunContext } from './RunContext.js';
import type { RuntimeState } from './RuntimeState.js';

export enum RunStatus {
    RUN_CREATED = 'RUN_CREATED',
    RUN_STARTED = 'RUN_STARTED',
    RUN_RUNNING = 'RUN_RUNNING',
    RUN_FAILED = 'RUN_FAILED',
    RUN_COMPLETED = 'RUN_COMPLETED',
    RUN_CANCELLED = 'RUN_CANCELLED',
}

export interface ManagedRun {
    context: RunContext;
    status: RunStatus;
    startedAt: string | null;
    finishedAt: string | null;
    error: string | null;
}

interface RunEngineDependencies {
    runtimeState?: RuntimeState;
    broadcaster?: Broadcaster;
}

export class RunEngine {
    private readonly runs = new Map<string, ManagedRun>();
    private runtimeState?: RuntimeState;
    private broadcaster?: Broadcaster;

    configure(deps: RunEngineDependencies): void {
        this.runtimeState = deps.runtimeState ?? this.runtimeState;
        this.broadcaster = deps.broadcaster ?? this.broadcaster;
    }

    registerRun(context: RunContext): ManagedRun {
        const existing = this.runs.get(context.runId);
        if (existing) {
            return existing;
        }

        const run: ManagedRun = {
            context,
            status: RunStatus.RUN_CREATED,
            startedAt: null,
            finishedAt: null,
            error: null,
        };

        this.runs.set(context.runId, run);
        this.emit('run.created', run);
        return run;
    }

    startRun(context: RunContext): ManagedRun {
        const run = this.registerRun(context);
        run.status = RunStatus.RUN_STARTED;
        run.startedAt = run.startedAt ?? new Date().toISOString();
        this.emit('run.started', run);
        run.status = RunStatus.RUN_RUNNING;
        return run;
    }

    finishRun(runId: string): ManagedRun | null {
        const run = this.runs.get(runId);
        if (!run) {
            return null;
        }

        run.status = RunStatus.RUN_COMPLETED;
        run.finishedAt = new Date().toISOString();
        this.emit('run.finished', run);
        return run;
    }

    failRun(runId: string, error?: string): ManagedRun | null {
        const run = this.runs.get(runId);
        if (!run) {
            return null;
        }

        run.status = RunStatus.RUN_FAILED;
        run.error = error ?? null;
        run.finishedAt = new Date().toISOString();
        this.emit('run.failed', run);
        return run;
    }

    getRun(runId: string): ManagedRun | null {
        return this.runs.get(runId) ?? null;
    }

    listActiveRuns(): ManagedRun[] {
        return [...this.runs.values()].filter((run) =>
            run.status === RunStatus.RUN_CREATED ||
            run.status === RunStatus.RUN_STARTED ||
            run.status === RunStatus.RUN_RUNNING
        );
    }

    private emit(type: 'run.created' | 'run.started' | 'run.finished' | 'run.failed', run: ManagedRun): void {
        this.broadcaster?.broadcast({
            type,
            runId: run.context.runId,
            status: run.status,
            rootGoal: run.context.rootGoal,
            startTime: run.context.startTime,
            agentChain: run.context.agentChain,
            artifacts: run.context.artifacts,
            metadata: run.context.metadata,
            error: run.error,
            timestamp: new Date().toISOString(),
            activeRuns: this.listActiveRuns().length,
            runtimeStateBound: Boolean(this.runtimeState),
        });
    }
}

export const runEngine = new RunEngine();
