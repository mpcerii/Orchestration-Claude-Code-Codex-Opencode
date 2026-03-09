import { randomUUID } from 'node:crypto';
import type { RunType, RunLifecycleStatus, RunTrigger } from './RunTypes.js';

export interface RunContext {
    runId: string;
    runType: RunType;
    sourceId: string;
    startedAt: string;
    finishedAt: string | null;
    status: RunLifecycleStatus;
    rootGoal: string;
    trigger: RunTrigger;
    scheduleId: string | null;
    parentRunId: string | null;
    labels: string[];
    agentChain: string[];
    artifacts: string[];
    metadata: Record<string, unknown>;
    error: string | null;
}

export interface RunContextInput {
    runId?: string;
    runType: RunType;
    sourceId: string;
    rootGoal: string;
    trigger?: RunTrigger;
    scheduleId?: string;
    parentRunId?: string;
    labels?: string[];
    metadata?: Record<string, unknown>;
}

export function createRunContext(input: RunContextInput): RunContext {
    return {
        runId: input.runId ?? randomUUID(),
        runType: input.runType,
        sourceId: input.sourceId,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        status: 'created',
        rootGoal: input.rootGoal,
        trigger: input.trigger ?? 'manual',
        scheduleId: input.scheduleId ?? null,
        parentRunId: input.parentRunId ?? null,
        labels: input.labels ?? [],
        agentChain: [],
        artifacts: [],
        metadata: input.metadata ?? {},
        error: null,
    };
}
