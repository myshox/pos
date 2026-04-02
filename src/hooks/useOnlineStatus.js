import { useState, useEffect, useCallback } from 'react';

const SYNC_PENDING_KEY = 'pos_sync_pending';
const LAST_SYNC_KEY = 'pos_last_sync_at';

function getPendingFlag() {
  try { return localStorage.getItem(SYNC_PENDING_KEY) === '1'; } catch { /* empty */ }
  return false;
}

function setPendingFlag(v) {
  try { localStorage.setItem(SYNC_PENDING_KEY, v ? '1' : '0'); } catch { /* empty */ }
}

function getLastSyncAt() {
  try {
    const v = localStorage.getItem(LAST_SYNC_KEY);
    return v ? Number(v) : 0;
  } catch { /* empty */ }
  return 0;
}

function setLastSyncAt(ts) {
  try { localStorage.setItem(LAST_SYNC_KEY, String(ts)); } catch { /* empty */ }
}

export default function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [hasPendingSync, setHasPendingSync] = useState(() => getPendingFlag());
  const [lastSyncAt, setLastSyncAtState] = useState(() => getLastSyncAt());

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const markPending = useCallback(() => {
    setPendingFlag(true);
    setHasPendingSync(true);
  }, []);

  const markSynced = useCallback(() => {
    const now = Date.now();
    setPendingFlag(false);
    setLastSyncAt(now);
    setHasPendingSync(false);
    setLastSyncAtState(now);
  }, []);

  return { isOnline, hasPendingSync, lastSyncAt, markPending, markSynced };
}
