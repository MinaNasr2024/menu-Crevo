import { useEffect, useMemo, useState } from 'react';
import { AdminShell } from '../components/AdminShell';
import { api } from '../lib/api';
import { useWindowDataChanged } from '../hooks/useWindowDataChanged';

const emojiLabels = {
  1: '😡',
  2: '😕',
  3: '😐',
  4: '🙂',
  5: '😍'
};

function formatDateTime(value) {
  if (!value) return 'غير متاح';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'غير متاح';
  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function RatingDisplay({ mode, value }) {
  if (mode === 'emoji') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-2xl">{emojiLabels[value] ?? '🙂'}</span>
        <span className="text-sm font-semibold text-white/80">{value}/5</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 text-amber-300">
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={`text-lg ${index < value ? 'text-amber-300' : 'text-white/20'}`}>★</span>
      ))}
      <span className="mr-2 text-sm font-semibold text-white/75">{value}/5</span>
    </div>
  );
}

export function CustomerReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [message, setMessage] = useState('');

  async function refresh() {
    const data = await api.customerReviews();
    setReviews(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    refresh().catch((error) => setMessage(error.message));
  }, []);

  useWindowDataChanged(() => {
    refresh().catch(() => {});
  });

  const totalReviews = useMemo(() => reviews.length, [reviews]);

  return (
    <AdminShell title="تقييمات العملاء">
      <div className="space-y-6">
        <section className="glass-panel rounded-[32px] p-5 sm:p-6 shadow-glow">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">آراء الزبائن</p>
              <h1 className="mt-2 text-3xl font-bold text-cream">تقييمات العملاء</h1>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
              إجمالي التقييمات: {totalReviews}
            </div>
          </div>
          {message ? <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">{message}</p> : null}
        </section>

        {reviews.length ? (
          <section className="grid gap-4 xl:grid-cols-2">
            {reviews.map((review) => (
              <article key={review.id} className="glass-panel rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full border border-white/20"
                        style={{ backgroundColor: review.tableColor || '#d4af37' }}
                      />
                      <h2 className="text-xl font-bold text-cream">طاولة {review.tableNumber}</h2>
                    </div>
                    <p className="mt-1 text-sm text-white/60">الاسم: {review.customerName}</p>
                    <p className="mt-1 text-xs text-white/45">الهاتف: {review.phone}</p>
                    <p className="mt-1 text-xs text-white/45">{formatDateTime(review.createdAt)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                    <div className="font-semibold text-white/90">طريقة التقييم</div>
                    <RatingDisplay mode={review.ratingMode} value={Number(review.ratingValue ?? 0)} />
                  </div>
                </div>

                {review.comment ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-7 text-white/75">
                    {review.comment}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-3 text-sm text-white/40">
                    لا يوجد تعليق مكتوب
                  </div>
                )}
              </article>
            ))}
          </section>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-white/60">
            لا توجد تقييمات حتى الآن.
          </div>
        )}
      </div>
    </AdminShell>
  );
}
