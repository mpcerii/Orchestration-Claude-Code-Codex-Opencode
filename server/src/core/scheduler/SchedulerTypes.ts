import type { RunType } from '../runtime/RunTypes.js';

export interface ScheduleRunTemplate {
    jobType: string;
    goal: string;
    sourceType?: RunType;
    sourceId?: string;
}
