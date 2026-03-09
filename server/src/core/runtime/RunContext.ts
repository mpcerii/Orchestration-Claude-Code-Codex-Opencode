import { randomUUID } from 'node:crypto';
import type { RunType, RunLifecycleStatus } from './RunTypes.js';

export interface RunContext {
    runId: string;
    runType: RunType;
    sourceId: string;
    startedAt: string;
    finishedAt: string | null;
    status: RunLifecycleStatus;
    rootGoal: string;
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
        agentChain: [],
        artifacts: [],
        metadata: input.metadata ?? {},
        error: null,
    };
}
