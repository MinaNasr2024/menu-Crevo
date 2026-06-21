import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getApiBase } from '../lib/api';

function normalizeSessionValue(value) {
  const session = String(value ?? '').trim();
  if (!session || session === 'null' || session === 'undefined') return '';
  return session;
}

function getResolveTableBaseUrl() {
  const apiBase = String(getApiBase() ?? '').trim().replace(/\/+$/, '');
  if (apiBase) return apiBase;
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://127.0.0.1:4006';
    }
    return 'https://api-menu.crevo-eg.com';
  }
  return 'https://api-menu.crevo-eg.com';
}

async function resolveTableDirect(uuid, session) {
  const search = new URLSearchParams();
  search.set('uuid', uuid);
  const normalizedSession = normalizeSessionValue(session);
  if (normalizedSession) search.set('session', normalizedSession);

  const url = `${getResolveTableBaseUrl()}/api/public/table/resolve?${search.toString()}`;
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json'
    }
  });

  const responseText = await response.text().catch(() => '');
  let payload = {};
  if (responseText.trim()) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = { raw: responseText };
    }
  }

  if (!response.ok) {
    const message = typeof payload === 'object' && payload
      ? payload?.error?.message
      : String(payload || `Request failed: ${response.status}`);
    const error = new Error(message || `Request failed: ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  if (payload?.success === false) {
    const error = new Error(payload?.error?.message ?? `Request failed: ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload?.data ?? (payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null);
}

export function TableEntryPage() {
  const { uuid } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [message, setMessage] = useState('جاري فتح الرابط...');

  useEffect(() => {
    let active = true;

    async function run() {
      try {
        const params = new URLSearchParams(location.search);
        const session = normalizeSessionValue(params.get('session'));
        const table = await resolveTableDirect(uuid, session);
        if (!active) return;
        const tableUuid = normalizeSessionValue(params.get('table')) || uuid;
        const nextSession = normalizeSessionValue(table?.sessionUuid) || session;
        const nextTableUuid = normalizeSessionValue(table?.qrCodeUuid) || tableUuid;
        const nextUrl = nextSession
          ? `/?table=${encodeURIComponent(nextTableUuid)}&session=${encodeURIComponent(nextSession)}`
          : `/?table=${encodeURIComponent(nextTableUuid)}`;
        navigate(nextUrl, { replace: true });
      } catch (error) {
        if (!active) return;
        console.error('[TableEntryPage] QR resolve failed', {
          uuid,
          search: location.search,
          error
        });
        setMessage(error?.message || 'حدث خطأ أثناء فتح الطاولة');
      }
    }

    run();
    return () => {
      active = false;
    };
  }, [location.search, navigate, uuid]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 text-slate-900">
      <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-5 shadow-[0_16px_50px_rgba(15,23,42,0.12)]">
        <div className="text-sm font-semibold text-slate-500">QR</div>
        <div className="mt-2 text-xl font-bold">{message}</div>
      </div>
    </div>
  );
}
