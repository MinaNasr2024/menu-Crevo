import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';

const TableSessionContext = createContext(null);

function phoneStorageKey(uuid) {
  return uuid ? `crevo-table-phone:${uuid}` : '';
}

export function TableSessionProvider({ children }) {
  const location = useLocation();
  const [tableUuid, setTableUuid] = useState(() => new URLSearchParams(window.location.search).get('table'));
  const [tableSession, setTableSession] = useState(() => new URLSearchParams(window.location.search).get('session'));
  const [table, setTable] = useState(null);
  const [verified, setVerified] = useState(false);
  const [needsPhone, setNeedsPhone] = useState(false);
  const [loading, setLoading] = useState(Boolean(tableUuid));
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextTable = params.get('table');
    const nextSession = params.get('session');
    setTableUuid(nextTable);
    setTableSession(nextSession);
  }, [location.search]);

  useEffect(() => {
    let active = true;
    let expireTimer = null;
    async function verify() {
      setError('');
      if (!tableUuid) {
        setVerified(false);
        setTable(null);
        setNeedsPhone(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        if (!tableSession) {
          throw new Error('Missing QR session');
        }
        const result = await api.resolveTable(tableUuid, tableSession);
        if (!active) return;
        setTable(result);

        const storedPhone = window.localStorage.getItem(phoneStorageKey(tableUuid)) ?? '';
        if (result.currentPhone && storedPhone && result.currentPhone === storedPhone) {
          setVerified(true);
          setNeedsPhone(false);
          setError('');
        } else if (!result.currentPhone) {
          setVerified(false);
          setNeedsPhone(true);
          setError('');
        } else if (storedPhone) {
          setVerified(false);
          setNeedsPhone(true);
          setError('الرجاء كتابة الرقم المفتوح به الطاولة');
        } else {
          setVerified(false);
          setNeedsPhone(true);
          setError('الرجاء كتابة الرقم المفتوح به الطاولة');
        }
      } catch (resolveError) {
        if (!active) return;
        setTable(null);
        setVerified(false);
        setNeedsPhone(false);
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
  }, [tableUuid, tableSession]);

  async function submitPhone(phone) {
    if (!tableUuid) throw new Error('Missing table QR');
    if (!tableSession) throw new Error('Missing QR session');
    const normalizedPhone = String(phone ?? '').trim();
    if (!normalizedPhone) throw new Error('Phone number is required');
    const result = await api.openTable({ uuid: tableUuid, phone: normalizedPhone, session: tableSession });
    window.localStorage.setItem(phoneStorageKey(tableUuid), normalizedPhone);
    setTable(result);
    setVerified(true);
    setNeedsPhone(false);
    setError('');
    return result;
  }

  async function closeCurrentTable() {
    if (!tableUuid) return null;
    const storedPhone = window.localStorage.getItem(phoneStorageKey(tableUuid)) ?? '';
    if (!storedPhone) throw new Error('Phone number is required');
    if (!tableSession) throw new Error('Missing QR session');
    const result = await api.closeTable({ uuid: tableUuid, phone: storedPhone, session: tableSession });
    window.localStorage.removeItem(phoneStorageKey(tableUuid));
    const nextSession = result.sessionUuid ?? tableSession;
    window.history.replaceState({}, '', `${window.location.pathname}?table=${result.qrCodeUuid}&session=${nextSession}${window.location.hash}`);
    setTableUuid(result.qrCodeUuid);
    setTableSession(nextSession);
    setTable(result);
    setVerified(false);
    setNeedsPhone(true);
    return result;
  }

  const value = useMemo(() => ({
    tableUuid,
    tableSession,
    table,
    verified,
    loading,
    needsPhone,
    error,
    submitPhone,
    closeCurrentTable
  }), [tableUuid, tableSession, table, verified, loading, needsPhone, error]);

  return <TableSessionContext.Provider value={value}>{children}</TableSessionContext.Provider>;
}

export function useTableSession() {
  const context = useContext(TableSessionContext);
  if (!context) throw new Error('useTableSession must be used inside TableSessionProvider');
  return context;
}
