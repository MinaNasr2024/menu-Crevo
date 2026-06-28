import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

export function TableEntryPage() {
  const { uuid } = useParams();
  const [message, setMessage] = useState('جاري التحويل...');

  useEffect(() => {
    if (!uuid) {
      setMessage('Invalid table QR code');
      return undefined;
    }

    const nextUrl = `/menu?table=${encodeURIComponent(uuid)}`;
    const timer = window.setTimeout(() => {
      window.location.replace(nextUrl);
    }, 80);

    return () => window.clearTimeout(timer);
  }, [uuid]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 text-slate-900">
      <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-5 shadow-[0_16px_50px_rgba(15,23,42,0.12)]">
        <div className="text-sm font-semibold text-slate-500">QR</div>
        <div className="mt-2 text-xl font-bold">{message}</div>
      </div>
    </div>
  );
}
