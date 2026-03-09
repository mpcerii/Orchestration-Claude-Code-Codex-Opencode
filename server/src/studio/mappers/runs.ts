import type { PersistedRun } from '../../db/repositories/RunRepository.js';
import type { StudioRunDto } from '../dtos.js';

export function mapStudioRun(run: PersistedRun): StudioRunDto {
  return {
    id: run.id,
    sessionId: run.sourceId,
    goal: run.rootGoal,
    agentName: null,
    state: run.status,
    model: typeof run.metadata.model === 'string' ? run.metadata.model : 'runtime',
    startedAt: run.startedAt ?? run.createdAt,
    finishedAt: run.finishedAt,
  };
}
