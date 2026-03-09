/**
 * Studio API DTOs - Explizite Typen für alle Response-Objekte
 * 
 * Diese DTOs definieren die exakte Struktur der API-Responses.
 * Alle Mapping-Funktionen müssen diese Typen einhalten.
 */

import type { PersistedRun } from '../db/repositories/RunRepository.js';
import type { PersistedRunEvent } from '../db/repositories/RunEventRepository.js';
import type { PersistedSchedule } from '../db/repositories/ScheduleRepository.js';
import type { PersistedMemoryEntry } from '../db/repositories/MemoryRepository.js';
import type { PersistedScheduleRun } from '../db/repositories/ScheduleRunRepository.js';

// Input-Typen: Exakte Repository-Ausgaben für Mapping-Funktionen
export type StudioRunInput = PersistedRun;
export type StudioEventInput = PersistedRunEvent;
export type StudioScheduleInput = PersistedSchedule;
export type StudioMemoryInput = PersistedMemoryEntry;
export type StudioScheduleRunInput = PersistedScheduleRun;

// Output-DTOs: Exakte Response-Strukturen für die Studio-API
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

// Aggregierte DTOs für Detail-Views
export interface StudioRunDetailDto {
  run: StudioRunDto;
  toolCalls: unknown[];
  messages: unknown[];
  events: StudioEventDto[];
  artifacts: unknown[];
}

// ======================
// INPUT DTOs (Request Bodies)
// ======================

export interface CreateRunRequest {
  goal: string;
}

export interface CreateScheduleRequest {
  name: string;
  cron: string;
  timezone?: string;
  goal?: string;
  jobType?: string;
  sourceType?: 'task' | 'swarm';
  sourceId?: string;
  status?: 'active' | 'paused';
  enabled?: boolean;
}

export interface UpdateScheduleRequest {
  name?: string;
  cron?: string;
  timezone?: string;
  jobType?: string;
  goal?: string;
  sourceType?: 'task' | 'swarm';
  sourceId?: string;
  status?: 'active' | 'paused';
}

export interface CreateMemoryRequest {
  title: string;
  content: string;
  scope?: string;
  scopeType?: string;
}

export interface SearchQueryRequest {
  q: string;
}

// Error Response
export interface StudioErrorDto {
  error: string;
}
