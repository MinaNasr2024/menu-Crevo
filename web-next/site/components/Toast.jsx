import { useEffect } from 'react';

export function Toast({ open, title, description, tone = 'success', durationMs = 5000, onClose }) {
  useEffect(() => {
    if (!open || !onClose) return undefined;
    const timer = window.setTimeout(() => onClose(), durationMs);
    return () => window.clearTimeout(timer);
  }, [open, onClose, durationMs]);

  if (!open) return null;

  const styles = tone === 'error'
    ? 'border-red-400/20 bg-red-500/90 text-white shadow-[0_18px_50px_rgba(239,68,68,0.25)]'
    : 'border-emerald-400/20 bg-emerald-500/90 text-white shadow-[0_18px_50px_rgba(16,185,129,0.22)]';

  return (
    <div className="fixed bottom-4 right-4 z-[70] max-w-[320px]">
      <div className={`rounded-[20px] border px-4 py-3 backdrop-blur-xl ${styles}`}>
        {title ? <div className="text-sm font-bold">{title}</div> : null}
        {description ? <div className="mt-1 text-sm/6 text-white/90">{description}</div> : null}
      </div>
    </div>
  );
}
