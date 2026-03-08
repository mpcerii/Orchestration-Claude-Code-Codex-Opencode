// ============================================================
// API Client – fetch wrapper for the Express backend
// ============================================================

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Request failed');
    }
    return res.json();
}

// Agents
export const api = {
    // Agents
    getAgents: () => request<import('./types').Agent[]>('/agents'),
    getAgent: (id: string) => request<import('./types').Agent>(`/agents/${id}`),
    createAgent: (data: Partial<import('./types').Agent>) =>
        request<import('./types').Agent>('/agents', { method: 'POST', body: JSON.stringify(data) }),
    updateAgent: (id: string, data: Partial<import('./types').Agent>) =>
        request<import('./types').Agent>(`/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteAgent: (id: string) =>
        request<{ success: boolean }>(`/agents/${id}`, { method: 'DELETE' }),

    // Trees
    getTrees: () => request<import('./types').AgentTree[]>('/trees'),
    getTree: (id: string) => request<import('./types').AgentTree>(`/trees/${id}`),
    createTree: (data: Partial<import('./types').AgentTree>) =>
        request<import('./types').AgentTree>('/trees', { method: 'POST', body: JSON.stringify(data) }),
    updateTree: (id: string, data: Partial<import('./types').AgentTree>) =>
        request<import('./types').AgentTree>(`/trees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteTree: (id: string) =>
        request<{ success: boolean }>(`/trees/${id}`, { method: 'DELETE' }),

    // Tasks
    getTasks: () => request<import('./types').Task[]>('/tasks'),
    getTask: (id: string) => request<import('./types').Task>(`/tasks/${id}`),
    createTask: (data: Partial<import('./types').Task>) =>
        request<import('./types').Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    updateTask: (id: string, data: Partial<import('./types').Task>) =>
        request<import('./types').Task>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteTask: (id: string) =>
        request<{ success: boolean }>(`/tasks/${id}`, { method: 'DELETE' }),
    executeTask: (id: string) =>
        request<{ status: string; taskId: string }>(`/tasks/${id}/execute`, { method: 'POST' }),

    // Swarms
    getSwarms: () => request<import('./types').Swarm[]>('/swarms'),
    getSwarm: (id: string) => request<import('./types').Swarm>(`/swarms/${id}`),
    createSwarm: (data: Partial<import('./types').Swarm>) =>
        request<import('./types').Swarm>('/swarms', { method: 'POST', body: JSON.stringify(data) }),
    updateSwarm: (id: string, data: Partial<import('./types').Swarm>) =>
        request<import('./types').Swarm>(`/swarms/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteSwarm: (id: string) =>
        request<{ success: boolean }>(`/swarms/${id}`, { method: 'DELETE' }),
    executeSwarm: (id: string) =>
        request<{ status: string; swarmId: string }>(`/swarms/${id}/execute`, { method: 'POST' }),
    stopSwarm: (id: string) =>
        request<{ status: string }>(`/swarms/${id}/stop`, { method: 'POST' }),

    // Settings
    getSettings: () => request<import('./types').AppSettings>('/settings'),
    updateSettings: (data: Partial<import('./types').AppSettings>) =>
        request<import('./types').AppSettings>('/settings', { method: 'PUT', body: JSON.stringify(data) }),

    // Models
    getModels: (tool: import('./types').CliTool) => request<string[]>(`/models/${tool}`),

    // System
    getToolsStatus: () => request<Record<string, boolean>>('/system/tools-status'),

    // Swarm Studio
    getStudioBootstrap: () => request<import('./types').StudioBootstrap>('/studio/bootstrap'),
    getStudioRun: (id: string) => request<import('./types').StudioRunDetail>(`/studio/runs/${id}`),
    createStudioRun: (goal: string) =>
        request<import('./types').StudioRunDetail>('/studio/runs', { method: 'POST', body: JSON.stringify({ goal }) }),
    cancelStudioRun: (id: string) =>
        request<import('./types').StudioRunDetail>(`/studio/runs/${id}/cancel`, { method: 'POST' }),
    searchStudioMemory: (query: string) =>
        request<import('./types').MemoryEntry[]>(`/studio/memory/search?q=${encodeURIComponent(query)}`),
    runScheduleNow: (id: string) =>
        request<import('./types').StudioSchedule>(`/studio/schedules/${id}/run-now`, { method: 'POST' }),
};
