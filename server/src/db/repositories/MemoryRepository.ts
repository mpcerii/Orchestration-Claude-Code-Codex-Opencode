import { randomUUID } from 'node:crypto';
import { getSqliteDb } from '../sqlite/client.js';

interface MemoryRow {
    id: string;
    scope_type: string;
    scope_id: string;
    memory_type: string;
    title: string;
    content: string;
    metadata_json: string;
    created_at: string;
    updated_at: string;
}

export interface PersistedMemoryEntry {
    id: string;
    scopeType: string;
    scopeId: string;
    memoryType: string;
    title: string;
    content: string;
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}

export class MemoryRepository {
    create(input: {
        scopeType: string;
        scopeId: string;
        memoryType: string;
        title: string;
        content: string;
        metadata?: Record<string, unknown>;
    }): PersistedMemoryEntry {
        const db = getSqliteDb();
        const now = new Date().toISOString();
        const id = randomUUID();

        db.prepare(`
            INSERT INTO memory_entries (
                id, scope_type, scope_id, memory_type, title, content,
                metadata_json, created_at, updated_at
            ) VALUES (
                :id, :scopeType, :scopeId, :memoryType, :title, :content,
                :metadataJson, :createdAt, :updatedAt
            )
        `).run({
            id,
            scopeType: input.scopeType,
            scopeId: input.scopeId,
            memoryType: input.memoryType,
            title: input.title,
            content: input.content,
            metadataJson: JSON.stringify(input.metadata ?? {}),
            createdAt: now,
            updatedAt: now,
        });

        return this.getById(id)!;
    }

    getById(memoryId: string): PersistedMemoryEntry | null {
        const db = getSqliteDb();
        const row = db.prepare('SELECT * FROM memory_entries WHERE id = :memoryId').get({ memoryId }) as MemoryRow | undefined;
        return row ? mapMemory(row) : null;
    }

    list(scopeType?: string, scopeId?: string): PersistedMemoryEntry[] {
        const db = getSqliteDb();

        if (scopeType && scopeId) {
            return (db.prepare(`
                SELECT * FROM memory_entries
                WHERE scope_type = :scopeType AND scope_id = :scopeId
                ORDER BY created_at DESC
            `).all({ scopeType, scopeId }) as unknown as MemoryRow[]).map(mapMemory);
        }

        return (db.prepare('SELECT * FROM memory_entries ORDER BY created_at DESC').all() as unknown as MemoryRow[]).map(mapMemory);
    }

    search(query: string): PersistedMemoryEntry[] {
        const db = getSqliteDb();
        return (db.prepare(`
            SELECT * FROM memory_entries
            WHERE lower(title) LIKE :pattern OR lower(content) LIKE :pattern
            ORDER BY created_at DESC
        `).all({ pattern: `%${query.toLowerCase()}%` }) as unknown as MemoryRow[]).map(mapMemory);
    }

    deleteById(memoryId: string): boolean {
        const db = getSqliteDb();
        const result = db.prepare('DELETE FROM memory_entries WHERE id = :memoryId').run({ memoryId });
        return result.changes > 0;
    }
}

function mapMemory(row: MemoryRow): PersistedMemoryEntry {
    return {
        id: row.id,
        scopeType: row.scope_type,
        scopeId: row.scope_id,
        memoryType: row.memory_type,
        title: row.title,
        content: row.content,
        metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
