// ============================================================
// AI Orchestra - Types
// ============================================================

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
    extraArgs: string[];     // Additional CLI flags the user always wants
    color: string;           // For UI display
    avatar?: string;
    createdAt: string;
    updatedAt: string;
}

// Agent Tree: hierarchical structure defining I/O flow
export interface TreeNode {
    id: string;
    agentId: string;
    children: TreeNode[];
    executionMode: 'sequential' | 'parallel'; // How children run
}

export interface AgentTree {
    id: string;
    name: string;
    description: string;
    rootNodes: TreeNode[];   // Can have multiple roots
    workspacePath: string;   // Directory where CLIs execute
    createdAt: string;
    updatedAt: string;
}

// Kanban
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Task {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    assignedTreeId?: string;  // Which agent tree handles this task
    prompt: string;           // The actual prompt to send to the tree
    outputs: TaskOutput[];    // Results from each agent
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

// WebSocket Events
export interface WsMessage {
    type: 'agent_start' | 'agent_output' | 'agent_complete' | 'agent_error' | 'task_complete';
    taskId: string;
    agentId?: string;
    agentName?: string;
    data?: string;
    error?: string;
}

// Settings
export interface AppSettings {
    defaultWorkspacePath: string;
    theme: 'dark' | 'light';
}
