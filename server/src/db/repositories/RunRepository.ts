import { getSqliteDb } from '../sqlite/client.js';
import type { RunContext } from '../../core/runtime/RunContext.js';
import type { RunLifecycleStatus } from '../../core/runtime/RunTypes.js';

interface RunRow {
    id: string;
    run_type: string;
    source_id: string;
    status: string;
    root_goal: string;
    metadata_json: string;
    started_at: string | null;
    finished_at: string | null;
    error: string | null;
    created_at: string;
}

export interface PersistedRun {
    id: string;
    runType: string;
    sourceId: string;
    status: RunLifecycleStatus;
    rootGoal: string;
    metadata: Record<string, unknown>;
    startedAt: string | null;
    finishedAt: string | null;
    error: string | null;
    createdAt: string;
}

export class RunRepository {
    create(context: RunContext, status: RunLifecycleStatus): void {
        const db = getSqliteDb();
        db.prepare(`
            INSERT OR IGNORE INTO runs (
                id, run_type, source_id, status, root_goal, metadata_json,
                started_at, finished_at, error, created_at
            ) VALUES (
                :id, :runType, :sourceId, :status, :rootGoal, :metadataJson,
                :startedAt, NULL, NULL, :createdAt
            )
        `).run({
            id: context.runId,
            runType: context.runType,
            sourceId: context.sourceId,
            status,
            rootGoal: context.rootGoal,
            metadataJson: JSON.stringify(context.metadata),
            startedAt: context.startedAt,
            createdAt: context.startedAt,
        });
    }

    updateStatus(runId: string, input: {
        status: RunLifecycleStatus;
        startedAt?: string | null;
        finishedAt?: string | null;
        error?: string | null;
    }): void {
        const db = getSqliteDb();
        db.prepare(`
            UPDATE runs
            SET status = :status,
                started_at = COALESCE(:startedAt, started_at),
                finished_at = :finishedAt,
                error = :error
            WHERE id = :runId
        `).run({
            runId,
            status: input.status,
            startedAt: input.startedAt ?? null,
            finishedAt: input.finishedAt ?? null,
            error: input.error ?? null,
        });
    }

    getById(runId: string): PersistedRun | null {
        const db = getSqliteDb();
        const row = db.prepare('SELECT * FROM runs WHERE id = :runId').get({ runId }) as RunRow | undefined;
        return row ? mapRun(row) : null;
    }

    list(): PersistedRun[] {
        const db = getSqliteDb();
        return (db.prepare('SELECT * FROM runs ORDER BY created_at DESC').all() as unknown as RunRow[]).map(mapRun);
    }
}

function mapRun(row: RunRow): PersistedRun {
    return {
        id: row.id,
        runType: row.run_type,
        sourceId: row.source_id,
        status: row.status as RunLifecycleStatus,
        rootGoal: row.root_goal,
        metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        error: row.error,
        createdAt: row.created_at,
    };
}
