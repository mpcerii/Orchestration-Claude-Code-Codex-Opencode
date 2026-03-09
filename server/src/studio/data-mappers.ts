import type { AgentRun, ToolCall, AgentMessage, StudioEvent, Artifact, Schedule, MemoryEntry } from '../types.js';
import type { StudioRunDto, StudioEventDto, StudioScheduleDto, StudioMemoryDto, StudioScheduleHistoryDto } from '../dtos.js';
import { mapStudioRun } from '../mappers/runs.js';
import { mapStudioEvent } from '../mappers/events.js';
import { mapStudioSchedule } from '../mappers/schedules.js';
import { mapStudioMemory } from '../mappers/memory.js';

export interface StudioDataRunRow {
  id: string;
  session_id: string;
  goal: string;
  agent_name: string | null;
  state: string;
  model: string;
  started_at: string;
  finished_at: string | null;
}

export interface StudioDataEventRow {
  id: string;
  run_id: string;
  session_id: string;
  type: string;
  agent_name: string | null;
  payload: string;
  created_at: string;
}

export interface StudioDataToolCallRow {
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

export interface StudioDataMessageRow {
  id: string;
  session_id: string;
  run_id: string;
  from_agent: string;
  to_agent: string;
  role: string;
  content: string;
  created_at: string;
}

export interface StudioDataArtifactRow {
  id: string;
  run_id: string;
  name: string;
  path: string;
  kind: string;
  created_at: string;
}

export interface StudioDataScheduleRow {
  id: string;
  name: string;
  cron: string;
  timezone: string;
  job_type: string;
  status: string;
  last_run_at: string | null;
  next_run_at: string | null;
}

export interface StudioDataMemoryRow {
  id: string;
  scope: string;
  kind: string;
  title: string;
  content: string;
  created_at: string;
}

export function mapDataRunToDto(row: StudioDataRunRow): StudioRunDto {
  return mapStudioRun({
    id: row.id,
    sourceId: row.session_id,
    rootGoal: row.goal,
    status: row.state,
    metadata: { model: row.model },
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.started_at,
    error: null,
  });
}

export function mapDataRunToAgentRun(row: StudioDataRunRow): AgentRun {
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

export function mapDataEventToDto(row: StudioDataEventRow): StudioEventDto {
  return mapStudioEvent({
    id: row.id,
    runId: row.run_id,
    createdAt: row.created_at,
    eventType: row.type,
    payload: { type: row.type, payload: JSON.parse(row.payload) },
  });
}

export function mapDataEventToStudioEvent(row: StudioDataEventRow): StudioEvent {
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

export function mapDataScheduleToDto(row: StudioDataScheduleRow): StudioScheduleDto {
  return mapStudioSchedule({
    id: row.id,
    name: row.name,
    cronExpr: row.cron,
    timezone: row.timezone,
    enabled: row.status === 'active',
    runTemplate: { jobType: row.job_type },
    lastRunAt: row.last_run_at,
    nextRunAt: row.next_run_at,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export function mapDataScheduleToSchedule(row: StudioDataScheduleRow): Schedule {
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

export function mapDataMemoryToDto(row: StudioDataMemoryRow): StudioMemoryDto {
  return mapStudioMemory({
    id: row.id,
    scopeType: row.scope.split(':')[0],
    scopeId: row.scope.split(':')[1] || 'default',
    memoryType: row.kind,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.created_at,
  });
}

export function mapDataMemoryToMemoryEntry(row: StudioDataMemoryRow): MemoryEntry {
  return {
    id: row.id,
    scope: row.scope,
    kind: row.kind as MemoryEntry['kind'],
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
  };
}

export function mapDataScheduleHistoryToDto(row: StudioDataEventRow): StudioScheduleHistoryDto {
  // This would normally come from schedule_runs table, but mapped from events for this demo
  return {
    id: row.id,
    scheduleId: row.run_id.replace('schedule:', ''),
    runId: row.run_id,
    status: row.type.startsWith('scheduler.') ? 'success' : 'unknown',
    startedAt: row.created_at,
    finishedAt: null,
    error: null,
  };
}
