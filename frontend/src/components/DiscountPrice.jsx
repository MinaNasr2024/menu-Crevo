import { discountPercent, formatCurrency } from '../lib/format';

export function DiscountPrice({ price, discountPrice }) {
  const percent = discountPercent(price, discountPrice);
  if (!discountPrice) return <span className="text-[var(--site-text)]">{formatCurrency(price)}</span>;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-[var(--site-muted)] line-through">{formatCurrency(price)}</span>
      <span className="text-lg font-bold text-[var(--site-text)]">{formatCurrency(discountPrice)}</span>
      {percent ? (
        <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-amber-600">
          خصم {percent}%
        </span>
      ) : null}
    </div>
  );
}
