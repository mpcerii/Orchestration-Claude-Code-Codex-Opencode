/**
 * Studio API DTOs - Explizite Typen für Mapping-Funktionen
 * Verhindert fragile ReturnType-Ableitungen
 */

import type { PersistedRun } from '../db/repositories/RunRepository.js';
import type { PersistedRunEvent } from '../db/repositories/RunEventRepository.js';
import type { PersistedSchedule } from '../db/repositories/ScheduleRepository.js';
import type { PersistedMemoryEntry } from '../db/repositories/MemoryRepository.js';
import type { PersistedScheduleRun } from '../db/repositories/ScheduleRunRepository.js';

// Input-Typen für Mapping-Funktionen (nicht-null Werte aus Repositories)
export type StudioRunInput = PersistedRun;
export type StudioEventInput = PersistedRunEvent;
export type StudioScheduleInput = PersistedSchedule;
export type StudioMemoryInput = PersistedMemoryEntry;
export type StudioScheduleRunInput = PersistedScheduleRun;

// Output-Typen (bereits in types.ts definiert, hier für Vollständigkeit)
export interface StudioRunDto {
  id: string;
  sessionId: string;
  goal: string;
  agentName: string | null;
  state: string;
  model: string;
  startedAt: string;
  finishedAt: string | null;
}

export interface StudioEventDto {
  id: string;
  runId: string;
  sessionId: string;
  type: string;
  agentName: string | null;
  payload: string;
  createdAt: string;
}

export interface StudioScheduleDto {
  id: string;
  name: string;
  cron: string;
  timezone: string;
  jobType: string;
  status: 'active' | 'paused';
  lastRunAt: string | null;
  nextRunAt: string | null;
}

export interface StudioMemoryDto {
  id: string;
  scope: string;
  kind: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface StudioScheduleHistoryDto {
  id: string;
  scheduleId: string;
  runId: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
}
