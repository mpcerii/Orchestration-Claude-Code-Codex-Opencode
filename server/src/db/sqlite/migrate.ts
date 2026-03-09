import type { DatabaseSync } from 'node:sqlite';

export function runSqliteMigrations(db: DatabaseSync): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS runs (
            id TEXT PRIMARY KEY,
            run_type TEXT NOT NULL,
            source_id TEXT NOT NULL,
            status TEXT NOT NULL,
            root_goal TEXT NOT NULL,
            metadata_json TEXT NOT NULL,
            started_at TEXT,
            finished_at TEXT,
            error TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS run_events (
            id TEXT PRIMARY KEY,
            run_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS schedules (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            cron_expr TEXT NOT NULL,
            timezone TEXT NOT NULL,
            enabled INTEGER NOT NULL,
            run_template_json TEXT NOT NULL,
            last_run_at TEXT,
            next_run_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS memory_entries (
            id TEXT PRIMARY KEY,
            scope_type TEXT NOT NULL,
            scope_id TEXT NOT NULL,
            memory_type TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            metadata_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS schedule_runs (
            id TEXT PRIMARY KEY,
            schedule_id TEXT NOT NULL,
            run_id TEXT NOT NULL,
            status TEXT NOT NULL,
            started_at TEXT NOT NULL,
            finished_at TEXT,
            error TEXT,
            FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
            FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_schedule_runs_schedule_id ON schedule_runs(schedule_id);
        CREATE INDEX IF NOT EXISTS idx_schedule_runs_run_id ON schedule_runs(run_id);
        CREATE INDEX IF NOT EXISTS idx_schedule_runs_status ON schedule_runs(status);
        CREATE INDEX IF NOT EXISTS idx_schedule_runs_started_at ON schedule_runs(started_at);
    `);
}
