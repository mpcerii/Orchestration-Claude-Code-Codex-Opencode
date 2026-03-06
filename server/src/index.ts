// ============================================================
// AI Orchestra – Express Server Entry Point
// ============================================================

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import apiRouter from './routes/api.js';
import { executeTask } from './engine/orchestrator.js';
import * as store from './data/store.js';
import type { WsMessage } from './types.js';

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

// Track running tasks to prevent duplicate execution
const runningTasks = new Set<string>();

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
