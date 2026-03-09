/**
 * Runs Routes - Endpunkte für Run-Verwaltung
 * Nutzt explizite DTOs und Validierung
 */

import { Router } from 'express';
import { RunRepository } from '../../db/repositories/RunRepository.js';
import { RunEventRepository } from '../../db/repositories/RunEventRepository.js';
import { mapStudioRun, mapStudioEvent } from '../mappers/index.js';
import { createRun, cancelRun } from '../service.js';
import { isValidCreateRunRequest, validateIdParam, createErrorResponse } from '../validation.js';
import type { StudioRunDetailDto, StudioRunDto } from '../dtos.js';

const router = Router();
const runRepository = new RunRepository();
const runEventRepository = new RunEventRepository();

// GET /studio/runs - Liste aller Runs
router.get('/', (_req, res) => {
  const runs = runRepository.list().map(mapStudioRun);
  res.json(runs);
});

// POST /studio/runs - Neuen Run erstellen
router.post('/', (req, res) => {
  if (!isValidCreateRunRequest(req.body)) {
    res.status(400).json(createErrorResponse('goal is required'));
    return;
  }
  
  const goal = req.body.goal.trim();
  const result = createRun(goal);
  res.status(201).json(result);
});

// GET /studio/runs/:id - Einzelnen Run abrufen
router.get('/:id', (req, res) => {
  const idError = validateIdParam(req.params.id);
  if (idError) {
    res.status(400).json(createErrorResponse(idError));
    return;
  }
  
  const run = runRepository.getById(req.params.id);
  if (!run) {
    res.status(404).json(createErrorResponse('Run not found'));
    return;
  }
  
  const events = runEventRepository.listByRunId(req.params.id).map(mapStudioEvent);
  
  const detail: StudioRunDetailDto = {
    run: mapStudioRun(run),
    toolCalls: [],
    messages: [],
    events,
    artifacts: [],
  };
  
  res.json(detail);
});

// POST /studio/runs/:id/cancel - Run abbrechen
router.post('/:id/cancel', (req, res) => {
  const idError = validateIdParam(req.params.id);
  if (idError) {
    res.status(400).json(createErrorResponse(idError));
    return;
  }
  
  const run = cancelRun(req.params.id);
  if (!run) {
    res.status(404).json(createErrorResponse('Run not found'));
    return;
  }
  
  res.json(run);
});

export default router;
