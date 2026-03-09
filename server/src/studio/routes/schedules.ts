/**
 * Schedules Routes - Endpunkte für Schedule-Verwaltung
 * Nutzt explizite DTOs und Validierung
 */

import { Router } from 'express';
import { ScheduleRepository } from '../../db/repositories/ScheduleRepository.js';
import { ScheduleRunRepository } from '../../db/repositories/ScheduleRunRepository.js';
import { schedulerEngine } from '../../core/scheduler/SchedulerEngine.js';
import { mapStudioSchedule, mapStudioScheduleRun } from '../mappers/index.js';
import {
  isValidCreateScheduleRequest,
  isValidUpdateScheduleRequest,
  validateIdParam,
  createErrorResponse,
} from '../validation.js';

const router = Router();
const scheduleRepository = new ScheduleRepository();
const scheduleRunRepository = new ScheduleRunRepository();

// GET /studio/schedules - Liste aller Schedules
router.get('/', (_req, res) => {
  const schedules = scheduleRepository.list().map(mapStudioSchedule);
  res.json(schedules);
});

// POST /studio/schedules - Neuen Schedule erstellen
router.post('/', (req, res) => {
  if (!isValidCreateScheduleRequest(req.body)) {
    res.status(400).json(createErrorResponse('name and cron are required'));
    return;
  }

  const { name, cron, timezone, goal, jobType, sourceType, sourceId, status, enabled } = req.body;

  const schedule = scheduleRepository.upsert({
    name: name.trim(),
    cronExpr: cron.trim(),
    timezone: timezone?.trim() ?? 'UTC',
    enabled: status ? status === 'active' : (enabled ?? true),
    runTemplate: {
      jobType: jobType?.trim() ?? 'runtime',
      goal: goal?.trim() ?? name,
      sourceType,
      sourceId,
    },
    nextRunAt: null,
  });

  res.status(201).json(mapStudioSchedule(schedule));
});

// PATCH /studio/schedules/:id - Schedule aktualisieren
router.patch('/:id', (req, res) => {
  const idError = validateIdParam(req.params.id);
  if (idError) {
    res.status(400).json(createErrorResponse(idError));
    return;
  }

  if (!isValidUpdateScheduleRequest(req.body)) {
    res.status(400).json(createErrorResponse('At least one valid field is required'));
    return;
  }

  const current = scheduleRepository.getById(req.params.id);
  if (!current) {
    res.status(404).json(createErrorResponse('Schedule not found'));
    return;
  }

  const updates = req.body;
  const schedule = scheduleRepository.upsert({
    id: current.id,
    name: updates.name?.trim() ?? current.name,
    cronExpr: updates.cron?.trim() ?? current.cronExpr,
    timezone: updates.timezone?.trim() ?? current.timezone,
    enabled: updates.status ? updates.status === 'active' : current.enabled,
    runTemplate: {
      ...current.runTemplate,
      ...(updates.jobType ? { jobType: updates.jobType.trim() } : {}),
      ...(updates.goal ? { goal: updates.goal.trim() } : {}),
      ...(updates.sourceType ? { sourceType: updates.sourceType } : {}),
      ...(updates.sourceId ? { sourceId: updates.sourceId.trim() } : {}),
    },
    lastRunAt: current.lastRunAt,
    nextRunAt: updates.cron && updates.cron !== current.cronExpr ? null : current.nextRunAt,
  });

  if (!schedule) {
    res.status(404).json(createErrorResponse('Schedule not found'));
    return;
  }
  
  res.json(mapStudioSchedule(schedule));
});

// POST /studio/schedules/:id/run-now - Schedule manuell ausführen
router.post('/:id/run-now', async (req, res) => {
  const idError = validateIdParam(req.params.id);
  if (idError) {
    res.status(400).json(createErrorResponse(idError));
    return;
  }

  if (!schedulerEngine) {
    res.status(503).json(createErrorResponse('Scheduler is not initialized'));
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
    const message = error instanceof Error ? error.message : 'Failed to start schedule';
    res.status(500).json(createErrorResponse(message));
  }
});

// GET /studio/schedules/:id/history - Verlauf eines Schedules abrufen
router.get('/:id/history', (req, res) => {
  const idError = validateIdParam(req.params.id);
  if (idError) {
    res.status(400).json(createErrorResponse(idError));
    return;
  }

  const schedule = scheduleRepository.getById(req.params.id);
  if (!schedule) {
    res.status(404).json(createErrorResponse('Schedule not found'));
    return;
  }

  const history = scheduleRunRepository.listByScheduleId(req.params.id).map(mapStudioScheduleRun);
  res.json(history);
});

export default router;
