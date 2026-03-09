import { getStudioDb } from './db.js';
import type { SqlParams } from './types.js';
import type {
  StudioDbRunRow,
  StudioDbEventRow,
  StudioDbToolCallRow,
  StudioDbMessageRow,
  StudioDbArtifactRow,
  StudioDbScheduleRow,
  StudioDbMemoryRow,
} from './data-mappers.js';

const db = getStudioDb();

function asRows<T>(sql: string, params: SqlParams = {}): T[] {
  return db.prepare(sql).all(params) as T[];
}

function asRow<T>(sql: string, params: SqlParams = {}): T | undefined {
  return db.prepare(sql).get(params) as T | undefined;
}

export const studioRunQueries = {
  list(): StudioDbRunRow[] {
    return asRows<StudioDbRunRow>('SELECT * FROM runs ORDER BY started_at DESC LIMIT 8');
  },

  getById(runId: string): StudioDbRunRow | undefined {
    return asRow<StudioDbRunRow>('SELECT * FROM runs WHERE id = :runId', { runId });
  },
  
  create(sessionId: string, goal: string): void {
    const startedAt = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO runs (id, session_id, goal, agent_name, state, model, started_at, finished_at)
      VALUES (:id, :sessionId, :goal, :agentName, :state, :model, :startedAt, NULL)
    `).run({
      id: sessionId,
      sessionId,
      goal,
      agentName: 'Orchestrator',
      state: 'queued',
      model: 'gpt-4.1',
      startedAt,
    });
  },
  
  updateState(runId: string, state: string, finishedAt?: string | null): void {
    db.prepare(`
      UPDATE runs
      SET state = :state, finished_at = :finishedAt
      WHERE id = :runId
    `).run({
      runId,
      state,
      finishedAt: finishedAt ?? null,
    });
  },

  getActiveCount(): number {
    return asRow<{ count: number }>("SELECT COUNT(*) as count FROM runs WHERE state = 'running'")?.count ?? 0;
  },

  getTotalCount(): number {
    return asRow<{ count: number }>('SELECT COUNT(*) as count FROM runs')?.count ?? 0;
  },
};

export const studioEventQueries = {
  listByRunId(runId: string): StudioDbEventRow[] {
    return asRows<StudioDbEventRow>('SELECT * FROM events WHERE run_id = :runId ORDER BY created_at DESC', { runId });
  },

  listRecent(limit: number = 40): StudioDbEventRow[] {
    return asRows<StudioDbEventRow>('SELECT * FROM events ORDER BY created_at DESC LIMIT :limit', { limit });
  },

  create(input: Omit<StudioDbEventRow, 'id' | 'created_at'>): string {
    const eventId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO events (id, run_id, session_id, type, agent_name, payload, created_at)
      VALUES (:id, :runId, :sessionId, :type, :agentName, :payload, :createdAt)
    `).run({
      id: eventId,
      ...input,
      createdAt,
    });
    
    return eventId;
  },

  getEventCount(): number {
    return asRow<{ count: number }>('SELECT COUNT(*) as count FROM events')?.count ?? 0;
  },
};

export const studioToolCallQueries = {
  listByRunId(runId: string): StudioDbToolCallRow[] {
    return asRows<StudioDbToolCallRow>('SELECT * FROM tool_calls WHERE run_id = :runId ORDER BY started_at DESC', { runId });
  },

  listRecent(limit: number = 20): StudioDbToolCallRow[] {
    return asRows<StudioDbToolCallRow>('SELECT * FROM tool_calls ORDER BY started_at DESC LIMIT :limit', { limit });
  },

  create(input: Omit<StudioDbToolCallRow, 'id'>): string {
    const toolCallId = crypto.randomUUID();
    
    db.prepare(`
      INSERT INTO tool_calls (id, run_id, agent_name, tool_name, input, output, status, started_at, finished_at)
      VALUES (:id, :runId, :agentName, :toolName, :input, :output, :status, :startedAt, :finishedAt)
    `).run({
      id: toolCallId,
      ...input,
    });
    
    return toolCallId;
  },
};

export const studioMessageQueries = {
  listByRunId(runId: string): StudioDbMessageRow[] {
    return asRows<StudioDbMessageRow>('SELECT * FROM agent_messages WHERE run_id = :runId ORDER BY created_at DESC', { runId });
  },

  listRecent(limit: number = 20): StudioDbMessageRow[] {
    return asRows<StudioDbMessageRow>('SELECT * FROM agent_messages ORDER BY created_at DESC LIMIT :limit', { limit });
  },

  create(input: Omit<StudioDbMessageRow, 'id' | 'created_at'>): string {
    const messageId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO agent_messages (id, session_id, run_id, from_agent, to_agent, role, content, created_at)
      VALUES (:id, :sessionId, :runId, :fromAgent, :toAgent, :role, :content, :createdAt)
    `).run({
      id: messageId,
      ...input,
      createdAt,
    });
    
    return messageId;
  },
};

export const studioArtifactQueries = {
  listByRunId(runId: string): StudioDbArtifactRow[] {
    return asRows<StudioDbArtifactRow>('SELECT * FROM artifacts WHERE run_id = :runId ORDER BY created_at DESC', { runId });
  },

  listRecent(limit: number = 12): StudioDbArtifactRow[] {
    return asRows<StudioDbArtifactRow>('SELECT * FROM artifacts ORDER BY created_at DESC LIMIT :limit', { limit });
  },

  create(input: Omit<StudioDbArtifactRow, 'id' | 'created_at'>): string {
    const artifactId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO artifacts (id, run_id, name, path, kind, created_at)
      VALUES (:id, :runId, :name, :path, :kind, :createdAt)
    `).run({
      id: artifactId,
      ...input,
      createdAt,
    });
    
    return artifactId;
  },

  getArtifactCount(): number {
    return asRow<{ count: number }>('SELECT COUNT(*) as count FROM artifacts')?.count ?? 0;
  },
};

export const studioScheduleQueries = {
  list(): StudioDbScheduleRow[] {
    return asRows<StudioDbScheduleRow>('SELECT * FROM schedules ORDER BY name');
  },

  getById(scheduleId: string): StudioDbScheduleRow | undefined {
    return asRow<StudioDbScheduleRow>('SELECT * FROM schedules WHERE id = :scheduleId', { scheduleId });
  },

  create(input: Omit<StudioDbScheduleRow, 'id'>): string {
    const scheduleId = crypto.randomUUID();
    
    db.prepare(`
      INSERT INTO schedules (id, name, cron, timezone, job_type, status, last_run_at, next_run_at)
      VALUES (:id, :name, :cron, :timezone, :jobType, :status, :lastRunAt, :nextRunAt)
    `).run({
      id: scheduleId,
      ...input,
    });
    
    return scheduleId;
  },

  update(scheduleId: string, updates: Partial<Omit<StudioDbScheduleRow, 'id'>>): void {
    const updateFields: string[] = [];
    const params: SqlParams = { scheduleId };
    
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        updateFields.push(`${key} = :${key}`);
        params[key] = value;
      }
    }
    
    if (updateFields.length === 0) return;
    
    db.prepare(`UPDATE schedules SET ${updateFields.join(', ')} WHERE id = :scheduleId`).run(params);
  },

  getScheduleCount(): number {
    return asRow<{ count: number }>('SELECT COUNT(*) as count FROM schedules')?.count ?? 0;
  },
};

export const studioMemoryQueries = {
  listRecent(limit: number = 12): StudioDbMemoryRow[] {
    return asRows<StudioDbMemoryRow>('SELECT * FROM memory_entries ORDER BY created_at DESC LIMIT :limit', { limit });
  },

  search(query: string): StudioDbMemoryRow[] {
    const normalized = `%${query.toLowerCase()}%`;
    return asRows<StudioDbMemoryRow>(
      `
        SELECT * FROM memory_entries
        WHERE lower(title) LIKE :normalized OR lower(content) LIKE :normalized
        ORDER BY created_at DESC
        LIMIT 20
      `,
      { normalized }
    );
  },

  create(input: Omit<StudioDbMemoryRow, 'id' | 'created_at'>): string {
    const memoryId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO memory_entries (id, scope, kind, title, content, created_at)
      VALUES (:id, :scope, :kind, :title, :content, :createdAt)
    `).run({
      id: memoryId,
      ...input,
      createdAt,
    });
    
    return memoryId;
  },

  getMemoryCount(): number {
    return asRow<{ count: number }>('SELECT COUNT(*) as count FROM memory_entries')?.count ?? 0;
  },
};
