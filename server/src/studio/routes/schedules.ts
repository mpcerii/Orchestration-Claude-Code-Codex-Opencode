/**
 * Schedules Routes - Endpunkte für Schedule-Verwaltung
 */

import { Router } from 'express';
import { ScheduleRepository } from '../../db/repositories/ScheduleRepository.js';
import { ScheduleRunRepository } from '../../db/repositories/ScheduleRunRepository.js';
import { schedulerEngine } from '../../core/scheduler/SchedulerEngine.js';
import { mapStudioSchedule, mapStudioScheduleRun } from '../mappers/index.js';

const router = Router();
const scheduleRepository = new ScheduleRepository();
const scheduleRunRepository = new ScheduleRunRepository();

// GET /studio/schedules - Liste aller Schedules
router.get('/', (_req, res) => {
  res.json(scheduleRepository.list().map(mapStudioSchedule));
});

// POST /studio/schedules - Neuen Schedule erstellen
router.post('/', (req, res) => {
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

// PATCH /studio/schedules/:id - Schedule aktualisieren
router.patch('/:id', (req, res) => {
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

// POST /studio/schedules/:id/run-now - Schedule manuell ausführen
router.post('/:id/run-now', async (req, res) => {
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

// GET /studio/schedules/:id/history - Verlauf eines Schedules abrufen
router.get('/:id/history', (req, res) => {
  const schedule = scheduleRepository.getById(req.params.id);
  if (!schedule) {
    res.status(404).json({ error: 'Schedule not found' });
    return;
  }

  res.json(scheduleRunRepository.listByScheduleId(req.params.id).map(mapStudioScheduleRun));
});

export default router;
