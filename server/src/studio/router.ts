import { Router } from 'express';
import { MemoryRepository } from '../db/repositories/MemoryRepository.js';
import { RunEventRepository } from '../db/repositories/RunEventRepository.js';
import { RunRepository } from '../db/repositories/RunRepository.js';
import { ScheduleRepository } from '../db/repositories/ScheduleRepository.js';
import {
  cancelRun,
  createRun,
  getStudioBootstrap,
} from './service.js';

const router = Router();
const runRepository = new RunRepository();
const runEventRepository = new RunEventRepository();
const scheduleRepository = new ScheduleRepository();
const memoryRepository = new MemoryRepository();

router.get('/studio/bootstrap', (_req, res) => {
  res.json(getStudioBootstrap());
});

router.get('/studio/runs', (_req, res) => {
  res.json(runRepository.list().map(mapStudioRun));
});

router.post('/studio/runs', (req, res) => {
  const goal = typeof req.body?.goal === 'string' ? req.body.goal.trim() : '';
  if (!goal) {
    res.status(400).json({ error: 'goal is required' });
    return;
  }
  res.status(201).json(createRun(goal));
});

router.get('/studio/runs/:id', (req, res) => {
  const run = runRepository.getById(req.params.id);
  if (!run) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }
  res.json({
    run: mapStudioRun(run),
    toolCalls: [],
    messages: [],
    events: runEventRepository.listByRunId(req.params.id).map(mapStudioEvent),
    artifacts: [],
  });
});

router.post('/studio/runs/:id/cancel', (req, res) => {
  const run = cancelRun(req.params.id);
  if (!run) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }
  res.json(run);
});

router.get('/studio/runs/:id/events', (req, res) => {
  res.json(runEventRepository.listByRunId(req.params.id).map(mapStudioEvent));
});

router.get('/studio/schedules', (_req, res) => {
  res.json(scheduleRepository.list().map(mapStudioSchedule));
});

router.patch('/studio/schedules/:id', (req, res) => {
  const current = scheduleRepository.getById(req.params.id);
  if (!current) {
    res.status(404).json({ error: 'Schedule not found' });
    return;
  }

  const schedule = scheduleRepository.upsert({
    id: current.id,
    name: req.body?.name ?? current.name,
    cronExpr: req.body?.cron ?? current.cronExpr,
    timezone: req.body?.timezone ?? current.timezone,
    enabled: req.body?.status ? req.body.status === 'active' : current.enabled,
    runTemplate: current.runTemplate,
    lastRunAt: current.lastRunAt,
    nextRunAt: current.nextRunAt,
  });
  if (!schedule) {
    res.status(404).json({ error: 'Schedule not found' });
    return;
  }
  res.json(mapStudioSchedule(schedule));
});

router.post('/studio/schedules/:id/run-now', (req, res) => {
  const current = scheduleRepository.getById(req.params.id);
  if (!current) {
    res.status(404).json({ error: 'Schedule not found' });
    return;
  }

  const now = new Date().toISOString();
  const schedule = scheduleRepository.upsert({
    id: current.id,
    name: current.name,
    cronExpr: current.cronExpr,
    timezone: current.timezone,
    enabled: current.enabled,
    runTemplate: current.runTemplate,
    lastRunAt: now,
    nextRunAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  res.json(mapStudioSchedule(schedule));
});

router.get('/studio/memory/search', (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  if (!query) {
    res.json([]);
    return;
  }
  res.json(memoryRepository.search(query).map(mapStudioMemory));
});

router.post('/studio/memory/facts', (req, res) => {
  const { title, content, scope } = req.body ?? {};
  res.status(201).json(mapStudioMemory(memoryRepository.create({
    scopeType: 'project',
    scopeId: scope ?? 'default',
    memoryType: 'fact',
    title,
    content,
  })));
});

router.post('/studio/memory/decisions', (req, res) => {
  const { title, content, scope } = req.body ?? {};
  res.status(201).json(mapStudioMemory(memoryRepository.create({
    scopeType: 'project',
    scopeId: scope ?? 'default',
    memoryType: 'decision',
    title,
    content,
  })));
});

router.post('/studio/memory/artifacts', (req, res) => {
  const { title, content, scope } = req.body ?? {};
  res.status(201).json(mapStudioMemory(memoryRepository.create({
    scopeType: 'project',
    scopeId: scope ?? 'default',
    memoryType: 'artifact',
    title,
    content,
  })));
});

export default router;

function mapStudioRun(run: ReturnType<RunRepository['getById']> extends infer T ? Exclude<T, null> : never) {
  return {
    id: run.id,
    sessionId: run.sourceId,
    goal: run.rootGoal,
    agentName: null,
    state: run.status,
    model: typeof run.metadata.model === 'string' ? run.metadata.model : 'runtime',
    startedAt: run.startedAt ?? run.createdAt,
    finishedAt: run.finishedAt,
  };
}

function mapStudioEvent(event: ReturnType<RunEventRepository['listByRunId']>[number]) {
  return {
    id: event.id,
    runId: event.runId,
    sessionId: event.runId,
    type: event.eventType,
    agentName: null,
    payload: JSON.stringify(event.payload),
    createdAt: event.createdAt,
  };
}

function mapStudioSchedule(schedule: ReturnType<ScheduleRepository['list']>[number]) {
  return {
    id: schedule.id,
    name: schedule.name,
    cron: schedule.cronExpr,
    timezone: schedule.timezone,
    jobType: typeof schedule.runTemplate.jobType === 'string' ? schedule.runTemplate.jobType : 'runtime',
    status: schedule.enabled ? 'active' : 'paused',
    lastRunAt: schedule.lastRunAt,
    nextRunAt: schedule.nextRunAt,
  };
}

function mapStudioMemory(entry: ReturnType<MemoryRepository['list']>[number]) {
  return {
    id: entry.id,
    scope: `${entry.scopeType}:${entry.scopeId}`,
    kind: entry.memoryType,
    title: entry.title,
    content: entry.content,
    createdAt: entry.createdAt,
  };
}
