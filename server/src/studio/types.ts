export type StudioAgentName =
  | 'Orchestrator'
  | 'Planner'
  | 'Researcher'
  | 'Coder'
  | 'Reviewer'
  | 'Tester'
  | 'File Manager';

export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ToolCallStatus = 'running' | 'completed' | 'failed';
export type ScheduleStatus = 'active' | 'paused';
export type MemoryKind = 'fact' | 'decision' | 'artifact' | 'failure';

export interface StudioAgent {
  id: string;
  name: StudioAgentName;
  role: string;
  model: string;
  endpoint: string;
  color: string;
  status: 'idle' | 'active' | 'waiting';
}

export interface AgentRun {
  id: string;
  sessionId: string;
  goal: string;
  agentName: string | null;
  state: RunStatus;
  model: string;
  startedAt: string;
  finishedAt: string | null;
}

export interface ToolCall {
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

export interface AgentMessage {
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

export interface Artifact {
  id: string;
  runId: string;
  name: string;
  path: string;
  kind: string;
  createdAt: string;
}

export interface Schedule {
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
  runs: AgentRun[];
  toolCalls: ToolCall[];
  messages: AgentMessage[];
  events: StudioEvent[];
  artifacts: Artifact[];
  schedules: Schedule[];
  memory: MemoryEntry[];
  tools: Array<{ name: string; description: string }>;
}
