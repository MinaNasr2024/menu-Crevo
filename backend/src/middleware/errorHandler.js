import { sendError } from '../lib/http.js';

export function errorHandler(err, _req, res, _next) {
  console.error(err);
  if (err?.name === 'ZodError') {
    return sendError(res, 400, 'Validation failed', err.flatten());
  }
  if (err?.code === 'P2002') {
    return sendError(res, 409, 'Duplicate record');
  }
  if (err?.code === 'P2025') {
    return sendError(res, 404, 'Record not found');
  }
  return sendError(res, 500, 'Internal server error');
}
