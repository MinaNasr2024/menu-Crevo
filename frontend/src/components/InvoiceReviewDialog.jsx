import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

const emojiRatings = [
  { value: 1, label: '😡', title: 'سيئ جدًا' },
  { value: 2, label: '😕', title: 'سيئ' },
  { value: 3, label: '😐', title: 'مقبول' },
  { value: 4, label: '🙂', title: 'جيد' },
  { value: 5, label: '😍', title: 'ممتاز' }
];

function StarButton({ active, onClick, index }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-11 w-11 items-center justify-center rounded-full border text-xl transition ${
        active ? 'border-amber-400 bg-amber-400 text-white shadow-lg' : 'border-slate-200 bg-white text-slate-300 hover:border-amber-300 hover:text-amber-400'
      }`}
      aria-label={`${index} star`}
    >
      ★
    </button>
  );
}

export function InvoiceReviewDialog({
  open,
  tablePhone,
  defaultName = '',
  onClose,
  onSubmit
}) {
  const [mode, setMode] = useState('stars');
  const [rating, setRating] = useState(5);
  const [name, setName] = useState(defaultName);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setMode('stars');
    setRating(5);
    setName(defaultName);
    setComment('');
    setLoading(false);
    setError('');
  }, [open, defaultName]);

  const ratingLabel = useMemo(() => {
    if (mode === 'emoji') {
      return emojiRatings.find((item) => item.value === rating)?.title ?? '';
    }
    switch (rating) {
      case 1:
        return 'سيئ جدًا';
      case 2:
        return 'سيئ';
      case 3:
        return 'مقبول';
      case 4:
        return 'جيد';
      default:
        return 'ممتاز';
    }
  }, [mode, rating]);

  async function submitReview() {
    const trimmedName = String(name ?? '').trim();
    const trimmedComment = String(comment ?? '').trim();
    if (!trimmedName) {
      setError('من فضلك اكتب الاسم');
      return;
    }
    if (!tablePhone) {
      setError('رقم الهاتف المفتوح للطاولة غير متاح');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await onSubmit({
        ratingMode: mode,
        ratingValue: rating,
        customerName: trimmedName,
        comment: trimmedComment
      });
      onClose();
    } catch (submitError) {
      setError(submitError?.message ?? 'حدث خطأ أثناء إرسال التقييم');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <ConfirmDialog
      open={open}
      title="قيّم تجربتك"
      description={tablePhone ? `سيتم حفظ التقييم على رقم الهاتف المفتوح للطاولة: ${tablePhone}` : 'سيتم حفظ التقييم على رقم الهاتف المفتوح للطاولة'}
      confirmLabel={loading ? 'جارٍ الإرسال...' : 'إرسال التقييم'}
      cancelLabel="إغلاق"
      confirmDisabled={loading}
      onConfirm={submitReview}
      onCancel={onClose}
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('stars')}
              className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${
                mode === 'stars'
                  ? 'bg-[var(--site-button)] text-[var(--site-button-text)]'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              نجوم
            </button>
            <button
              type="button"
              onClick={() => setMode('emoji')}
              className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${
                mode === 'emoji'
                  ? 'bg-[var(--site-button)] text-[var(--site-button-text)]'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              إيموجي
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block space-y-2 text-right">
            <span className="text-sm font-semibold text-slate-700">الاسم</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[var(--site-button)]"
              placeholder="اكتب اسمك"
            />
          </label>
        </div>

        <label className="block space-y-2 text-right">
          <span className="text-sm font-semibold text-slate-700">التقييم</span>
          {mode === 'stars' ? (
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <StarButton
                  key={value}
                  index={value}
                  active={rating >= value}
                  onClick={() => setRating(value)}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-2">
              {emojiRatings.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setRating(item.value)}
                  className={`flex flex-col items-center justify-center rounded-2xl border px-2 py-3 text-2xl transition ${
                    rating === item.value
                      ? 'border-[var(--site-button)] bg-[rgba(215,164,57,0.12)] shadow-sm'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                  title={item.title}
                >
                  <span>{item.label}</span>
                  <span className="mt-1 text-[10px] font-semibold text-slate-500">{item.value}</span>
                </button>
              ))}
            </div>
          )}
          <p className="text-xs font-semibold text-slate-500">{ratingLabel}</p>
        </label>

        <label className="block space-y-2 text-right">
          <span className="text-sm font-semibold text-slate-700">رسالة التقييم</span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[var(--site-button)]"
            placeholder="اكتب رأيك هنا..."
          />
        </label>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
