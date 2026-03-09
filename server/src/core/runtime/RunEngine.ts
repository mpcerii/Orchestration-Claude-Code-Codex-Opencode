import type { Broadcaster } from '../events/Broadcaster.js';
import type { RunEventRepository } from '../../db/repositories/RunEventRepository.js';
import type { RunRepository } from '../../db/repositories/RunRepository.js';
import type { RunContext } from './RunContext.js';
import type { RunLifecycleStatus, RunLifecycleEvent, RunBasePayload } from './RunTypes.js';
import type { RuntimeState } from './RuntimeState.js';

export interface ManagedRun {
    context: RunContext;
    status: RunLifecycleStatus;
}

interface RunEngineDependencies {
    runtimeState?: RuntimeState;
    broadcaster?: Broadcaster;
    runRepository?: RunRepository;
    runEventRepository?: RunEventRepository;
}

export class RunEngine {
    private readonly runs = new Map<string, ManagedRun>();
    private readonly lifecycleListeners = new Set<(event: RunLifecycleEvent) => void>();
    private runtimeState?: RuntimeState;
    private broadcaster?: Broadcaster;
    private runRepository?: RunRepository;
    private runEventRepository?: RunEventRepository;

    configure(deps: RunEngineDependencies): void {
        this.runtimeState = deps.runtimeState ?? this.runtimeState;
        this.broadcaster = deps.broadcaster ?? this.broadcaster;
        this.runRepository = deps.runRepository ?? this.runRepository;
        this.runEventRepository = deps.runEventRepository ?? this.runEventRepository;
    }

    registerRun(context: RunContext): ManagedRun {
        const existing = this.runs.get(context.runId);
        if (existing) {
            return existing;
        }

        const run: ManagedRun = {
            context,
            status: context.status,
        };

        this.runs.set(context.runId, run);
        this.runRepository?.create(context, run.status);
        this.emit('run.created', run);
        return run;
    }

    startRun(context: RunContext): ManagedRun {
        const run = this.registerRun(context);
        run.status = 'running';
        run.context.status = 'running';
        this.runRepository?.updateStatus(run.context.runId, {
            status: run.status,
            startedAt: run.context.startedAt,
            finishedAt: run.context.finishedAt,
            error: run.context.error,
        });
        this.emit('run.started', run);
        return run;
    }

    finishRun(runId: string): ManagedRun | null {
        const run = this.runs.get(runId);
        if (!run) {
            return null;
        }

        run.status = 'completed';
        run.context.status = 'completed';
        run.context.finishedAt = new Date().toISOString();
        this.runRepository?.updateStatus(run.context.runId, {
            status: run.status,
            startedAt: run.context.startedAt,
            finishedAt: run.context.finishedAt,
            error: run.context.error,
        });
        this.emit('run.finished', run);
        return run;
    }

    failRun(runId: string, error?: string): ManagedRun | null {
        const run = this.runs.get(runId);
        if (!run) {
            return null;
        }

        run.status = 'failed';
        run.context.status = 'failed';
        run.context.error = error ?? null;
        run.context.finishedAt = new Date().toISOString();
        this.runRepository?.updateStatus(run.context.runId, {
            status: run.status,
            startedAt: run.context.startedAt,
            finishedAt: run.context.finishedAt,
            error: run.context.error,
        });
        this.emit('run.failed', run, error);
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
        run.context.status = 'cancelled';
        run.context.finishedAt = new Date().toISOString();
        this.runRepository?.updateStatus(run.context.runId, {
            status: run.status,
            startedAt: run.context.startedAt,
            finishedAt: run.context.finishedAt,
            error: run.context.error,
        });
        this.emit('run.cancelled', run);
        return run;
    }

    listActiveRuns(): ManagedRun[] {
        return [...this.runs.values()].filter((run) =>
            run.status === 'created' ||
            run.status === 'running'
        );
    }

    onLifecycleEvent(listener: (event: RunLifecycleEvent) => void): () => void {
        this.lifecycleListeners.add(listener);
        return () => {
            this.lifecycleListeners.delete(listener);
        };
    }

    private createBasePayload(run: ManagedRun): RunBasePayload {
        return {
            runId: run.context.runId,
            runType: run.context.runType,
            sourceId: run.context.sourceId,
            rootGoal: run.context.rootGoal,
            startedAt: run.context.startedAt,
            agentChain: run.context.agentChain,
            artifacts: run.context.artifacts,
            metadata: run.context.metadata,
            timestamp: new Date().toISOString(),
            activeRuns: this.listActiveRuns().length,
            runtimeStateBound: Boolean(this.runtimeState),
        };
    }

    private emit(
        type: 'run.created',
        run: ManagedRun
    ): void;
    private emit(
        type: 'run.started',
        run: ManagedRun
    ): void;
    private emit(
        type: 'run.finished',
        run: ManagedRun
    ): void;
    private emit(
        type: 'run.failed',
        run: ManagedRun,
        error?: string
    ): void;
    private emit(
        type: 'run.cancelled',
        run: ManagedRun
    ): void;
    private emit(
        type: 'run.created' | 'run.started' | 'run.finished' | 'run.failed' | 'run.cancelled',
        run: ManagedRun,
        error?: string
    ): void {
        const base = this.createBasePayload(run);

        let payload: RunLifecycleEvent;
        switch (type) {
            case 'run.created':
                payload = { ...base, type, status: 'created', error: null };
                break;
            case 'run.started':
                payload = { ...base, type, status: 'running', error: null };
                break;
            case 'run.finished':
                payload = { ...base, type, status: 'completed', error: null };
                break;
            case 'run.failed':
                payload = { ...base, type, status: 'failed', error: error ?? 'Unknown error' };
                break;
            case 'run.cancelled':
                payload = { ...base, type, status: 'cancelled', error: null };
                break;
        }

        this.runEventRepository?.create(run.context.runId, type, payload);
        this.broadcaster?.broadcast(payload);
        for (const listener of this.lifecycleListeners) {
            listener(payload);
        }
    }
}

export const runEngine = new RunEngine();
