import type { RunType, RunTrigger } from '../runtime/RunTypes.js';

export interface ScheduleRunTemplate {
    jobType: string;
    goal: string;
    sourceType?: RunType;
    sourceId?: string;
    trigger?: RunTrigger;
    scheduleId?: string;
    parentRunId?: string | null;
    labels?: string[];
    metadata?: Record<string, unknown>;
}
