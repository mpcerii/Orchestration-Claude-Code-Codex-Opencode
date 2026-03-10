/**
 * Memory Page - Liste, Scope-Filter, einfache Suche
 */

import { useEffect, useState } from 'react';
import { api } from '../api';
import type { MemoryEntry } from '../types';

type ScopeFilter = 'all' | 'project:default' | 'project:' | 'run:' | 'agent:' | 'global';

export default function MemoryPage() {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [selectedEntry, setSelectedEntry] = useState<MemoryEntry | null>(null);

  useEffect(() => {
    loadMemory();
  }, []);

  useEffect(() => {
    filterEntries();
  }, [entries, searchQuery, scopeFilter]);

  async function loadMemory() {
    try {
      setLoading(true);
      const bootstrap = await api.getStudioBootstrap();
      setEntries(bootstrap.memory);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memory');
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) {
      filterEntries();
      return;
    }
    try {
      const results = await api.searchStudioMemory(searchQuery);
      setFilteredEntries(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    }
  }

  function filterEntries() {
    let filtered = entries;

    // Scope filter
    if (scopeFilter !== 'all') {
      filtered = filtered.filter(entry => entry.scope.startsWith(scopeFilter.replace(':', '')));
    }

    // Search filter (local)
    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase();
      filtered = filtered.filter(entry =>
        entry.title.toLowerCase().includes(term) ||
        entry.content.toLowerCase().includes(term) ||
        entry.kind.toLowerCase().includes(term)
      );
    }

    setFilteredEntries(filtered);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString();
  }

  function getKindColor(kind: string) {
    switch (kind) {
      case 'fact': return '#3b82f6';
      case 'decision': return '#22c55e';
      case 'artifact': return '#a855f7';
      case 'failure': return '#ef4444';
      default: return '#6b7280';
    }
  }

  function getScopeLabel(scope: string) {
    const parts = scope.split(':');
    if (parts.length === 2 && parts[1]) {
      return `${parts[0]}:${parts[1]}`;
    }
    return parts[0] || scope;
  }

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="memory-page" style={{ display: 'flex', gap: '1rem', padding: '1rem' }}>
      {/* Memory List */}
      <div style={{ flex: '0 0 400px' }}>
        <h2>Memory</h2>
        
        {/* Search */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search memory..."
            style={{
              flex: 1,
              padding: '0.5rem',
              border: '1px solid #374151',
              borderRadius: '4px',
              background: '#1f2937',
              color: 'white',
            }}
          />
          <button
            onClick={handleSearch}
            style={{
              padding: '0.5rem 1rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Search
          </button>
        </div>

        {/* Scope Filter */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ marginRight: '0.5rem' }}>Filter by scope:</label>
          <select
            value={scopeFilter}
            onChange={e => setScopeFilter(e.target.value as ScopeFilter)}
            style={{
              padding: '0.5rem',
              border: '1px solid #374151',
              borderRadius: '4px',
              background: '#1f2937',
              color: 'white',
            }}
          >
            <option value="all">All</option>
            <option value="global">Global</option>
            <option value="project:">Project</option>
            <option value="run:">Run</option>
            <option value="agent:">Agent</option>
          </select>
        </div>

        <button onClick={loadMemory} style={{ marginBottom: '1rem' }}>Refresh</button>

        {/* Entries List */}
        <div>
          {filteredEntries.length === 0 ? (
            <p>No memory entries</p>
          ) : (
            filteredEntries.map(entry => (
              <div
                key={entry.id}
                onClick={() => setSelectedEntry(entry)}
                style={{
                  padding: '0.75rem',
                  marginBottom: '0.5rem',
                  border: '1px solid #374151',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: selectedEntry?.id === entry.id ? '#1f2937' : 'transparent',
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                  {entry.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>
                  <span style={{ color: getKindColor(entry.kind), fontWeight: 'bold' }}>
                    {entry.kind}
                  </span>
                  {' • '}
                  <span>{getScopeLabel(entry.scope)}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  {formatDate(entry.createdAt)}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#d1d5db', marginTop: '0.25rem' }}>
                  {entry.content.slice(0, 100)}...
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#9ca3af' }}>
          Total: {filteredEntries.length} of {entries.length} entries
        </div>
      </div>

      {/* Entry Detail */}
      <div style={{ flex: 1 }}>
        {selectedEntry ? (
          <>
            <h3>{selectedEntry.title}</h3>
            
            <div style={{ marginBottom: '1rem' }}>
              <strong>Kind:</strong>{' '}
              <span style={{ color: getKindColor(selectedEntry.kind), fontWeight: 'bold' }}>
                {selectedEntry.kind}
              </span>
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <strong>Scope:</strong> {selectedEntry.scope}
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <strong>Created:</strong> {formatDate(selectedEntry.createdAt)}
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <strong>Content:</strong>
              <pre style={{
                marginTop: '0.5rem',
                padding: '1rem',
                background: '#1f2937',
                borderRadius: '4px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                fontSize: '0.875rem',
              }}>
                {selectedEntry.content}
              </pre>
            </div>
          </>
        ) : (
          <p>Select a memory entry to view details</p>
        )}
      </div>
    </div>
  );
}
