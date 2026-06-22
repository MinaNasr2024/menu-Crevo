import { randomUUID } from 'node:crypto';

export function createQrUuid() {
  return randomUUID();
}
