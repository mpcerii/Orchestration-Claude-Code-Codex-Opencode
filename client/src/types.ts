// Shared types – mirrored from server for client-side use

export type CliTool = 'claude' | 'gemini' | 'codex' | 'opencode';

export type AgentRole =
    | 'ceo'
    | 'designer'
    | 'developer'
    | 'reviewer'
    | 'security_tester'
    | 'qa_tester'
    | 'devops'
    | 'product_manager'
    | 'custom';

export interface Agent {
    id: string;
    name: string;
    role: AgentRole;
    roleLabel: string;
    cliTool: CliTool;
    model: string;
    systemPrompt: string;
    extraArgs: string[];
    color: string;
    avatar?: string;
    createdAt: string;
    updatedAt: string;
}

export interface TreeNode {
    id: string;
    agentId: string;
    children: TreeNode[];
    executionMode: 'sequential' | 'parallel';
}

export interface AgentTree {
    id: string;
    name: string;
    description: string;
    rootNodes: TreeNode[];
    workspacePath: string;
    createdAt: string;
    updatedAt: string;
}

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Task {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    assignedTreeId?: string;
    prompt: string;
    outputs: TaskOutput[];
    createdAt: string;
    updatedAt: string;
}

export interface TaskOutput {
    agentId: string;
    agentName: string;
    input: string;
    output: string;
    status: 'pending' | 'running' | 'completed' | 'error';
    startedAt?: string;
    completedAt?: string;
    error?: string;
}

export interface WsMessage {
    type: 'agent_start' | 'agent_output' | 'agent_complete' | 'agent_error' | 'task_complete' | 'swarm_round' | 'swarm_complete' | 'swarm_error' | 'swarm_status';
    taskId: string;
    agentId?: string;
    agentName?: string;
    data?: string;
    error?: string;
}

export interface AppSettings {
    defaultWorkspacePath: string;
    theme: 'dark' | 'light';
}

// Agent Swarm – autonomous multi-agent collaboration
export type SwarmStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';

export interface SwarmAgent {
    id: string;          // Unique ID for this swarm slot (allows same agent multiple times)
    agentId: string;     // References the actual Agent
    role: 'coordinator' | 'analyzer' | 'developer' | 'reviewer' | 'tester';
    instructions: string; // What this agent should focus on
}

export interface SwarmRound {
    round: number;
    agentId: string;
    agentName: string;
    role: string;
    input: string;
    output: string;
    timestamp: string;
}

export interface Swarm {
    id: string;
    name: string;
    description: string;
    agents: SwarmAgent[];
    workspacePath: string;
    minRounds: number;       // Minimum rounds before SWARM_COMPLETE is allowed
    maxRounds: number;       // Safety limit
    status: SwarmStatus;
    rounds: SwarmRound[];
    currentRound: number;
    createdAt: string;
    updatedAt: string;
}

export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ToolCallStatus = 'running' | 'completed' | 'failed';
export type ScheduleStatus = 'active' | 'paused';
export type MemoryKind = 'fact' | 'decision' | 'artifact' | 'failure';

export interface StudioAgent {
    id: string;
    name: string;
    role: string;
    model: string;
    endpoint: string;
    color: string;
    status: 'idle' | 'active' | 'waiting';
}

export interface StudioRun {
    id: string;
    sessionId: string;
    goal: string;
    agentName: string | null;
    state: RunStatus;
    model: string;
    startedAt: string;
    finishedAt: string | null;
}

export interface StudioToolCall {
    id: string;
    runId: string;
    agentName: string;
    toolName: string;
    input: string;
    output: string;
    status: ToolCallStatus;
    startedAt: string;
    finishedAt: string | null;
}

export interface StudioMessage {
    id: string;
    sessionId: string;
    runId: string;
    fromAgent: string;
    toAgent: string;
    role: 'handoff' | 'status' | 'result';
    content: string;
    createdAt: string;
}

export interface StudioEvent {
    id: string;
    runId: string;
    sessionId: string;
    type: string;
    agentName: string | null;
    payload: string;
    createdAt: string;
}

export interface StudioArtifact {
    id: string;
    runId: string;
    name: string;
    path: string;
    kind: string;
    createdAt: string;
}

export interface StudioSchedule {
    id: string;
    name: string;
    cron: string;
    timezone: string;
    jobType: string;
    status: ScheduleStatus;
    lastRunAt: string | null;
    nextRunAt: string | null;
}

export interface MemoryEntry {
    id: string;
    scope: string;
    kind: MemoryKind;
    title: string;
    content: string;
    createdAt: string;
}

export interface StudioBootstrap {
    overview: {
        activeRunCount: number;
        totalRunCount: number;
        eventCount: number;
        artifactCount: number;
        scheduleCount: number;
        memoryCount: number;
    };
    agents: StudioAgent[];
    runs: StudioRun[];
    toolCalls: StudioToolCall[];
    messages: StudioMessage[];
    events: StudioEvent[];
    artifacts: StudioArtifact[];
    schedules: StudioSchedule[];
    memory: MemoryEntry[];
    tools: Array<{ name: string; description: string }>;
}

export interface StudioRunDetail {
    run: StudioRun;
    toolCalls: StudioToolCall[];
    messages: StudioMessage[];
    events: StudioEvent[];
    artifacts: StudioArtifact[];
}

export type SocketMessage =
    | WsMessage
    | { type: 'studio.connected'; connectedAt: string }
    | { type: 'studio.event'; event: StudioEvent };

// UI Helpers
export const ROLE_OPTIONS: { value: AgentRole; label: string }[] = [
    { value: 'ceo', label: 'CEO / Lead' },
    { value: 'product_manager', label: 'Product Manager' },
    { value: 'designer', label: 'Designer' },
    { value: 'developer', label: 'Developer' },
    { value: 'reviewer', label: 'Code Reviewer' },
    { value: 'security_tester', label: 'Security Tester' },
    { value: 'qa_tester', label: 'QA Tester' },
    { value: 'devops', label: 'DevOps' },
    { value: 'custom', label: 'Custom Role' },
];

export const CLI_TOOLS: { value: CliTool; label: string; color: string }[] = [
    { value: 'claude', label: 'Claude Code', color: '#d28c46' },
    { value: 'gemini', label: 'Gemini CLI', color: '#4285f4' },
    { value: 'codex', label: 'Codex CLI', color: '#10a37f' },
    { value: 'opencode', label: 'OpenCode', color: '#a855f7' },
];

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
    low: '#22c55e',
    medium: '#f59e0b',
    high: '#f97316',
    critical: '#ef4444',
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
    backlog: 'Backlog',
    todo: 'To Do',
    in_progress: 'In Progress',
    review: 'Review',
    done: 'Done',
};
