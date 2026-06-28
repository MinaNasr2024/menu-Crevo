import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../../uploads');

export async function ensureUploadsDir() {
  await fs.mkdir(uploadsDir, { recursive: true });
  return uploadsDir;
}

function extensionFromMime(mimeType = '') {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('quicktime')) return 'mov';
  return 'bin';
}

export async function saveDataUrl(dataUrl) {
  const match = String(dataUrl).match(/^data:(.+?);base64,(.+)$/);
  if (!match) throw new Error('Invalid upload data');
  const mimeType = match[1];
  const base64 = match[2];
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.byteLength > 10 * 1024 * 1024) {
    throw new Error('Upload must be 10MB or smaller');
  }
  const ext = extensionFromMime(mimeType);
  const fileName = `${randomUUID()}.${ext}`;
  await ensureUploadsDir();
  const filePath = path.join(uploadsDir, fileName);
  await fs.writeFile(filePath, buffer);
  return {
    fileName,
    url: `/uploads/${fileName}`,
    mimeType
  };
}
