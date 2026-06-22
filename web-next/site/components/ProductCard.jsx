import { DiscountPrice } from './DiscountPrice';
import { ProductMedia } from './ProductMedia';
import { useLanguage } from '../context/LanguageContext';
import { t } from '../lib/i18n';
import { getTagLabel, normalizeSelectedTags } from '../lib/productTags';

export function ProductCard({ product, onOpen, onAdd, verified }) {
  const { lang } = useLanguage();
  const title = lang === 'ar' ? product.nameAr : product.nameEn;
  const description = lang === 'ar' ? product.descriptionAr : product.descriptionEn;
  const tags = normalizeSelectedTags(product.tags).slice(0, 2);

  return (
    <article
      className="w-[78vw] max-w-[240px] shrink-0 overflow-hidden rounded-[28px] border bg-[var(--site-card)] text-[var(--site-text)] shadow-[0_16px_48px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_54px_rgba(15,23,42,0.16)] sm:w-[240px] md:w-[260px]"
      style={{ borderColor: 'var(--site-border)' }}
    >
      <button type="button" className="block w-full" onClick={() => onOpen(product)}>
        <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
          <ProductMedia product={product} className="h-full w-full object-cover object-center" />
          {tags.length ? (
            <div className="absolute left-3 top-3 flex max-w-[calc(100%-24px)] flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-full px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm"
                  style={{ backgroundColor: tag.color || '#64748b' }}
                >
                  {getTagLabel(tag, lang)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </button>

      <div className="px-4 pb-4 pt-4">
        <div
          className="site-heading min-h-[48px] text-[15px] font-semibold leading-6 text-[var(--site-text)]"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {title}
        </div>
        <div
          className="mt-1.5 min-h-[40px] text-[12px] leading-5 text-[var(--site-muted)]"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {description || 'وصف المنتج'}
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <DiscountPrice price={product.price} discountPrice={product.isDiscounted ? product.discountPrice : null} />
          <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-[var(--site-text)]">
            cal {product.calories ?? 0}
          </span>
        </div>

        {verified && product.isAvailable !== false ? (
          <button
            type="button"
            onClick={() => onAdd(product)}
            className="site-button mt-3 w-full rounded-2xl px-3 py-3 text-[13px] font-semibold transition hover:brightness-105"
          >
            {t(lang, 'addToCart')}
          </button>
        ) : verified ? (
          <div className="mt-3 w-full rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-center text-[13px] font-semibold text-rose-700">
            {lang === 'ar' ? 'غير متاح' : 'Unavailable'}
          </div>
        ) : null}
      </div>
    </article>
  );
}
