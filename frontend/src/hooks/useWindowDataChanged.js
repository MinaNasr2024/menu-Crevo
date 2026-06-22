import { useEffect, useRef } from 'react';
import { isLiveSyncKey } from '../lib/liveSync';

export function useWindowDataChanged(handler, enabled = true) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) return undefined;
    const listener = () => handlerRef.current?.();
    const storageListener = (event) => {
      if (!isLiveSyncKey(event?.key)) return;
      handlerRef.current?.();
    };
    window.addEventListener('crevo:data-changed', listener);
    window.addEventListener('storage', storageListener);
    return () => {
      window.removeEventListener('crevo:data-changed', listener);
      window.removeEventListener('storage', storageListener);
    };
  }, [enabled]);
}
