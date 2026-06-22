import 'dotenv/config';
import http from 'node:http';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import { ensureUploadsDir } from './lib/upload.js';
import { ensureSchema } from './lib/ensureSchema.js';

const port = Number(process.env.PORT ?? 4006);
const app = createApp();
const server = http.createServer(app);

const socketOrigins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173,https://menu.crevo-eg.com,https://api-menu.crevo-eg.com')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const socketOriginPatterns = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;
const crevoOriginPattern = /^https?:\/\/([a-z0-9-]+\.)*crevo-eg\.com(?::\d+)?$/i;

const io = new Server(server, {
  cors: {
    origin(origin, callback) {
      if (!origin || socketOrigins.includes(origin) || socketOriginPatterns.test(origin) || crevoOriginPattern.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Socket CORS blocked for origin: ${origin}`));
    },
    credentials: true
  }
});

app.set('io', io);

await ensureUploadsDir();
await ensureSchema();

io.on('connection', (socket) => {
  socket.emit('connected', { ok: true });
  socket.on('join:admin', () => socket.join('admin'));
});

server.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
