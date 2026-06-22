import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';

export function TableEntryPage() {
  const { uuid } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [message, setMessage] = useState('جارٍ فتح الرابط...');

  useEffect(() => {
    let active = true;

    async function run() {
      try {
        const session = new URLSearchParams(location.search).get('session') ?? undefined;
        const table = await api.resolveTable(uuid, session);
        if (!active) return;
        navigate(`/menu?table=${table.qrCodeUuid}&session=${table.sessionUuid}`, { replace: true });
      } catch (error) {
        if (!active) return;
        setMessage(error.message);
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
