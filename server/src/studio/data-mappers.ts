/**
 * Data Mappers - Abbildung von Studio-DB-Rows auf DTOs
 * 
 * Diese Datei enthält Mapping-Funktionen für die studio-interne SQLite-Datenbank.
 * Sie verwendet die expliziten DTOs aus dtos.ts für konsistente Response-Strukturen.
 */

import type { StudioRunDto, StudioEventDto, StudioScheduleDto, StudioMemoryDto } from '../dtos.js';
import type { AgentRun, ToolCall, AgentMessage, StudioEvent, Artifact, Schedule, MemoryEntry } from '../types.js';

// Studio-DB Row-Typen (snake_case für SQLite-Kompatibilität)
export interface StudioDbRunRow {
  id: string;
  session_id: string;
  goal: string;
  agent_name: string | null;
  state: string;
  model: string;
  started_at: string;
  finished_at: string | null;
}

export interface StudioDbEventRow {
  id: string;
  run_id: string;
  session_id: string;
  type: string;
  agent_name: string | null;
  payload: string;
  created_at: string;
}

export interface StudioDbToolCallRow {
  id: string;
  run_id: string;
  agent_name: string;
  tool_name: string;
  input: string;
  output: string;
  status: string;
  started_at: string;
  finished_at: string | null;
}

export interface StudioDbMessageRow {
  id: string;
  session_id: string;
  run_id: string;
  from_agent: string;
  to_agent: string;
  role: string;
  content: string;
  created_at: string;
}

export interface StudioDbArtifactRow {
  id: string;
  run_id: string;
  name: string;
  path: string;
  kind: string;
  created_at: string;
}

export interface StudioDbScheduleRow {
  id: string;
  name: string;
  cron: string;
  timezone: string;
  job_type: string;
  status: string;
  last_run_at: string | null;
  next_run_at: string | null;
}

export interface StudioDbMemoryRow {
  id: string;
  scope: string;
  kind: string;
  title: string;
  content: string;
  created_at: string;
}

// Mapping-Funktionen für Studio-DB zu DTOs
export function mapDbRunToDto(row: StudioDbRunRow): StudioRunDto {
  return {
    id: row.id,
    sessionId: row.session_id,
    goal: row.goal,
    agentName: row.agent_name,
    state: row.state,
    model: row.model,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

export function mapDbEventToDto(row: StudioDbEventRow): StudioEventDto {
  return {
    id: row.id,
    runId: row.run_id,
    sessionId: row.session_id,
    type: row.type,
    agentName: row.agent_name,
    payload: row.payload,
    createdAt: row.created_at,
  };
}

export function mapDbScheduleToDto(row: StudioDbScheduleRow): StudioScheduleDto {
  return {
    id: row.id,
    name: row.name,
    cron: row.cron,
    timezone: row.timezone,
    jobType: row.job_type,
    status: row.status as 'active' | 'paused',
    lastRunAt: row.last_run_at,
    nextRunAt: row.next_run_at,
  };
}

export function mapDbMemoryToDto(row: StudioDbMemoryRow): StudioMemoryDto {
  return {
    id: row.id,
    scope: row.scope,
    kind: row.kind,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
  };
}

// Mapping-Funktionen für interne Typen (für operations.ts)
export function mapDbRunToAgentRun(row: StudioDbRunRow): AgentRun {
  return {
    id: row.id,
    sessionId: row.session_id,
    goal: row.goal,
    agentName: row.agent_name,
    state: row.state as AgentRun['state'],
    model: row.model,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

export function mapDbEventToStudioEvent(row: StudioDbEventRow): StudioEvent {
  return {
    id: row.id,
    runId: row.run_id,
    sessionId: row.session_id,
    type: row.type,
    agentName: row.agent_name,
    payload: row.payload,
    createdAt: row.created_at,
  };
}

export function mapDbToolCallToToolCall(row: StudioDbToolCallRow): ToolCall {
  return {
    id: row.id,
    runId: row.run_id,
    agentName: row.agent_name,
    toolName: row.tool_name,
    input: row.input,
    output: row.output,
    status: row.status as ToolCall['status'],
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

export function mapDbMessageToAgentMessage(row: StudioDbMessageRow): AgentMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    runId: row.run_id,
    fromAgent: row.from_agent,
    toAgent: row.to_agent,
    role: row.role as AgentMessage['role'],
    content: row.content,
    createdAt: row.created_at,
  };
}

export function mapDbArtifactToArtifact(row: StudioDbArtifactRow): Artifact {
  return {
    id: row.id,
    runId: row.run_id,
    name: row.name,
    path: row.path,
    kind: row.kind,
    createdAt: row.created_at,
  };
}

export function mapDbScheduleToSchedule(row: StudioDbScheduleRow): Schedule {
  return {
    id: row.id,
    name: row.name,
    cron: row.cron,
    timezone: row.timezone,
    jobType: row.job_type,
    status: row.status as Schedule['status'],
    lastRunAt: row.last_run_at,
    nextRunAt: row.next_run_at,
  };
}

export function mapDbMemoryToMemoryEntry(row: StudioDbMemoryRow): MemoryEntry {
  return {
    id: row.id,
    scope: row.scope,
    kind: row.kind as MemoryEntry['kind'],
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
  };
}
