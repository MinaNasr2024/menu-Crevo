import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { getApiBase, getSocketBase } from '../lib/api';
import { isLiveSyncKey } from '../lib/liveSync';

export function useRealtimeRefresh(onChange, options = {}) {
  const {
    enabled = true,
    events = ['data:changed'],
    joinAdmin = false,
    pollIntervalMs = 0
  } = options;
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!enabled) return undefined;
    let mounted = true;
    let socket = null;
    let pollTimer = null;

    const trigger = () => {
      if (!mounted) return;
      onChangeRef.current?.();
    };

    const handleWindowEvent = () => trigger();
    const handleStorageEvent = (event) => {
      if (!isLiveSyncKey(event?.key)) return;
      trigger();
    };
    window.addEventListener('crevo:data-changed', handleWindowEvent);
    window.addEventListener('storage', handleStorageEvent);

    try {
      socket = io(getSocketBase() || getApiBase());
      for (const eventName of events) {
        socket.on(eventName, trigger);
      }
      if (joinAdmin) {
        socket.emit('join:admin');
      }
    } catch {
      socket = null;
    }

    if (pollIntervalMs > 0) {
      pollTimer = window.setInterval(trigger, pollIntervalMs);
    }

    return () => {
      mounted = false;
      window.removeEventListener('crevo:data-changed', handleWindowEvent);
      window.removeEventListener('storage', handleStorageEvent);
      if (pollTimer) window.clearInterval(pollTimer);
      socket?.disconnect();
    };
  }, [enabled, events, joinAdmin, pollIntervalMs]);
}
