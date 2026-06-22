const LIVE_SYNC_KEY = 'crevo-live-sync';

export function notifyLiveChange(payload = null) {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crevo:data-changed', { detail: payload }));
    }
  } catch {
    // Ignore local event dispatch failures.
  }

  try {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      window.localStorage.setItem(
        LIVE_SYNC_KEY,
        JSON.stringify({
          at: Date.now(),
          payload
        })
      );
    }
  } catch {
    // Ignore storage failures.
  }
}

export function isLiveSyncKey(key) {
  return key === LIVE_SYNC_KEY;
}
