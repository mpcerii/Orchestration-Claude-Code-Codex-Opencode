/**
 * Studio Request Validators
 * Exakte Validierung für Request-Bodies
 */

import type {
  CreateRunRequest,
  CreateScheduleRequest,
  UpdateScheduleRequest,
  CreateMemoryRequest,
  SearchQueryRequest,
  StudioErrorDto,
} from './dtos.js';

export function isValidCreateRunRequest(body: unknown): body is CreateRunRequest {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as CreateRunRequest).goal === 'string' &&
    (body as CreateRunRequest).goal.trim().length > 0
  );
}

export function isValidCreateScheduleRequest(body: unknown): body is CreateScheduleRequest {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as CreateScheduleRequest).name === 'string' &&
    (body as CreateScheduleRequest).name.trim().length > 0 &&
    typeof (body as CreateScheduleRequest).cron === 'string' &&
    (body as CreateScheduleRequest).cron.trim().length > 0
  );
}

export function isValidUpdateScheduleRequest(body: unknown): body is UpdateScheduleRequest {
  if (typeof body !== 'object' || body === null) return false;
  
  const req = body as UpdateScheduleRequest;
  
  // Mindestens ein Feld muss vorhanden sein
  const hasValidField =
    (typeof req.name === 'string' && req.name.trim().length > 0) ||
    (typeof req.cron === 'string' && req.cron.trim().length > 0) ||
    typeof req.timezone === 'string' ||
    typeof req.jobType === 'string' ||
    typeof req.goal === 'string' ||
    typeof req.sourceType === 'string' ||
    typeof req.sourceId === 'string' ||
    typeof req.status === 'string';
  
  return hasValidField;
}

export function isValidCreateMemoryRequest(body: unknown): body is CreateMemoryRequest {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as CreateMemoryRequest).title === 'string' &&
    (body as CreateMemoryRequest).title.trim().length > 0 &&
    typeof (body as CreateMemoryRequest).content === 'string' &&
    (body as CreateMemoryRequest).content.trim().length > 0
  );
}

export function isValidSearchQueryRequest(query: unknown): query is SearchQueryRequest {
  return (
    typeof query === 'object' &&
    query !== null &&
    typeof (query as SearchQueryRequest).q === 'string' &&
    (query as SearchQueryRequest).q.trim().length > 0
  );
}

export function createErrorResponse(message: string, status: number = 400): StudioErrorDto {
  return { error: message };
}

export function validateIdParam(param: unknown): string | null {
  if (typeof param !== 'string' || param.trim().length === 0) {
    return 'Invalid ID parameter';
  }
  return null;
}