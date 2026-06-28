import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin.js';
import { biRouter } from './routes/bi.js';
import { authRouter } from './routes/auth.js';
import { settingsRouter } from './routes/settings.js';
import { offersRouter } from './routes/offers.js';
import { requireAdminAuth, requireRoles } from './middleware/adminAuth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { ensureUploadsDir } from './lib/upload.js';

export function createApp() {
  const app = express();
  const allowedOrigins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173,https://menu.crevo-eg.com,https://api-menu.crevo-eg.com')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  function isCrevoOrigin(origin) {
    return /^https?:\/\/([a-z0-9-]+\.)*crevo-eg\.com(?::\d+)?$/i.test(origin);
  }
  function isAllowedOrigin(origin) {
    if (!origin) return true;
    if (allowedOrigins.includes(origin)) return true;
    if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return true;
    return isCrevoOrigin(origin);
  }
  const backendDir = path.dirname(fileURLToPath(import.meta.url));
  const uploadsDir = path.resolve(backendDir, '../uploads');
  ensureUploadsDir().catch(() => {});

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }));
  app.use(cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true
  }));
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));
  app.use('/uploads', express.static(uploadsDir));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/qr/:uuid', (req, res) => {
    res.redirect(302, `https://menu.crevo-eg.com/menu?table=${encodeURIComponent(req.params.uuid)}`);
  });

  app.use('/api/auth', authRouter);
  app.use('/api/public/site-settings', settingsRouter);
  app.use('/api/public', publicRouter);
  app.use('/api/admin/offers', requireAdminAuth, requireRoles('admin', 'manager'), offersRouter);
  app.use('/api/admin', requireAdminAuth, adminRouter);
  app.use('/api/admin/site-settings', requireAdminAuth, requireRoles('admin'), settingsRouter);
  app.use('/api/bi', requireAdminAuth, requireRoles('admin'), biRouter);

  app.use(errorHandler);
  return app;
}
