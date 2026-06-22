import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('../frontend/dist/', import.meta.url));
const host = '127.0.0.1';
const port = 5173;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

function safeJoin(base, target) {
  const resolved = normalize(join(base, target));
  if (!resolved.startsWith(base)) {
    return null;
  }
  return resolved;
}

async function readAsset(filePath) {
  const type = mimeTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
  const body = await readFile(filePath);
  return { type, body };
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? `${host}:${port}`}`);
    let pathname = decodeURIComponent(url.pathname);

    if (pathname === '/') {
      pathname = '/index.html';
    }

    const assetPath = safeJoin(rootDir, pathname);
    const candidatePath = assetPath && existsSync(assetPath) && statSync(assetPath).isFile()
      ? assetPath
      : join(rootDir, 'index.html');

    const { type, body } = await readAsset(candidatePath);
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(body);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(String(error?.message ?? error));
  }
});

server.listen(port, host, () => {
  console.log(`Frontend preview server running at http://${host}:${port}`);
});
