import crypto from 'node:crypto';
import { sendError } from '../lib/http.js';

const DEFAULT_ADMIN_TOKEN = 'change-me-in-production';

function getSecret() {
  return process.env.ADMIN_TOKEN ?? DEFAULT_ADMIN_TOKEN;
}

function normalizeRole(role) {
  return role === 'cashier' ? 'seller' : role;
}

function signBody(body) {
  return crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
}

export function issueAdminToken(payload = {}) {
  const normalized = {
    ...payload,
    role: normalizeRole(payload.role) ?? 'admin',
    issuedAt: new Date().toISOString()
  };
  const body = Buffer.from(JSON.stringify(normalized)).toString('base64url');
  return `${body}.${signBody(body)}`;
}

export function parseAdminToken(token) {
  if (!token || typeof token !== 'string') return null;
  const secret = getSecret();
  if (token === secret) {
    return { role: 'admin', type: 'admin', legacy: true };
  }
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expected = signBody(body);
  if (expected.length !== signature.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return {
      ...payload,
      role: normalizeRole(payload.role) ?? 'admin'
    };
  } catch {
    return null;
  }
}

export function requireAdminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  const auth = parseAdminToken(token);
  if (!auth) {
    return sendError(res, 401, 'Admin authentication required');
  }
  req.auth = auth;
  next();
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!roles.length) return next();
    const role = normalizeRole(req.auth?.role);
    if (!role || !roles.includes(role)) {
      return sendError(res, 403, 'Permission denied');
    }
    return next();
  };
}
