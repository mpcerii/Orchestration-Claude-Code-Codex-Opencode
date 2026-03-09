import type { PersistedMemoryEntry } from '../../db/repositories/MemoryRepository.js';
import type { StudioMemoryDto } from '../dtos.js';

export function mapStudioMemory(entry: PersistedMemoryEntry): StudioMemoryDto {
  return {
    id: entry.id,
    scope: `${entry.scopeType}:${entry.scopeId}`,
    kind: entry.memoryType,
    title: entry.title,
    content: entry.content,
    createdAt: entry.createdAt,
  };
}
