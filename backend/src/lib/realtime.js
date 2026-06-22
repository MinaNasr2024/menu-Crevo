export function emitDataChanged(io, payload = {}) {
  if (!io) return;
  io.emit('data:changed', {
    at: new Date().toISOString(),
    ...payload
  });
}
