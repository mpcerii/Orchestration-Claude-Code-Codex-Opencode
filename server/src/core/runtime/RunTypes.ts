export type RunType = 'task' | 'swarm';

export type RunLifecycleStatus =
    | 'created'
    | 'running'
    | 'completed'
    | 'failed'
    | 'cancelled';

export type RunTrigger = 'manual' | 'schedule' | 'api';

export interface RunBasePayload {
    runId: string;
    runType: RunType;
    sourceId: string;
    status: RunLifecycleStatus;
    rootGoal: string;
    startedAt: string;
    finishedAt: string | null;
    trigger: RunTrigger;
    scheduleId: string | null;
    parentRunId: string | null;
    labels: string[];
    agentChain: string[];
    artifacts: string[];
    metadata: Record<string, unknown>;
    timestamp: string;
    activeRuns: number;
    runtimeStateBound: boolean;
    error: string | null;
}

export interface RunCreatedPayload extends RunBasePayload {
    type: 'run.created';
}

export interface RunStartedPayload extends RunBasePayload {
    type: 'run.started';
}

export interface RunFinishedPayload extends RunBasePayload {
    type: 'run.finished';
}

export interface RunFailedPayload extends RunBasePayload {
    type: 'run.failed';
    error: string;
}

export interface RunCancelledPayload extends RunBasePayload {
    type: 'run.cancelled';
}

export type RunLifecycleEvent =
    | RunCreatedPayload
    | RunStartedPayload
    | RunFinishedPayload
    | RunFailedPayload
    | RunCancelledPayload;
