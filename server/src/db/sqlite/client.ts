import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

let sqliteDb: DatabaseSync | null = null;

export function initializeSqlite(dbFilePath = path.join(process.cwd(), 'data', 'swarm.db')): DatabaseSync {
    if (sqliteDb) {
        return sqliteDb;
    }

    const directory = path.dirname(dbFilePath);
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }

    sqliteDb = new DatabaseSync(dbFilePath);
    sqliteDb.exec('PRAGMA journal_mode = WAL;');
    return sqliteDb;
}

export function getSqliteDb(): DatabaseSync {
    if (!sqliteDb) {
        throw new Error('SQLite database has not been initialized.');
    }

    return sqliteDb;
}
