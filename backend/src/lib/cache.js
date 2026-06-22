const memoryCache = new Map();

export function getCache(key) {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

export function setCache(key, value, ttlMs = 30000) {
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

