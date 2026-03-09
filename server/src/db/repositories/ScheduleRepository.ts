import { randomUUID } from 'node:crypto';
import { getSqliteDb } from '../sqlite/client.js';

interface ScheduleRow {
    id: string;
    name: string;
    cron_expr: string;
    timezone: string;
    enabled: number;
    run_template_json: string;
    last_run_at: string | null;
    next_run_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface PersistedSchedule {
    id: string;
    name: string;
    cronExpr: string;
    timezone: string;
    enabled: boolean;
    runTemplate: Record<string, unknown>;
    lastRunAt: string | null;
    nextRunAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export class ScheduleRepository {
    list(): PersistedSchedule[] {
        const db = getSqliteDb();
        return (db.prepare('SELECT * FROM schedules ORDER BY created_at DESC').all() as unknown as ScheduleRow[]).map(mapSchedule);
    }

    listEnabled(): PersistedSchedule[] {
        const db = getSqliteDb();
        return (db.prepare('SELECT * FROM schedules WHERE enabled = 1 ORDER BY created_at DESC').all() as unknown as ScheduleRow[]).map(mapSchedule);
    }

    getById(scheduleId: string): PersistedSchedule | null {
        const db = getSqliteDb();
        const row = db.prepare('SELECT * FROM schedules WHERE id = :scheduleId').get({ scheduleId }) as ScheduleRow | undefined;
        return row ? mapSchedule(row) : null;
    }

    upsert(input: {
        id?: string;
        name: string;
        cronExpr: string;
        timezone: string;
        enabled: boolean;
        runTemplate: Record<string, unknown>;
        lastRunAt?: string | null;
        nextRunAt?: string | null;
    }): PersistedSchedule {
        const db = getSqliteDb();
        const now = new Date().toISOString();
        const id = input.id ?? randomUUID();

        db.prepare(`
            INSERT INTO schedules (
                id, name, cron_expr, timezone, enabled, run_template_json,
                last_run_at, next_run_at, created_at, updated_at
            ) VALUES (
                :id, :name, :cronExpr, :timezone, :enabled, :runTemplateJson,
                :lastRunAt, :nextRunAt, :createdAt, :updatedAt
            )
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                cron_expr = excluded.cron_expr,
                timezone = excluded.timezone,
                enabled = excluded.enabled,
                run_template_json = excluded.run_template_json,
                last_run_at = excluded.last_run_at,
                next_run_at = excluded.next_run_at,
                updated_at = excluded.updated_at
        `).run({
            id,
            name: input.name,
            cronExpr: input.cronExpr,
            timezone: input.timezone,
            enabled: input.enabled ? 1 : 0,
            runTemplateJson: JSON.stringify(input.runTemplate),
            lastRunAt: input.lastRunAt ?? null,
            nextRunAt: input.nextRunAt ?? null,
            createdAt: now,
            updatedAt: now,
        });

        return this.getById(id)!;
    }

    markRunStarted(scheduleId: string, startedAt: string, nextRunAt: string | null): void {
        const db = getSqliteDb();
        db.prepare(`
            UPDATE schedules
            SET last_run_at = :startedAt,
                next_run_at = :nextRunAt,
                updated_at = :updatedAt
            WHERE id = :scheduleId
        `).run({
            scheduleId,
            startedAt,
            nextRunAt,
            updatedAt: startedAt,
        });
    }

    markRunFinished(scheduleId: string, finishedAt: string): void {
        const db = getSqliteDb();
        db.prepare(`
            UPDATE schedules
            SET updated_at = :finishedAt
            WHERE id = :scheduleId
        `).run({
            scheduleId,
            finishedAt,
        });
    }

    updateNextRunAt(scheduleId: string, nextRunAt: string | null): void {
        const db = getSqliteDb();
        const updatedAt = new Date().toISOString();
        db.prepare(`
            UPDATE schedules
            SET next_run_at = :nextRunAt,
                updated_at = :updatedAt
            WHERE id = :scheduleId
        `).run({
            scheduleId,
            nextRunAt,
            updatedAt,
        });
    }

    updateLastRunAt(scheduleId: string, lastRunAt: string): void {
        const db = getSqliteDb();
        db.prepare(`
            UPDATE schedules
            SET last_run_at = :lastRunAt,
                updated_at = :updatedAt
            WHERE id = :scheduleId
        `).run({
            scheduleId,
            lastRunAt,
            updatedAt: lastRunAt,
        });
    }
}

function mapSchedule(row: ScheduleRow): PersistedSchedule {
    return {
        id: row.id,
        name: row.name,
        cronExpr: row.cron_expr,
        timezone: row.timezone,
        enabled: Boolean(row.enabled),
        runTemplate: JSON.parse(row.run_template_json) as Record<string, unknown>,
        lastRunAt: row.last_run_at,
        nextRunAt: row.next_run_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
