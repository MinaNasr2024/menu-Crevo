export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel = 'نعم',
  cancelLabel = 'لا',
  confirmDisabled = false,
  onConfirm,
  onCancel
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 text-slate-900 shadow-[0_26px_80px_rgba(15,23,42,0.3)]">
        <div className="text-right">
          {title ? <h3 className="text-xl font-bold">{title}</h3> : null}
          {description ? <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p> : null}
        </div>

        {children ? <div className="mt-5">{children}</div> : null}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          {cancelLabel !== null && cancelLabel !== undefined ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {cancelLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="rounded-2xl bg-[var(--site-button)] px-5 py-3 text-sm font-bold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
