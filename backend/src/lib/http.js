export function sendOk(res, data = null) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  return res.json({ success: true, data });
}

export function sendError(res, status, message, details = undefined) {
  return res.status(status).json({
    success: false,
    error: { message, ...(details ? { details } : {}) }
  });
}

export function notFound(res, message = 'Not found') {
  return sendError(res, 404, message);
}
