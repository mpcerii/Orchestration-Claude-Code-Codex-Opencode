/**
 * Runs Page - Liste und Detailansicht
 */

import { useEffect, useState } from 'react';
import { api } from '../api';
import type { StudioRun, StudioEvent, StudioRunDetail } from '../types';

export default function RunsPage() {
  const [runs, setRuns] = useState<StudioRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<StudioRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRuns();
  }, []);

  async function loadRuns() {
    try {
      setLoading(true);
      const bootstrap = await api.getStudioBootstrap();
      setRuns(bootstrap.runs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load runs');
    } finally {
      setLoading(false);
    }
  }

  async function loadRunDetail(runId: string) {
    try {
      const detail = await api.getStudioRun(runId);
      setSelectedRun(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load run details');
    }
  }

  async function handleCancel(runId: string) {
    try {
      await api.cancelStudioRun(runId);
      await loadRuns();
      if (selectedRun?.run.id === runId) {
        await loadRunDetail(runId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel run');
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString();
  }

  function getStatusColor(state: string) {
    switch (state) {
      case 'running': return '#22c55e';
      case 'completed': return '#3b82f6';
      case 'failed': return '#ef4444';
      case 'cancelled': return '#f59e0b';
      default: return '#6b7280';
    }
  }

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="runs-page" style={{ display: 'flex', gap: '1rem', padding: '1rem' }}>
      {/* Runs List */}
      <div style={{ flex: '0 0 300px' }}>
        <h2>Runs</h2>
        <button onClick={loadRuns}>Refresh</button>
        <div style={{ marginTop: '1rem' }}>
          {runs.length === 0 ? (
            <p>No runs yet</p>
          ) : (
            runs.map(run => (
              <div
                key={run.id}
                onClick={() => loadRunDetail(run.id)}
                style={{
                  padding: '0.75rem',
                  marginBottom: '0.5rem',
                  border: '1px solid #374151',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: selectedRun?.run.id === run.id ? '#1f2937' : 'transparent',
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                  {run.goal.slice(0, 50)}...
                </div>
                <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                  <span style={{ color: getStatusColor(run.state) }}>{run.state}</span>
                  {' • '}
                  {formatDate(run.startedAt)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Run Detail */}
      <div style={{ flex: 1 }}>
        {selectedRun ? (
          <>
            <h3>Run: {selectedRun.run.id.slice(0, 8)}...</h3>
            <div style={{ marginBottom: '1rem' }}>
              <strong>Goal:</strong> {selectedRun.run.goal}
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <strong>Status:</strong>{' '}
              <span style={{ color: getStatusColor(selectedRun.run.state) }}>
                {selectedRun.run.state}
              </span>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <strong>Started:</strong> {formatDate(selectedRun.run.startedAt)}
              {selectedRun.run.finishedAt && (
                <> • <strong>Finished:</strong> {formatDate(selectedRun.run.finishedAt)}</>
              )}
            </div>
            {selectedRun.run.state === 'running' && (
              <button
                onClick={() => handleCancel(selectedRun.run.id)}
                style={{ background: '#ef4444', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Cancel Run
              </button>
            )}

            {/* Events */}
            <h4 style={{ marginTop: '2rem' }}>Events ({selectedRun.events.length})</h4>
            <div style={{ maxHeight: '400px', overflow: 'auto', border: '1px solid #374151', borderRadius: '4px' }}>
              {selectedRun.events.length === 0 ? (
                <p style={{ padding: '1rem' }}>No events</p>
              ) : (
                selectedRun.events.map(event => (
                  <div
                    key={event.id}
                    style={{
                      padding: '0.5rem',
                      borderBottom: '1px solid #374151',
                      fontSize: '0.875rem',
                    }}
                  >
                    <div>
                      <strong>{event.type}</strong>
                      {event.agentName && <span> by {event.agentName}</span>}
                    </div>
                    <div style={{ color: '#9ca3af' }}>{formatDate(event.createdAt)}</div>
                    {event.payload && (
                      <div style={{ marginTop: '0.25rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {typeof event.payload === 'string' ? event.payload.slice(0, 100) : JSON.stringify(event.payload).slice(0, 100)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <p>Select a run to view details</p>
        )}
      </div>
    </div>
  );
}
