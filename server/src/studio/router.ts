import { Router } from 'express';
import { MemoryRepository } from '../db/repositories/MemoryRepository.js';
import { RunEventRepository } from '../db/repositories/RunEventRepository.js';
import { RunRepository } from '../db/repositories/RunRepository.js';
import { ScheduleRepository } from '../db/repositories/ScheduleRepository.js';
import { ScheduleRunRepository } from '../db/repositories/ScheduleRunRepository.js';
import { schedulerEngine } from '../core/scheduler/SchedulerEngine.js';
import type {
  StudioRunInput,
  StudioEventInput,
  StudioScheduleInput,
  StudioMemoryInput,
  StudioScheduleRunInput,
} from './dtos.js';
import {
  cancelRun,
  createRun,
  getStudioBootstrap,
} from './service.js';
const router = Router();
const runRepository = new RunRepository();
const runEventRepository = new RunEventRepository();
const scheduleRepository = new ScheduleRepository();
const scheduleRunRepository = new ScheduleRunRepository();
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

router.post('/studio/schedules', (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const cronExpr = typeof req.body?.cron === 'string' ? req.body.cron.trim() : '';
  const timezone = typeof req.body?.timezone === 'string' ? req.body.timezone.trim() : 'UTC';
  const goal = typeof req.body?.goal === 'string' ? req.body.goal.trim() : name;
  const jobType = typeof req.body?.jobType === 'string' ? req.body.jobType.trim() : 'runtime';
  const sourceType = req.body?.sourceType === 'task' || req.body?.sourceType === 'swarm' ? req.body.sourceType : undefined;
  const sourceId = typeof req.body?.sourceId === 'string' ? req.body.sourceId.trim() : undefined;
  const enabled = req.body?.status ? req.body.status === 'active' : Boolean(req.body?.enabled ?? true);

  if (!name || !cronExpr) {
    res.status(400).json({ error: 'name and cron are required' });
    return;
  }

  const schedule = scheduleRepository.upsert({
    name,
    cronExpr,
    timezone,
    enabled,
    runTemplate: {
      jobType,
      goal,
      sourceType,
      sourceId,
    },
    nextRunAt: null,
  });

  res.status(201).json(mapStudioSchedule(schedule));
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
    runTemplate: {
      ...current.runTemplate,
      ...(typeof req.body?.jobType === 'string' ? { jobType: req.body.jobType } : {}),
      ...(typeof req.body?.goal === 'string' ? { goal: req.body.goal } : {}),
      ...(req.body?.sourceType === 'task' || req.body?.sourceType === 'swarm' ? { sourceType: req.body.sourceType } : {}),
      ...(typeof req.body?.sourceId === 'string' ? { sourceId: req.body.sourceId } : {}),
    },
    lastRunAt: current.lastRunAt,
    nextRunAt: req.body?.cron && req.body.cron !== current.cronExpr ? null : current.nextRunAt,
  });
  if (!schedule) {
    res.status(404).json({ error: 'Schedule not found' });
    return;
  }
  res.json(mapStudioSchedule(schedule));
});

router.post('/studio/schedules/:id/run-now', async (req, res) => {
  if (!schedulerEngine) {
    res.status(503).json({ error: 'Scheduler is not initialized' });
    return;
  }

  try {
    const result = await schedulerEngine.runNow(req.params.id);
    if (result.status >= 400) {
      res.status(result.status).json(result.body);
      return;
    }

    const updated = scheduleRepository.getById(req.params.id);
    res.json(updated ? mapStudioSchedule(updated) : result.body);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to start schedule' });
  }
});

router.get('/studio/schedules/:id/history', (req, res) => {
  const schedule = scheduleRepository.getById(req.params.id);
  if (!schedule) {
    res.status(404).json({ error: 'Schedule not found' });
    return;
  }

  res.json(scheduleRunRepository.listByScheduleId(req.params.id).map(mapStudioScheduleRun));
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

function mapStudioRun(run: StudioRunInput) {
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

function mapStudioEvent(event: StudioEventInput) {
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

function mapStudioSchedule(schedule: StudioScheduleInput) {
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

function mapStudioMemory(entry: StudioMemoryInput) {
  return {
    id: entry.id,
    scope: `${entry.scopeType}:${entry.scopeId}`,
    kind: entry.memoryType,
    title: entry.title,
    content: entry.content,
    createdAt: entry.createdAt,
  };
}

function mapStudioScheduleRun(entry: StudioScheduleRunInput) {
  return {
    id: entry.id,
    scheduleId: entry.scheduleId,
    runId: entry.runId,
    status: entry.status,
    startedAt: entry.startedAt,
    finishedAt: entry.finishedAt,
    error: entry.error,
  };
}
