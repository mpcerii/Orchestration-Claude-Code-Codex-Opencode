/**
 * Schedules Page - Liste, run-now, enabled/disabled, History
 */

import { useEffect, useState } from 'react';
import { api } from '../api';
import type { StudioSchedule, StudioScheduleHistoryDto } from '../types';

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<StudioSchedule[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<StudioSchedule | null>(null);
  const [history, setHistory] = useState<StudioScheduleHistoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  useEffect(() => {
    loadSchedules();
  }, []);

  async function loadSchedules() {
    try {
      setLoading(true);
      const bootstrap = await api.getStudioBootstrap();
      setSchedules(bootstrap.schedules);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedules');
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory(scheduleId: string) {
    try {
      const res = await fetch(`/api/studio/schedules/${scheduleId}/history`);
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    }
  }

  async function handleRunNow(scheduleId: string) {
    try {
      setRunning(scheduleId);
      await api.runScheduleNow(scheduleId);
      await loadSchedules();
      await loadHistory(scheduleId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run schedule');
    } finally {
      setRunning(null);
    }
  }

  async function handleToggleStatus(schedule: StudioSchedule) {
    try {
      const newStatus = schedule.status === 'active' ? 'paused' : 'active';
      const res = await fetch(`/api/studio/schedules/${schedule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await loadSchedules();
        if (selectedSchedule?.id === schedule.id) {
          await loadHistory(schedule.id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle schedule');
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleString();
  }

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="schedules-page" style={{ display: 'flex', gap: '1rem', padding: '1rem' }}>
      {/* Schedules List */}
      <div style={{ flex: '0 0 350px' }}>
        <h2>Schedules</h2>
        <button onClick={loadSchedules}>Refresh</button>
        <div style={{ marginTop: '1rem' }}>
          {schedules.length === 0 ? (
            <p>No schedules yet</p>
          ) : (
            schedules.map(schedule => (
              <div
                key={schedule.id}
                onClick={() => {
                  setSelectedSchedule(schedule);
                  loadHistory(schedule.id);
                }}
                style={{
                  padding: '0.75rem',
                  marginBottom: '0.5rem',
                  border: '1px solid #374151',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: selectedSchedule?.id === schedule.id ? '#1f2937' : 'transparent',
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                  {schedule.name}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                  <span style={{ color: schedule.status === 'active' ? '#22c55e' : '#f59e0b' }}>
                    {schedule.status}
                  </span>
                  {' • '}
                  {schedule.cron}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  Next: {formatDate(schedule.nextRunAt)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Schedule Detail */}
      <div style={{ flex: 1 }}>
        {selectedSchedule ? (
          <>
            <h3>{selectedSchedule.name}</h3>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button
                onClick={() => handleRunNow(selectedSchedule.id)}
                disabled={running === selectedSchedule.id}
                style={{
                  background: '#22c55e',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: running === selectedSchedule.id ? 'not-allowed' : 'pointer',
                  opacity: running === selectedSchedule.id ? 0.7 : 1,
                }}
              >
                {running === selectedSchedule.id ? 'Running...' : 'Run Now'}
              </button>
              
              <button
                onClick={() => handleToggleStatus(selectedSchedule)}
                style={{
                  background: selectedSchedule.status === 'active' ? '#f59e0b' : '#22c55e',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                {selectedSchedule.status === 'active' ? 'Pause' : 'Activate'}
              </button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <strong>Cron:</strong> {selectedSchedule.cron}
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <strong>Timezone:</strong> {selectedSchedule.timezone}
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <strong>Job Type:</strong> {selectedSchedule.jobType}
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <strong>Last Run:</strong> {formatDate(selectedSchedule.lastRunAt)}
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <strong>Next Run:</strong> {formatDate(selectedSchedule.nextRunAt)}
            </div>

            {/* History */}
            <h4 style={{ marginTop: '2rem' }}>History</h4>
            <div style={{ maxHeight: '400px', overflow: 'auto', border: '1px solid #374151', borderRadius: '4px' }}>
              {history.length === 0 ? (
                <p style={{ padding: '1rem' }}>No history yet</p>
              ) : (
                history.map(h => (
                  <div
                    key={h.id}
                    style={{
                      padding: '0.5rem',
                      borderBottom: '1px solid #374151',
                      fontSize: '0.875rem',
                    }}
                  >
                    <div>
                      <strong>Status:</strong>{' '}
                      <span style={{
                        color: h.status === 'completed' ? '#22c55e' :
                               h.status === 'failed' ? '#ef4444' : '#9ca3af'
                      }}>
                        {h.status}
                      </span>
                    </div>
                    <div style={{ color: '#9ca3af' }}>
                      Started: {formatDate(h.startedAt)}
                      {h.finishedAt && <> • Finished: {formatDate(h.finishedAt)}</>}
                    </div>
                    {h.error && (
                      <div style={{ color: '#ef4444', marginTop: '0.25rem' }}>
                        Error: {h.error}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <p>Select a schedule to view details</p>
        )}
      </div>
    </div>
  );
}
