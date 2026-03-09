/**
 * Runs Routes - Endpunkte für Run-Verwaltung
 */

import { Router } from 'express';
import { RunRepository } from '../../db/repositories/RunRepository.js';
import { RunEventRepository } from '../../db/repositories/RunEventRepository.js';
import { mapStudioRun, mapStudioEvent } from '../mappers/index.js';
import { createRun, cancelRun } from '../service.js';

const router = Router();
const runRepository = new RunRepository();
const runEventRepository = new RunEventRepository();

// GET /studio/runs - Liste aller Runs
router.get('/', (_req, res) => {
  res.json(runRepository.list().map(mapStudioRun));
});

// POST /studio/runs - Neuen Run erstellen
router.post('/', (req, res) => {
  const goal = typeof req.body?.goal === 'string' ? req.body.goal.trim() : '';
  if (!goal) {
    res.status(400).json({ error: 'goal is required' });
    return;
  }
  res.status(201).json(createRun(goal));
});

// GET /studio/runs/:id - Einzelnen Run abrufen
router.get('/:id', (req, res) => {
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

// POST /studio/runs/:id/cancel - Run abbrechen
router.post('/:id/cancel', (req, res) => {
  const run = cancelRun(req.params.id);
  if (!run) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }
  res.json(run);
});

export default router;
