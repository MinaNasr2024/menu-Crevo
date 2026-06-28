import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';

const TableSessionContext = createContext(null);
const tablePhoneMemory = {};

function getPhoneStore() {
  try {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

function phoneStorageKey(uuid) {
  return uuid ? `crevo-table-phone:${uuid}` : '';
}

function normalizePhoneInput(value) {
  const digits = {
    '٠': '0',
    '١': '1',
    '٢': '2',
    '٣': '3',
    '٤': '4',
    '٥': '5',
    '٦': '6',
    '٧': '7',
    '٨': '8',
    '٩': '9'
  };

  return String(value ?? '')
    .trim()
    .replace(/[٠-٩]/g, (digit) => digits[digit] ?? '')
    .replace(/[^\d]/g, '');
}

function normalizeSessionValue(value) {
  const session = String(value ?? '').trim();
  if (!session || session === 'null' || session === 'undefined') return '';
  return session;
}

export function TableSessionProvider({ children }) {
  try {
    if (typeof window !== 'undefined') {
      window.__crevoTableSessionProviderRendered = true;
    }
  } catch {
    // Ignore debug failures.
  }

  const location = useLocation();
  const [tableUuid, setTableUuid] = useState(() => new URLSearchParams(window.location.search).get('table'));
  const [tableSession, setTableSession] = useState(() => normalizeSessionValue(new URLSearchParams(window.location.search).get('session')));
  const [table, setTable] = useState(null);
  const [verified, setVerified] = useState(false);
  const [needsPhone, setNeedsPhone] = useState(false);
  const [phonePrompt, setPhonePrompt] = useState('الرجاء إدخال رقم الهاتف لفتح الطاولة');
  const [loading, setLoading] = useState(Boolean(tableUuid));
  const [error, setError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  function readPhone(uuid) {
    const key = phoneStorageKey(uuid);
    if (!key) return '';
    const store = getPhoneStore();
    if (store) {
      try {
        return store.getItem(key) ?? '';
      } catch {
        return tablePhoneMemory[key] ?? '';
      }
    }
    return tablePhoneMemory[key] ?? '';
  }

  function writePhone(uuid, phone) {
    const key = phoneStorageKey(uuid);
    if (!key) return;
    const store = getPhoneStore();
    tablePhoneMemory[key] = phone;
    try {
      store?.setItem(key, phone);
    } catch {
      // Ignore storage failures.
    }
  }

  function removePhone(uuid) {
    const key = phoneStorageKey(uuid);
    if (!key) return;
    const store = getPhoneStore();
    delete tablePhoneMemory[key];
    try {
      store?.removeItem(key);
    } catch {
      // Ignore storage failures.
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextTable = params.get('table');
    const nextSession = normalizeSessionValue(params.get('session'));
    setTableUuid(nextTable);
    setTableSession(nextSession);
  }, [location.search]);

  useRealtimeRefresh(() => {
    setRefreshTick((value) => value + 1);
  }, { enabled: Boolean(tableUuid), pollIntervalMs: 0, events: ['data:changed'] });

  useEffect(() => {
    let active = true;
    let expireTimer = null;

    async function verify() {
      setError('');

      if (!tableUuid) {
        setVerified(false);
        setTable(null);
        setNeedsPhone(false);
        setPhonePrompt('الرجاء إدخال رقم الهاتف لفتح الطاولة');
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const result = await api.resolveTable(tableUuid, tableSession).catch(() => null);
        if (!active) return;
        if (!result) {
          throw new Error('جلسة QR غير موجودة');
        }

        setTable(result);
        const resolvedSession = normalizeSessionValue(result.sessionUuid) || tableSession;
        if (resolvedSession && resolvedSession !== tableSession) {
          setTableSession(resolvedSession);
          try {
            const nextParams = new URLSearchParams(location.search);
            nextParams.set('table', tableUuid);
            nextParams.set('session', resolvedSession);
            window.history.replaceState({}, '', `${window.location.pathname}?${nextParams.toString()}${window.location.hash}`);
          } catch {
            // Ignore URL update failures.
          }
        }

        const storedPhone = readPhone(tableUuid);
        if (result.currentPhone && storedPhone && result.currentPhone === storedPhone) {
          setVerified(true);
          setNeedsPhone(false);
          setError('');
          setPhonePrompt('الرجاء إدخال رقم الهاتف لفتح الطاولة');
        } else if (!result.currentPhone) {
          setVerified(false);
          setNeedsPhone(true);
          setPhonePrompt('الرجاء إدخال رقم الهاتف لفتح الطاولة');
          setError('');
        } else if (storedPhone) {
          setVerified(false);
          setNeedsPhone(true);
          setPhonePrompt('الرجاء كتابة الرقم المفتوح به الطاولة');
          setError('الرجاء كتابة الرقم المفتوح به الطاولة');
        } else {
          setVerified(false);
          setNeedsPhone(true);
          setPhonePrompt('الرجاء كتابة الرقم المفتوح به الطاولة');
          setError('الرجاء كتابة الرقم المفتوح به الطاولة');
        }
      } catch (resolveError) {
        if (!active) return;

        setTable(null);
        setVerified(false);
        setNeedsPhone(false);
        setPhonePrompt('الرجاء إدخال رقم الهاتف لفتح الطاولة');
        setError(resolveError.message);

        if (String(resolveError.message ?? '') === 'QR session expired') {
          expireTimer = window.setTimeout(() => {
            if (active) setError('');
          }, 5000);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    verify();
    return () => {
      active = false;
      if (expireTimer) window.clearTimeout(expireTimer);
    };
  }, [tableUuid, tableSession, refreshTick, location.search]);

  async function submitPhone(phone) {
    if (!tableUuid) throw new Error('QR الطاولة غير موجود');

    const normalizedPhone = normalizePhoneInput(phone);
    if (!normalizedPhone) throw new Error('رقم الهاتف مطلوب');
    if (!/^01\d{9}$/.test(normalizedPhone)) {
      throw new Error('رقم الهاتف يجب أن يكون 11 رقم ويبدأ بـ 01');
    }

    console.log('[TableSessionContext] submitPhone -> openTable', {
      tableUuid,
      phone: normalizedPhone
    });
    const result = await api.openTable({
      uuid: tableUuid,
      phone: normalizedPhone
    });
    writePhone(tableUuid, normalizedPhone);
    setTable(result);
    const nextSession = normalizeSessionValue(result?.sessionUuid) || tableSession;
    if (nextSession) {
      setTableSession(nextSession);
    }
    setVerified(true);
    setNeedsPhone(false);
    setPhonePrompt('الرجاء إدخال رقم الهاتف لفتح الطاولة');
    setError('');
    return result;
  }

  async function closeCurrentTable() {
    if (!tableUuid) return null;
    const storedPhone = readPhone(tableUuid) || String(table?.currentPhone ?? '').trim();
    console.log('[TableSessionContext] closeCurrentTable -> closeTable', {
      tableUuid,
      phone: storedPhone || ''
    });
    const result = await api.closeTable({
      uuid: tableUuid,
      ...(storedPhone ? { phone: storedPhone } : {})
    });
    removePhone(tableUuid);

    const nextSession = normalizeSessionValue(result?.sessionUuid) || tableSession;
    if (typeof window !== 'undefined' && result?.qrCodeUuid) {
      window.history.replaceState({}, '', `${window.location.pathname}?table=${result.qrCodeUuid}${nextSession ? `&session=${nextSession}` : ''}${window.location.hash}`);
    }

    setTableUuid(result.qrCodeUuid ?? tableUuid);
    setTableSession(nextSession);
    setTable(result);
    setVerified(false);
    setNeedsPhone(true);
    setPhonePrompt('الرجاء إدخال رقم الهاتف لفتح الطاولة');
    return result;
  }

  const value = useMemo(() => ({
    tableUuid,
    tableSession,
    table,
    verified,
    loading,
    needsPhone,
    phonePrompt,
    error,
    submitPhone,
    closeCurrentTable
  }), [tableUuid, tableSession, table, verified, loading, needsPhone, phonePrompt, error]);

  return <TableSessionContext.Provider value={value}>{children}</TableSessionContext.Provider>;
}

export function useTableSession() {
  const context = useContext(TableSessionContext);
  if (!context) throw new Error('useTableSession must be used inside TableSessionProvider');
  return context;
}
