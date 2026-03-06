// ============================================================
// API Routes – Express routes for agents, trees, tasks
// ============================================================

import { Router } from 'express';
import * as store from '../data/store.js';
import { getAvailableModels, checkToolStatus } from '../engine/cli-runner.js';
import type { CliTool } from '../types.js';

const router = Router();

// ---- Agents ----

router.get('/agents', (_req, res) => {
    res.json(store.getAgents());
});

router.get('/agents/:id', (req, res) => {
    const agent = store.getAgentById(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json(agent);
});

router.post('/agents', (req, res) => {
    const agent = store.createAgent(req.body);
    res.status(201).json(agent);
});

router.put('/agents/:id', (req, res) => {
    const agent = store.updateAgent(req.params.id, req.body);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json(agent);
});

router.delete('/agents/:id', (req, res) => {
    const ok = store.deleteAgent(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Agent not found' });
    res.json({ success: true });
});

// ---- Agent Trees ----

router.get('/trees', (_req, res) => {
    res.json(store.getTrees());
});

router.get('/trees/:id', (req, res) => {
    const tree = store.getTreeById(req.params.id);
    if (!tree) return res.status(404).json({ error: 'Tree not found' });
    res.json(tree);
});

router.post('/trees', (req, res) => {
    const tree = store.createTree(req.body);
    res.status(201).json(tree);
});

router.put('/trees/:id', (req, res) => {
    const tree = store.updateTree(req.params.id, req.body);
    if (!tree) return res.status(404).json({ error: 'Tree not found' });
    res.json(tree);
});

router.delete('/trees/:id', (req, res) => {
    const ok = store.deleteTree(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Tree not found' });
    res.json({ success: true });
});

// ---- Tasks ----

router.get('/tasks', (_req, res) => {
    res.json(store.getTasks());
});

router.get('/tasks/:id', (req, res) => {
    const task = store.getTaskById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
});

router.post('/tasks', (req, res) => {
    const task = store.createTask(req.body);
    res.status(201).json(task);
});

router.put('/tasks/:id', (req, res) => {
    const task = store.updateTask(req.params.id, req.body);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
});

router.delete('/tasks/:id', (req, res) => {
    const ok = store.deleteTask(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true });
});

// ---- Swarms ----

router.get('/swarms', (_req, res) => {
    res.json(store.getSwarms());
});

router.get('/swarms/:id', (req, res) => {
    const swarm = store.getSwarmById(req.params.id);
    if (!swarm) return res.status(404).json({ error: 'Swarm not found' });
    res.json(swarm);
});

router.post('/swarms', (req, res) => {
    const swarm = store.createSwarm(req.body);
    res.status(201).json(swarm);
});

router.put('/swarms/:id', (req, res) => {
    const swarm = store.updateSwarm(req.params.id, req.body);
    if (!swarm) return res.status(404).json({ error: 'Swarm not found' });
    res.json(swarm);
});

router.delete('/swarms/:id', (req, res) => {
    const ok = store.deleteSwarm(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Swarm not found' });
    res.json({ success: true });
});

// ---- Settings ----

router.get('/settings', (_req, res) => {
    res.json(store.getSettings());
});

router.put('/settings', (req, res) => {
    const settings = store.updateSettings(req.body);
    res.json(settings);
});

// ---- Models meta ----

router.get('/models/:tool', (req, res) => {
    const tool = req.params.tool as CliTool;
    res.json(getAvailableModels(tool));
});

// ---- System Status ----

router.get('/system/tools-status', async (_req, res) => {
    const tools = ['claude', 'gemini', 'codex', 'opencode'];
    const status: Record<string, boolean> = {};

    // Check all tools concurrently
    await Promise.all(
        tools.map(async (tool) => {
            status[tool] = await checkToolStatus(tool);
        })
    );

    res.json(status);
});

export default router;
