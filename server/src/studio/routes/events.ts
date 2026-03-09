/**
 * Events Routes - Endpunkte für Event-Verwaltung
 * Nutzt explizite DTOs und Validierung
 */

import { Router } from 'express';
import { RunEventRepository } from '../../db/repositories/RunEventRepository.js';
import { mapStudioEvent } from '../mappers/index.js';
import { validateIdParam, createErrorResponse } from '../validation.js';

const router = Router({ mergeParams: true });
const runEventRepository = new RunEventRepository();

// GET /studio/runs/:id/events - Events eines Runs abrufen
router.get('/', (req, res) => {
  const idError = validateIdParam(req.params.id);
  if (idError) {
    res.status(400).json(createErrorResponse(idError));
    return;
  }

  const events = runEventRepository.listByRunId(req.params.id).map(mapStudioEvent);
  res.json(events);
});

export default router;
