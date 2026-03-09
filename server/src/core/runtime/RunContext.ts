import { randomUUID } from 'node:crypto';

export interface RunContext {
    runId: string;
    rootGoal: string;
    startTime: string;
    agentChain: string[];
    artifacts: string[];
    metadata: Record<string, unknown>;
}

export function createRunContext(input: {
    runId?: string;
    rootGoal: string;
    metadata?: Record<string, unknown>;
}): RunContext {
    return {
        runId: input.runId ?? randomUUID(),
        rootGoal: input.rootGoal,
        startTime: new Date().toISOString(),
        agentChain: [],
        artifacts: [],
        metadata: input.metadata ?? {},
    };
}
