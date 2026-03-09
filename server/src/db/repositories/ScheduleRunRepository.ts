import { randomUUID } from 'node:crypto';
import { getSqliteDb } from '../sqlite/client.js';

interface ScheduleRunRow {
    id: string;
    schedule_id: string;
    run_id: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    error: string | null;
}

export interface PersistedScheduleRun {
    id: string;
    scheduleId: string;
    runId: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    error: string | null;
}

export class ScheduleRunRepository {
    create(input: {
        scheduleId: string;
        runId: string;
        status: string;
        startedAt: string;
    }): PersistedScheduleRun {
        const db = getSqliteDb();
        const id = randomUUID();

        db.prepare(`
            INSERT INTO schedule_runs (id, schedule_id, run_id, status, started_at, finished_at, error)
            VALUES (:id, :scheduleId, :runId, :status, :startedAt, NULL, NULL)
        `).run({
            id,
            scheduleId: input.scheduleId,
            runId: input.runId,
            status: input.status,
            startedAt: input.startedAt,
        });

        return this.getById(id)!;
    }

    getById(id: string): PersistedScheduleRun | null {
        const db = getSqliteDb();
        const row = db.prepare('SELECT * FROM schedule_runs WHERE id = :id').get({ id }) as ScheduleRunRow | undefined;
        return row ? mapScheduleRun(row) : null;
    }

    getByRunId(runId: string): PersistedScheduleRun | null {
        const db = getSqliteDb();
        const row = db.prepare('SELECT * FROM schedule_runs WHERE run_id = :runId').get({ runId }) as ScheduleRunRow | undefined;
        return row ? mapScheduleRun(row) : null;
    }

    updateByRunId(runId: string, input: {
        status: string;
        finishedAt?: string | null;
        error?: string | null;
    }): PersistedScheduleRun | null {
        const db = getSqliteDb();
        db.prepare(`
            UPDATE schedule_runs
            SET status = :status,
                finished_at = :finishedAt,
                error = :error
            WHERE run_id = :runId
        `).run({
            runId,
            status: input.status,
            finishedAt: input.finishedAt ?? null,
            error: input.error ?? null,
        });

        return this.getByRunId(runId);
    }

    list(): PersistedScheduleRun[] {
        const db = getSqliteDb();
        return (db.prepare('SELECT * FROM schedule_runs ORDER BY started_at DESC').all() as unknown as ScheduleRunRow[]).map(mapScheduleRun);
    }

    listByScheduleId(scheduleId: string): PersistedScheduleRun[] {
        const db = getSqliteDb();
        return (db.prepare(`
            SELECT * FROM schedule_runs
            WHERE schedule_id = :scheduleId
            ORDER BY started_at DESC
        `).all({ scheduleId }) as unknown as ScheduleRunRow[]).map(mapScheduleRun);
    }

    deleteById(id: string): boolean {
        const db = getSqliteDb();
        const result = db.prepare('DELETE FROM schedule_runs WHERE id = :id').run({ id });
        return result.changes > 0;
    }

    deleteByRunId(runId: string): boolean {
        const db = getSqliteDb();
        const result = db.prepare('DELETE FROM schedule_runs WHERE run_id = :runId').run({ runId });
        return result.changes > 0;
    }

    deleteByScheduleId(scheduleId: string): number {
        const db = getSqliteDb();
        const result = db.prepare('DELETE FROM schedule_runs WHERE schedule_id = :scheduleId').run({ scheduleId });
        return result.changes;
    }
}

function mapScheduleRun(row: ScheduleRunRow): PersistedScheduleRun {
    return {
        id: row.id,
        scheduleId: row.schedule_id,
        runId: row.run_id,
        status: row.status,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        error: row.error,
    };
}
