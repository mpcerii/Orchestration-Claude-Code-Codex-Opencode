import type { PersistedRunEvent } from '../../db/repositories/RunEventRepository.js';
import type { StudioEventDto } from '../dtos.js';

export function mapStudioEvent(event: PersistedRunEvent): StudioEventDto {
  return {
    id: event.id,
    runId: event.runId,
    sessionId: event.runId,
    type: event.eventType,
    agentName: null,
    payload: JSON.stringify(event.payload),
    createdAt: event.createdAt,
  };
}
