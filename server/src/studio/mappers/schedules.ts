import type { PersistedSchedule } from '../../db/repositories/ScheduleRepository.js';
import type { PersistedScheduleRun } from '../../db/repositories/ScheduleRunRepository.js';
import type { StudioScheduleDto, StudioScheduleHistoryDto } from '../dtos.js';

export function mapStudioSchedule(schedule: PersistedSchedule): StudioScheduleDto {
  return {
    id: schedule.id,
    name: schedule.name,
    cron: schedule.cronExpr,
    timezone: schedule.timezone,
    jobType: typeof schedule.runTemplate.jobType === 'string' ? schedule.runTemplate.jobType : 'runtime',
    status: schedule.enabled ? 'active' : 'paused',
    lastRunAt: schedule.lastRunAt,
    nextRunAt: schedule.nextRunAt,
  };
}

export function mapStudioScheduleRun(entry: PersistedScheduleRun): StudioScheduleHistoryDto {
  return {
    id: entry.id,
    scheduleId: entry.scheduleId,
    runId: entry.runId,
    status: entry.status,
    startedAt: entry.startedAt,
    finishedAt: entry.finishedAt,
    error: entry.error,
  };
}
