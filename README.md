# AI Orchestra

A full-stack application for orchestrating multiple AI CLI agents in configurable hierarchical pipelines. Define agents, compose them into trees, assign tasks, and watch them collaborate in real time.

---

## Overview

AI Orchestra lets you wire together AI CLI tools (Claude, Gemini, Codex, OpenCode) into directed agent trees. Each task flows through the tree — every agent receives the previous agent's output as its input — with support for sequential and parallel execution modes. Live output is streamed to the UI via WebSocket.

```
Task Prompt
    │
    ▼
[CEO Agent]
    │
    ├── [Designer]  (parallel)
    └── [Developer] (parallel)
            │
            ▼
       [Reviewer]   (sequential)
            │
            ▼
       [QA Tester]
```

---

## Architecture

```
ai_orchestra/
├── client/          # React 19 + Vite + TailwindCSS frontend
│   └── src/
└── server/          # Node.js + Express + TypeScript backend
    └── src/
        ├── engine/
        │   ├── cli-runner.ts     # Spawns CLI tools, pipes prompts via stdin
        │   └── orchestrator.ts   # Walks agent tree, routes I/O between agents
        ├── routes/
        │   └── api.ts            # REST endpoints for agents, trees, tasks, settings
        ├── data/
        │   └── store.ts          # JSON file-based persistence
        ├── types.ts              # Shared TypeScript types
        └── index.ts              # Express + WebSocket server entry point
```

### Server (`/server`)

- **Express 5** REST API on port `3001`
- **WebSocket** server at `ws://localhost:3001/ws` for real-time output streaming
- **Orchestrator** walks the agent tree depth-first, passing each agent's output to its children
- **CLI Runner** spawns AI CLI processes and pipes prompts through `stdin` (avoids shell escaping issues)
- **Persistence** via flat JSON files in `server/data/`

### Client (`/client`)

- **React 19** with **React Router v7**
- **TailwindCSS v4** for styling
- **@dnd-kit** for drag-and-drop (Kanban board, tree builder)
- **Lucide React** icons

---

## Supported CLI Tools

| Tool | CLI Command | Key Flags |
|------|------------|-----------|
| Claude | `claude` | `--print`, `--output-format text`, `--permission-mode bypassPermissions` |
| Gemini | `gemini` | `--approval-mode yolo` |
| Codex | `codex` | `--full-auto`, `-C <workspace>` |
| OpenCode | `opencode` | `-m <model>` |

Prompts (including system prompt context) are always piped via `stdin`, never passed as shell arguments.

---

## Agent Roles

Agents can be assigned one of the following roles, which are injected into the prompt as role context:

- `ceo` — Product vision and high-level decisions
- `designer` — UI/UX and design specifications
- `developer` — Implementation and coding
- `reviewer` — Code review and feedback
- `security_tester` — Security analysis and vulnerability testing
- `qa_tester` — Quality assurance and test cases
- `devops` — Infrastructure, CI/CD, deployment
- `product_manager` — Requirements and prioritization
- `custom` — Any custom role with a user-defined label

---

## Core Concepts

### Agent

An agent is a named AI configuration:

```ts
{
  id: string;
  name: string;
  role: AgentRole;
  roleLabel: string;       // Human-readable role label injected into prompts
  cliTool: CliTool;        // 'claude' | 'gemini' | 'codex' | 'opencode'
  model: string;           // e.g. 'claude-opus-4-6'
  systemPrompt: string;    // Injected before user input via stdin
  extraArgs: string[];     // Additional CLI flags
  color: string;           // UI display color
}
```

### Agent Tree

A hierarchical structure defining execution flow:

```ts
{
  id: string;
  name: string;
  rootNodes: TreeNode[];     // Can have multiple entry points
  workspacePath: string;     // Directory where CLIs execute
}

// Each node:
{
  agentId: string;
  children: TreeNode[];
  executionMode: 'sequential' | 'parallel';
}
```

### Task

A unit of work with Kanban lifecycle management:

```ts
{
  title: string;
  description: string;
  status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTreeId: string;   // Which agent tree executes this task
  prompt: string;           // Initial prompt sent to the root agent(s)
  outputs: TaskOutput[];    // Collected results from each agent
}
```

---

## API Reference

All endpoints are prefixed with `/api`.

### Agents

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/agents` | List all agents |
| `GET` | `/agents/:id` | Get agent by ID |
| `POST` | `/agents` | Create agent |
| `PUT` | `/agents/:id` | Update agent |
| `DELETE` | `/agents/:id` | Delete agent |

### Agent Trees

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/trees` | List all trees |
| `GET` | `/trees/:id` | Get tree by ID |
| `POST` | `/trees` | Create tree |
| `PUT` | `/trees/:id` | Update tree |
| `DELETE` | `/trees/:id` | Delete tree |

### Tasks

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/tasks` | List all tasks |
| `GET` | `/tasks/:id` | Get task by ID |
| `POST` | `/tasks` | Create task |
| `PUT` | `/tasks/:id` | Update task |
| `DELETE` | `/tasks/:id` | Delete task |
| `POST` | `/tasks/:id/execute` | Execute task through its assigned tree |

### Other

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/settings` | Get app settings |
| `PUT` | `/settings` | Update app settings |
| `GET` | `/models/:tool` | Get available models for a CLI tool |
| `GET` | `/health` | Health check |

### WebSocket

Connect to `ws://localhost:3001/ws`.

**Send** to execute a task:
```json
{ "type": "execute_task", "taskId": "<id>" }
```

**Receive** live events:
```json
{ "type": "agent_start",    "taskId": "...", "agentId": "...", "agentName": "...", "data": "..." }
{ "type": "agent_output",   "taskId": "...", "agentId": "...", "agentName": "...", "data": "..." }
{ "type": "agent_complete", "taskId": "...", "agentId": "...", "agentName": "...", "data": "..." }
{ "type": "agent_error",    "taskId": "...", "agentId": "...", "error": "..." }
{ "type": "task_complete",  "taskId": "...", "data": "..." }
```

---

## Prerequisites

- **Node.js** >= 18
- At least one AI CLI installed and authenticated:
  - [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (`claude`)
  - [Gemini CLI](https://github.com/google-gemini/gemini-cli) (`gemini`)
  - [Codex CLI](https://github.com/openai/codex) (`codex`)
  - [OpenCode](https://opencode.ai) (`opencode`)

---

## Getting Started

### 1. Install dependencies

```bash
# From the project root
npm install

# Server dependencies
cd server && npm install

# Client dependencies
cd ../client && npm install
```

### 2. Run in development mode

```bash
# From the project root — starts both server and client concurrently
npm run dev
```

| Service | URL |
|---------|-----|
| API Server | `http://localhost:3001` |
| WebSocket | `ws://localhost:3001/ws` |
| Client (Vite) | `http://localhost:5173` |

### 3. Run server only

```bash
cd server
npm run dev      # tsx watch (hot reload)
```

### 4. Build for production

```bash
# Server
cd server && npm run build && npm start

# Client
cd client && npm run build
```

---

## Data Persistence

All data is stored as JSON files in `server/data/`:

```
server/data/
├── agents.json
├── trees.json
├── tasks.json
└── settings.json
```

The directory and default files are created automatically on first run.

---

## Development Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start server + client concurrently (root) |
| `npm run dev:server` | Start server only |
| `npm run dev:client` | Start client only |
| `cd server && npm run build` | Compile TypeScript to `dist/` |
| `cd server && npm start` | Run compiled server |
| `cd client && npm run build` | Build client for production |
| `cd client && npm run lint` | Run ESLint on client code |

---

## License

Private — all rights reserved.



