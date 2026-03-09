export type RunType = 'task' | 'swarm';

export type RunLifecycleStatus =
    | 'created'
    | 'running'
    | 'completed'
    | 'failed'
    | 'cancelled';

export interface RunBasePayload {
    runId: string;
    runType: RunType;
    sourceId: string;
    rootGoal: string;
    startedAt: string;
    agentChain: string[];
    artifacts: string[];
    metadata: Record<string, unknown>;
    timestamp: string;
    activeRuns: number;
    runtimeStateBound: boolean;
}

export interface RunCreatedPayload extends RunBasePayload {
    type: 'run.created';
    status: 'created';
    error: null;
}

export interface RunStartedPayload extends RunBasePayload {
    type: 'run.started';
    status: 'running';
    error: null;
}

export interface RunFinishedPayload extends RunBasePayload {
    type: 'run.finished';
    status: 'completed';
    error: null;
}

export interface RunFailedPayload extends RunBasePayload {
    type: 'run.failed';
    status: 'failed';
    error: string;
}

export interface RunCancelledPayload extends RunBasePayload {
    type: 'run.cancelled';
    status: 'cancelled';
    error: null;
}

export type RunLifecycleEvent =
    | RunCreatedPayload
    | RunStartedPayload
    | RunFinishedPayload
    | RunFailedPayload
    | RunCancelledPayload;
