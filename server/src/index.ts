// ============================================================
// AI Orchestra – Express Server Entry Point
// ============================================================

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import apiRouter from './routes/api.js';
import { executeTask } from './engine/orchestrator.js';
import { executeSwarm } from './engine/swarm-orchestrator.js';
import * as store from './data/store.js';
import type { WsMessage } from './types.js';
import * as dotenv from 'dotenv';
import { startTelegramBot } from './telegram/index.js';

// Load .env
dotenv.config();

const PORT = process.env.PORT || 3001;
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// REST API
app.use('/api', apiRouter);

// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// HTTP Server
const server = createServer(app);

// WebSocket Server (for live agent output streaming)
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(msg: WsMessage) {
    const payload = JSON.stringify(msg);
    console.log(`[WS Broadcast] ${msg.type}`, msg.agentName || '', msg.error || '');
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
}

// Track running tasks/swarms to prevent duplicate execution
const runningTasks = new Set<string>();
const runningSwarms = new Set<string>();

// ─── REST Endpoint for Task Execution (more reliable than WS) ──
app.post('/api/tasks/:id/execute', async (req, res) => {
    const taskId = req.params.id;
    console.log(`[Execute] Received execution request for task: ${taskId}`);

    // Prevent duplicate execution
    if (runningTasks.has(taskId)) {
        console.log(`[Execute] Task ${taskId} is already running, skipping`);
        res.status(409).json({ error: 'Task is already running' });
        return;
    }

    const task = store.getTaskById(taskId);
    if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
    }

    if (!task.assignedTreeId) {
        res.status(400).json({ error: 'No agent tree assigned to this task' });
        return;
    }

    const tree = store.getTreeById(task.assignedTreeId);
    if (!tree) {
        res.status(404).json({ error: 'Agent tree not found' });
        return;
    }

    if (!tree.workspacePath) {
        res.status(400).json({ error: 'No workspace path set on the agent tree' });
        return;
    }

    // Update task status
    store.updateTask(taskId, { status: 'in_progress' });
    runningTasks.add(taskId);
    console.log(`[Execute] Task "${task.title}" set to in_progress`);

    // Respond immediately – execution happens in background
    res.json({ status: 'started', taskId });

    // Execute in background
    try {
        const outputs = await executeTask(task, tree, broadcast);
        store.updateTask(taskId, { status: 'done', outputs });
        console.log(`[Execute] Task "${task.title}" completed with ${outputs.length} outputs`);
    } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[Execute] Task "${task.title}" failed:`, errMsg);
        store.updateTask(taskId, { status: 'review' });
        broadcast({ type: 'agent_error', taskId, error: errMsg });
    } finally {
        runningTasks.delete(taskId);
    }
});

// ─── REST Endpoint for Swarm Execution ──────────────────────────
app.post('/api/swarms/:id/execute', async (req, res) => {
    const swarmId = req.params.id;
    console.log(`[Swarm] Received execution request for swarm: ${swarmId}`);

    if (runningSwarms.has(swarmId)) {
        res.status(409).json({ error: 'Swarm is already running' });
        return;
    }

    const swarm = store.getSwarmById(swarmId);
    if (!swarm) {
        res.status(404).json({ error: 'Swarm not found' });
        return;
    }

    if (!swarm.workspacePath) {
        res.status(400).json({ error: 'No workspace path set on the swarm' });
        return;
    }

    if (!swarm.agents.length) {
        res.status(400).json({ error: 'No agents in the swarm' });
        return;
    }

    // Reset rounds for a fresh run
    store.updateSwarm(swarmId, { status: 'running', rounds: [], currentRound: 0 });
    runningSwarms.add(swarmId);

    res.json({ status: 'started', swarmId });

    // Execute in background
    try {
        await executeSwarm(
            { ...swarm, rounds: [], currentRound: 0, status: 'running' },
            broadcast,
            (updates) => { store.updateSwarm(swarmId, updates); }
        );
        console.log(`[Swarm] Swarm "${swarm.name}" completed`);
    } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[Swarm] Swarm "${swarm.name}" failed:`, errMsg);
        store.updateSwarm(swarmId, { status: 'error' });
        broadcast({ type: 'swarm_error', taskId: swarmId, error: errMsg });
    } finally {
        runningSwarms.delete(swarmId);
    }
});

app.post('/api/swarms/:id/stop', (req, res) => {
    const swarmId = req.params.id;
    // Mark as completed to break the loop on next round check
    store.updateSwarm(swarmId, { status: 'completed' });
    runningSwarms.delete(swarmId);
    broadcast({ type: 'swarm_complete', taskId: swarmId, data: 'Swarm manually stopped.' });
    res.json({ status: 'stopped' });
});

// WebSocket: handle task execution requests (kept as alternative)
wss.on('connection', (ws) => {
    console.log('[WS] Client connected');

    ws.on('message', async (raw) => {
        try {
            const data = JSON.parse(raw.toString());

            if (data.type === 'execute_task') {
                const { taskId } = data;
                const task = store.getTaskById(taskId);
                if (!task) {
                    ws.send(JSON.stringify({ type: 'agent_error', taskId, error: 'Task not found' }));
                    return;
                }

                if (!task.assignedTreeId) {
                    ws.send(JSON.stringify({ type: 'agent_error', taskId, error: 'No agent tree assigned to this task' }));
                    return;
                }

                const tree = store.getTreeById(task.assignedTreeId);
                if (!tree) {
                    ws.send(JSON.stringify({ type: 'agent_error', taskId, error: 'Agent tree not found' }));
                    return;
                }

                store.updateTask(taskId, { status: 'in_progress' });

                try {
                    const outputs = await executeTask(task, tree, broadcast);
                    store.updateTask(taskId, { status: 'done', outputs });
                } catch (err: unknown) {
                    const errMsg = err instanceof Error ? err.message : 'Unknown error';
                    store.updateTask(taskId, { status: 'review' });
                    broadcast({ type: 'agent_error', taskId, error: errMsg });
                }
            }
        } catch (err) {
            console.error('[WS] Failed to parse message:', err);
        }
    });

    ws.on('close', () => {
        console.log('[WS] Client disconnected');
    });
});


// ─── Start Telegram Bot ───────────────────────────────────────
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
if (telegramToken && telegramToken !== 'your_token_here') {
    startTelegramBot(telegramToken);
} else {
    console.log('[Telegram Bot] TELEGRAM_BOT_TOKEN not set or valid in .env. Bot disabled.');
}

// Start
server.listen(PORT, () => {
    console.log(`
  ╔══════════════════════════════════════════╗
  ║     🎵 AI Orchestra Server             ║
  ║     Running on http://localhost:${PORT}    ║
  ║     WebSocket on ws://localhost:${PORT}/ws ║
  ╚══════════════════════════════════════════╝
  `);
});
