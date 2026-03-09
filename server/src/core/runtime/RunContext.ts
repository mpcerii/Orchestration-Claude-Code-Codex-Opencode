import { randomUUID } from 'node:crypto';
import type { RunType } from './RunTypes.js';

export interface RunContext {
    runId: string;
    runType: RunType;
    sourceId: string;
    startedAt: string;
    rootGoal: string;
    agentChain: string[];
    artifacts: string[];
    metadata: Record<string, unknown>;
}

export function createRunContext(input: {
    runId?: string;
    runType: RunType;
    sourceId: string;
    rootGoal: string;
    metadata?: Record<string, unknown>;
}): RunContext {
    return {
        runId: input.runId ?? randomUUID(),
        runType: input.runType,
        sourceId: input.sourceId,
        startedAt: new Date().toISOString(),
        rootGoal: input.rootGoal,
        agentChain: [],
        artifacts: [],
        metadata: input.metadata ?? {},
    };
}
