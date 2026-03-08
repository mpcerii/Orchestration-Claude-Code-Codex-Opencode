// ============================================================
// Data Store – JSON-based persistence for agents, trees, tasks
// ============================================================

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Agent, AgentTree, Task, Swarm, AppSettings } from '../types.js';

const DATA_DIR = path.join(process.cwd(), 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ---- Generic helpers ----

function readJson<T>(filename: string, fallback: T): T {
    const filepath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filepath)) {
        writeJson(filename, fallback);
        return fallback;
    }
    const raw = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(raw) as T;
}

function writeJson<T>(filename: string, data: T): void {
    const filepath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
}

// ---- Agents ----

export function getAgents(): Agent[] {
    return readJson<Agent[]>('agents.json', []);
}

export function getAgentById(id: string): Agent | undefined {
    return getAgents().find((a) => a.id === id);
}

export function createAgent(data: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>): Agent {
    const agents = getAgents();
    const agent: Agent = {
        ...data,
        id: uuidv4(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    agents.push(agent);
    writeJson('agents.json', agents);
    return agent;
}

export function updateAgent(id: string, data: Partial<Agent>): Agent | null {
    const agents = getAgents();
    const idx = agents.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    agents[idx] = { ...agents[idx], ...data, updatedAt: new Date().toISOString() };
    writeJson('agents.json', agents);
    return agents[idx];
}

export function deleteAgent(id: string): boolean {
    const agents = getAgents();
    const filtered = agents.filter((a) => a.id !== id);
    if (filtered.length === agents.length) return false;
    writeJson('agents.json', filtered);
    return true;
}

// ---- Agent Trees ----

export function getTrees(): AgentTree[] {
    return readJson<AgentTree[]>('trees.json', []);
}

export function getTreeById(id: string): AgentTree | undefined {
    return getTrees().find((t) => t.id === id);
}

export function createTree(data: Omit<AgentTree, 'id' | 'createdAt' | 'updatedAt'>): AgentTree {
    const trees = getTrees();
    const tree: AgentTree = {
        ...data,
        id: uuidv4(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    trees.push(tree);
    writeJson('trees.json', trees);
    return tree;
}

export function updateTree(id: string, data: Partial<AgentTree>): AgentTree | null {
    const trees = getTrees();
    const idx = trees.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    trees[idx] = { ...trees[idx], ...data, updatedAt: new Date().toISOString() };
    writeJson('trees.json', trees);
    return trees[idx];
}

export function deleteTree(id: string): boolean {
    const trees = getTrees();
    const filtered = trees.filter((t) => t.id !== id);
    if (filtered.length === trees.length) return false;
    writeJson('trees.json', filtered);
    return true;
}

// ---- Tasks ----

export function getTasks(): Task[] {
    return readJson<Task[]>('tasks.json', []);
}

export function getTaskById(id: string): Task | undefined {
    return getTasks().find((t) => t.id === id);
}

export function createTask(data: Omit<Task, 'id' | 'outputs' | 'createdAt' | 'updatedAt'>): Task {
    const tasks = getTasks();
    const task: Task = {
        ...data,
        id: uuidv4(),
        outputs: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    tasks.push(task);
    writeJson('tasks.json', tasks);
    return task;
}

export function updateTask(id: string, data: Partial<Task>): Task | null {
    const tasks = getTasks();
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    tasks[idx] = { ...tasks[idx], ...data, updatedAt: new Date().toISOString() };
    writeJson('tasks.json', tasks);
    return tasks[idx];
}

export function deleteTask(id: string): boolean {
    const tasks = getTasks();
    const filtered = tasks.filter((t) => t.id !== id);
    if (filtered.length === tasks.length) return false;
    writeJson('tasks.json', filtered);
    return true;
}

// ---- Swarms ----

export function getSwarms(): Swarm[] {
    const swarms = readJson<Swarm[]>('swarms.json', []);
    // Auto-migrate: ensure every SwarmAgent has an id
    let migrated = false;
    for (const swarm of swarms) {
        for (const sa of swarm.agents) {
            if (!sa.id) {
                sa.id = uuidv4();
                migrated = true;
            }
        }
    }
    if (migrated) writeJson('swarms.json', swarms);
    return swarms;
}

export function getSwarmById(id: string): Swarm | undefined {
    return getSwarms().find((s) => s.id === id);
}

export function createSwarm(data: Omit<Swarm, 'id' | 'rounds' | 'createdAt' | 'updatedAt'>): Swarm {
    const swarms = getSwarms();
    const swarm: Swarm = {
        ...data,
        id: uuidv4(),
        // Ensure each SwarmAgent slot has a unique id
        agents: (data.agents || []).map((sa) => ({ ...sa, id: sa.id || uuidv4() })),
        rounds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    swarms.push(swarm);
    writeJson('swarms.json', swarms);
    return swarm;
}

export function updateSwarm(id: string, data: Partial<Swarm>): Swarm | null {
    const swarms = getSwarms();
    const idx = swarms.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    swarms[idx] = { ...swarms[idx], ...data, updatedAt: new Date().toISOString() };
    writeJson('swarms.json', swarms);
    return swarms[idx];
}

export function deleteSwarm(id: string): boolean {
    const swarms = getSwarms();
    const filtered = swarms.filter((s) => s.id !== id);
    if (filtered.length === swarms.length) return false;
    writeJson('swarms.json', filtered);
    return true;
}

// ---- Settings ----

export function getSettings(): AppSettings {
    return readJson<AppSettings>('settings.json', {
        defaultWorkspacePath: process.cwd(),
        theme: 'dark',
    });
}

export function updateSettings(data: Partial<AppSettings>): AppSettings {
    const settings = getSettings();
    const updated = { ...settings, ...data };
    writeJson('settings.json', updated);
    return updated;
}
