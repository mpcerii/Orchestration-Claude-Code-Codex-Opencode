/**
 * Memory Routes - Endpunkte für Memory-Verwaltung
 * Nutzt explizite DTOs und Validierung
 */

import { Router } from 'express';
import { MemoryRepository } from '../../db/repositories/MemoryRepository.js';
import { mapStudioMemory } from '../mappers/index.js';
import {
  isValidCreateMemoryRequest,
  isValidSearchQueryRequest,
  createErrorResponse,
} from '../validation.js';

const router = Router();
const memoryRepository = new MemoryRepository();

// GET /studio/memory/search - Memory durchsuchen
router.get('/search', (req, res) => {
  const queryObj = req.query as Record<string, unknown>;
  
  if (!isValidSearchQueryRequest(queryObj)) {
    res.json([]);
    return;
  }
  
  const query = queryObj.q.trim();
  const results = memoryRepository.search(query).map(mapStudioMemory);
  res.json(results);
});

// POST /studio/memory/facts - Fakt erstellen
router.post('/facts', (req, res) => {
  if (!isValidCreateMemoryRequest(req.body)) {
    res.status(400).json(createErrorResponse('title and content are required'));
    return;
  }

  const { title, content, scope } = req.body;
  const entry = memoryRepository.create({
    scopeType: 'project',
    scopeId: scope ?? 'default',
    memoryType: 'fact',
    title,
    content,
  });

  res.status(201).json(mapStudioMemory(entry));
});

// POST /studio/memory/decisions - Entscheidung erstellen
router.post('/decisions', (req, res) => {
  if (!isValidCreateMemoryRequest(req.body)) {
    res.status(400).json(createErrorResponse('title and content are required'));
    return;
  }

  const { title, content, scope } = req.body;
  const entry = memoryRepository.create({
    scopeType: 'project',
    scopeId: scope ?? 'default',
    memoryType: 'decision',
    title,
    content,
  });

  res.status(201).json(mapStudioMemory(entry));
});

// POST /studio/memory/artifacts - Artefakt erstellen
router.post('/artifacts', (req, res) => {
  if (!isValidCreateMemoryRequest(req.body)) {
    res.status(400).json(createErrorResponse('title and content are required'));
    return;
  }

  const { title, content, scope } = req.body;
  const entry = memoryRepository.create({
    scopeType: 'project',
    scopeId: scope ?? 'default',
    memoryType: 'artifact',
    title,
    content,
  });

  res.status(201).json(mapStudioMemory(entry));
});

export default router;
