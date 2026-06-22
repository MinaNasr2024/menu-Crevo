import { pbkdf2 as pbkdf2Callback, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const pbkdf2 = promisify(pbkdf2Callback);
const ITERATIONS = 120000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
  return `pbkdf2$${ITERATIONS}$${salt}$${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password, storedHash) {
  if (!storedHash || !String(storedHash).startsWith('pbkdf2$')) return false;
  const [, iterationsStr, salt, hash] = String(storedHash).split('$');
  const derivedKey = await pbkdf2(password, salt, Number(iterationsStr), KEY_LENGTH, DIGEST);
  const hashBuffer = Buffer.from(hash, 'hex');
  if (hashBuffer.length !== derivedKey.length) return false;
  return timingSafeEqual(hashBuffer, derivedKey);
}
