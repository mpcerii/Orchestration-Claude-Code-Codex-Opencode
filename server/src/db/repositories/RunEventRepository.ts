import { randomUUID } from 'node:crypto';
import { getSqliteDb } from '../sqlite/client.js';

interface RunEventRow {
    id: string;
    run_id: string;
    event_type: string;
    payload_json: string;
    created_at: string;
}

export interface PersistedRunEvent {
    id: string;
    runId: string;
    eventType: string;
    payload: Record<string, unknown>;
    createdAt: string;
}

export class RunEventRepository {
    create(runId: string, eventType: string, payload: Record<string, unknown>): PersistedRunEvent {
        const db = getSqliteDb();
        const createdAt = new Date().toISOString();
        const id = randomUUID();

        db.prepare(`
            INSERT INTO run_events (id, run_id, event_type, payload_json, created_at)
            VALUES (:id, :runId, :eventType, :payloadJson, :createdAt)
        `).run({
            id,
            runId,
            eventType,
            payloadJson: JSON.stringify(payload),
            createdAt,
        });

        return { id, runId, eventType, payload, createdAt };
    }

    listByRunId(runId: string): PersistedRunEvent[] {
        const db = getSqliteDb();
        return (db.prepare('SELECT * FROM run_events WHERE run_id = :runId ORDER BY created_at ASC').all({ runId }) as unknown as RunEventRow[])
            .map(mapRunEvent);
    }
}

function mapRunEvent(row: RunEventRow): PersistedRunEvent {
    return {
        id: row.id,
        runId: row.run_id,
        eventType: row.event_type,
        payload: JSON.parse(row.payload_json) as Record<string, unknown>,
        createdAt: row.created_at,
    };
}
