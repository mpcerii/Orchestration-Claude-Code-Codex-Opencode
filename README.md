# 🎼 AI Orchestra

> **A full-stack application for orchestrating multiple AI CLI agents in configurable hierarchical pipelines.**

Define agents, compose them into trees, assign tasks, and watch them collaborate in real time — from a sleek web UI or via Telegram.

---

## ✨ Overview

AI Orchestra lets you wire together powerful AI CLI tools (**Claude, Gemini, Codex, OpenCode**) into directed agent trees. Each task flows through the tree seamlessly — every agent receives the previous agent's output as its input.

### 🔄 Execution Flow
Support for both **sequential** and **parallel** execution modes, with live output streamed directly to the UI via WebSocket.

```text
Task Prompt
    │
    ▼
[CEO Agent]
    │
    ├─── [Designer]  (parallel)
    └─── [Developer] (parallel)
            │
            ▼
       [Reviewer]   (sequential)
            │
            ▼
       [QA Tester]
```

---

## 🏗 Architecture

A modern, scalable architecture separated into a fast frontend and a robust Node.js backend.

### 💻 Client (`/client`)
Built for a smooth, interactive user experience:
- **Framework:** React 19 with React Router v7
- **Styling:** TailwindCSS v4 for a clean, professional look
- **Interactivity:** `@dnd-kit` for drag-and-drop (Kanban board, visual tree builder)
- **Icons:** Lucide React for crisp, consistent iconography

### ⚙️ Server (`/server`)
- **API:** Express 5 REST API (Port `3001`)
- **Real-time:** WebSocket server (`ws://localhost:3001/ws`) for live output streaming
- **Orchestrator:** Deep-first agent tree traversal routing I/O between agents
- **CLI Runner:** Spawns AI processes via `cross-spawn` (piping prompts via `stdin`)
- **Persistence:** Lightweight JSON file-based storage (`server/data/`)

---

## 🤖 Supported CLI Tools

| Tool | CLI Command | Key Flags |
|------|------------|-----------|
| **Claude** | `claude` | `--print`, `--output-format text`, `--dangerously-skip-permissions` |
| **Gemini** | `gemini` | `-m <model>`, `--approval-mode yolo` |
| **Codex** | `codex` | `-m <model>`, `-C <workspace>`, `exec --yolo --skip-git-repo-check --color never` |
| **OpenCode** | `opencode` | `-m <model>`, `run <prompt>` |

> **Note:** Claude receives prompts via **stdin**; all other tools receive it as a trailing argument.

---

## 🎭 Agent Roles

Assign roles to inject specific context into prompts:

- 👔 `ceo` — Product vision and high-level decisions
- 🎨 `designer` — UI/UX and design specifications
- 💻 `developer` — Implementation and coding
- 🔍 `reviewer` — Code review and feedback
- 🛡️ `security_tester` — Security analysis
- 🧪 `qa_tester` — Quality assurance
- 🚀 `devops` — Infrastructure & CI/CD
- 📋 `product_manager` — Requirements prioritization
- 🔧 `custom` — User-defined label

---

## 📱 Telegram Bot Integration

Manage your AI tasks on the go without the web UI:

- `/start` — Welcome & commands
- `/tasks` — View tasks with inline action buttons
- `/newtask` — Step-by-step creation wizard

*Inline buttons let you run tasks and approve completions directly in chat!*

---

## 🚀 Getting Started

### 1. Install dependencies

```bash
# Install root, server, and client dependencies
npm install
cd server && npm install
cd ../client && npm install
```

### 2. Configure Environment

Create a `.env` file in the `server/` directory:
```env
PORT=3001
TELEGRAM_BOT_TOKEN=your_token_here # Optional
```

### 3. Run in Development Mode

```bash
# From the project root — starts both server and client concurrently
npm run dev
```

| Service | Local URL |
|---------|-----------|
| **API Server** | `http://localhost:3001` |
| **WebSocket** | `ws://localhost:3001/ws` |
| **Client** | `http://localhost:5173` |

---

## 💾 Data Persistence

All data is stored securely as JSON files in `server/data/`:
- `agents.json`
- `trees.json`
- `tasks.json`
- `settings.json`

*(Directory and defaults are auto-generated on the first run).*

---

## 📜 License
Private — All rights reserved.
