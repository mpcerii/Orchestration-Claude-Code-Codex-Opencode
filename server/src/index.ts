import cors from 'cors';
import * as dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import * as store from './data/store.js';
import { executeTask } from './engine/orchestrator.js';
import { executeSwarm } from './engine/swarm-orchestrator.js';
import apiRouter from './routes/api.js';
import studioRouter from './studio/router.js';
import { onStudioEvent } from './studio/service.js';
import { startTelegramBot } from './telegram/index.js';
import type { WsMessage } from './types.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());
app.use('/api', apiRouter);
app.use('/api', studioRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ai-swarm-studio', timestamp: new Date().toISOString() });
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const runningTasks = new Set<string>();
const runningSwarms = new Set<string>();

function broadcast(payload: Record<string, unknown>) {
  const serialized = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(serialized);
    }
  }
}

onStudioEvent((event) => {
  broadcast({ type: 'studio.event', event });
});

function broadcastLegacy(message: WsMessage) {
  broadcast(message as unknown as Record<string, unknown>);
}

app.post('/api/tasks/:id/execute', async (req, res) => {
  const taskId = req.params.id;
  if (runningTasks.has(taskId)) {
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
  if (!tree || !tree.workspacePath) {
    res.status(400).json({ error: 'Assigned tree is missing or has no workspace path' });
    return;
  }

  store.updateTask(taskId, { status: 'in_progress' });
  runningTasks.add(taskId);
  res.json({ status: 'started', taskId });

  try {
    const outputs = await executeTask(task, tree, broadcastLegacy);
    store.updateTask(taskId, { status: 'done', outputs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    store.updateTask(taskId, { status: 'review' });
    broadcastLegacy({ type: 'agent_error', taskId, error: message });
  } finally {
    runningTasks.delete(taskId);
  }
});

app.post('/api/swarms/:id/execute', async (req, res) => {
  const swarmId = req.params.id;
  if (runningSwarms.has(swarmId)) {
    res.status(409).json({ error: 'Swarm is already running' });
    return;
  }

  const swarm = store.getSwarmById(swarmId);
  if (!swarm || !swarm.workspacePath || swarm.agents.length === 0) {
    res.status(400).json({ error: 'Swarm is missing, has no workspace path, or contains no agents' });
    return;
  }

  store.updateSwarm(swarmId, { status: 'running', rounds: [], currentRound: 0 });
  runningSwarms.add(swarmId);
  res.json({ status: 'started', swarmId });

  try {
    await executeSwarm(
      { ...swarm, status: 'running', rounds: [], currentRound: 0 },
      broadcastLegacy,
      (updates) => {
        store.updateSwarm(swarmId, updates);
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    store.updateSwarm(swarmId, { status: 'error' });
    broadcastLegacy({ type: 'swarm_error', taskId: swarmId, error: message });
  } finally {
    runningSwarms.delete(swarmId);
  }
});

app.post('/api/swarms/:id/stop', (req, res) => {
  const swarmId = req.params.id;
  store.updateSwarm(swarmId, { status: 'completed' });
  runningSwarms.delete(swarmId);
  broadcastLegacy({ type: 'swarm_complete', taskId: swarmId, data: 'Swarm manually stopped.' });
  res.json({ status: 'stopped' });
});

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'studio.connected', connectedAt: new Date().toISOString() }));

  ws.on('message', async (raw) => {
    try {
      const data = JSON.parse(raw.toString()) as { type?: string; taskId?: string };
      if (data.type !== 'execute_task' || !data.taskId) {
        return;
      }

      const task = store.getTaskById(data.taskId);
      if (!task || !task.assignedTreeId) {
        ws.send(JSON.stringify({ type: 'agent_error', taskId: data.taskId, error: 'Task or tree not found' }));
        return;
      }

      const tree = store.getTreeById(task.assignedTreeId);
      if (!tree) {
        ws.send(JSON.stringify({ type: 'agent_error', taskId: data.taskId, error: 'Agent tree not found' }));
        return;
      }

      store.updateTask(data.taskId, { status: 'in_progress' });
      try {
        const outputs = await executeTask(task, tree, broadcastLegacy);
        store.updateTask(data.taskId, { status: 'done', outputs });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        store.updateTask(data.taskId, { status: 'review' });
        broadcastLegacy({ type: 'agent_error', taskId: data.taskId, error: message });
      }
    } catch (error) {
      console.error('Failed to parse websocket message', error);
    }
  });
});

const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
if (telegramToken && telegramToken !== 'your_token_here') {
  startTelegramBot(telegramToken);
}

server.listen(port, () => {
  console.log(`AI Swarm Studio server listening on http://localhost:${port}`);
});
