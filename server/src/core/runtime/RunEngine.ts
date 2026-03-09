import type { Broadcaster } from '../events/Broadcaster.js';
import type { RunContext } from './RunContext.js';
import type { RunLifecycleStatus } from './RunTypes.js';
import type { RuntimeState } from './RuntimeState.js';

export interface ManagedRun {
    context: RunContext;
    status: RunLifecycleStatus;
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
            status: 'created',
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
        run.status = 'running';
        run.startedAt = run.startedAt ?? context.startedAt;
        this.emit('run.started', run);
        return run;
    }

    finishRun(runId: string): ManagedRun | null {
        const run = this.runs.get(runId);
        if (!run) {
            return null;
        }

        run.status = 'completed';
        run.finishedAt = new Date().toISOString();
        this.emit('run.finished', run);
        return run;
    }

    failRun(runId: string, error?: string): ManagedRun | null {
        const run = this.runs.get(runId);
        if (!run) {
            return null;
        }

        run.status = 'failed';
        run.error = error ?? null;
        run.finishedAt = new Date().toISOString();
        this.emit('run.failed', run);
        return run;
    }

    getRun(runId: string): ManagedRun | null {
        return this.runs.get(runId) ?? null;
    }

    cancelRun(runId: string): ManagedRun | null {
        const run = this.runs.get(runId);
        if (!run) {
            return null;
        }

        run.status = 'cancelled';
        run.finishedAt = new Date().toISOString();
        this.emit('run.cancelled', run);
        return run;
    }

    listActiveRuns(): ManagedRun[] {
        return [...this.runs.values()].filter((run) =>
            run.status === 'created' ||
            run.status === 'running'
        );
    }

    private emit(type: 'run.created' | 'run.started' | 'run.finished' | 'run.failed' | 'run.cancelled', run: ManagedRun): void {
        this.broadcaster?.broadcast({
            type,
            runId: run.context.runId,
            runType: run.context.runType,
            sourceId: run.context.sourceId,
            status: run.status,
            rootGoal: run.context.rootGoal,
            startedAt: run.context.startedAt,
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
