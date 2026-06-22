import { useLanguage } from '../context/LanguageContext';
import { t } from '../lib/i18n';
import { ProductMedia } from './ProductMedia';
import { getTagLabel, normalizeSelectedTags } from '../lib/productTags';

function limitWords(text, maxWords = 9) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  if (words.length <= maxWords) return words.join(' ');
  return `${words.slice(0, maxWords).join(' ')}...`;
}

function hasProductOptions(product = {}) {
  return [
    Array.isArray(product.sizeOptions) && product.sizeOptions.filter(Boolean).length > 0,
    Array.isArray(product.sideDishOptions) && product.sideDishOptions.filter(Boolean).length > 0,
    Array.isArray(product.addonOptions) && product.addonOptions.filter(Boolean).length > 0,
    Array.isArray(product.customChoiceGroups)
      && product.customChoiceGroups.filter((group) => Array.isArray(group?.items) && group.items.filter(Boolean).length > 0).length > 0
  ].some(Boolean);
}

export function ProductCard({ product, onOpen, onAdd, verified, featured = false, gridMode = false, offerMode = false }) {
  const { lang } = useLanguage();
  const title = lang === 'ar' ? product.nameAr : product.nameEn;
  const description = lang === 'ar' ? product.descriptionAr : product.descriptionEn;
  const previewDescription = limitWords(description, 9);
  const tags = normalizeSelectedTags(product.tags).slice(0, 2);
  const variableProduct = hasProductOptions(product);
  const orderPrompt = t(lang, 'scanQrToOrder');
  const cardClassName = offerMode
    ? (gridMode
      ? 'w-full min-w-0 max-w-none overflow-hidden rounded-[26px] border bg-[var(--site-card)] text-[var(--site-text)] shadow-[0_16px_44px_rgba(15,23,42,0.14)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_54px_rgba(15,23,42,0.18)]'
      : 'w-[74vw] max-w-[230px] shrink-0 overflow-hidden rounded-[26px] border bg-[var(--site-card)] text-[var(--site-text)] shadow-[0_16px_44px_rgba(15,23,42,0.14)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_54px_rgba(15,23,42,0.18)] sm:w-[220px] md:w-[230px]')
    : featured
      ? (gridMode
        ? 'w-full min-w-0 max-w-none overflow-hidden rounded-[32px] border bg-[var(--site-card)] text-[var(--site-text)] shadow-[0_20px_60px_rgba(15,23,42,0.16)] transition hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(15,23,42,0.2)]'
        : 'w-[86vw] max-w-[340px] shrink-0 overflow-hidden rounded-[32px] border bg-[var(--site-card)] text-[var(--site-text)] shadow-[0_20px_60px_rgba(15,23,42,0.16)] transition hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(15,23,42,0.2)] sm:w-[320px] md:w-[340px]')
      : (gridMode
        ? 'w-full min-w-0 max-w-none overflow-hidden rounded-[28px] border bg-[var(--site-card)] text-[var(--site-text)] shadow-[0_16px_48px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_54px_rgba(15,23,42,0.16)]'
        : 'w-[80vw] max-w-[255px] shrink-0 overflow-hidden rounded-[28px] border bg-[var(--site-card)] text-[var(--site-text)] shadow-[0_16px_48px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_54px_rgba(15,23,42,0.16)] sm:w-[250px] md:w-[270px]');

  return (
    <article className={cardClassName} style={{ borderColor: 'var(--site-border)' }}>
      <button type="button" className="block w-full" onClick={() => onOpen(product)}>
        <div className={`relative w-full overflow-hidden bg-slate-100 ${offerMode ? 'aspect-[5/4]' : featured ? 'aspect-[16/10]' : 'aspect-[4/3]'}`}>
          <ProductMedia product={product} className="h-full w-full object-cover object-center" />
          {tags.length ? (
            <div className="absolute left-3 top-3 flex max-w-[85%] flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-full px-2.5 py-1 text-[10px] font-bold text-white shadow-lg backdrop-blur-sm"
                  style={{ backgroundColor: tag.color || '#64748b' }}
                >
                  {getTagLabel(tag, lang)}
                </span>
              ))}
            </div>
          ) : null}
          {featured ? (
            <div className="absolute right-3 top-3 rounded-full bg-[var(--site-button)] px-3 py-1 text-[11px] font-bold text-white shadow-lg">
              {lang === 'ar' ? 'مميز' : 'Featured'}
            </div>
          ) : null}
        </div>
      </button>

      <div className={`space-y-3 px-4 pb-4 pt-4 text-right ${featured ? 'bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(247,248,252,1))]' : ''}`}>
        <div>
          <div className="text-[18px] font-bold leading-6 text-[var(--site-text)]">{title}</div>
          <div
            className="mt-1 text-[15px] leading-5 text-[var(--site-muted)]"
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {previewDescription || (lang === 'ar' ? 'وصف المنتج' : 'Product description')}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-[22px] font-black text-[var(--site-button)]">
            {product.isDiscounted && product.discountPrice ? (
              <>
                <span className="mr-2 text-[12px] font-medium text-[var(--site-muted)] line-through">
                  {Number(product.price ?? 0).toFixed(2)}
                </span>
                {Number(product.discountPrice ?? 0).toFixed(2)}
              </>
            ) : (
              Number(product.price ?? 0).toFixed(2)
            )}
          </div>
          <span className="rounded-full bg-[var(--site-button)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--site-button)]">
            cal {product.calories ?? 0}
          </span>
        </div>

        {verified && product.isAvailable !== false ? (
          <button
            type="button"
            onClick={() => (variableProduct ? onOpen?.(product) : onAdd?.(product))}
            className={`site-button mt-3 w-full rounded-2xl px-3 py-3 font-semibold transition hover:brightness-105 ${
              offerMode ? 'text-[13px]' : featured ? 'text-[14px]' : 'text-[13px]'
            }`}
          >
            {variableProduct ? (lang === 'ar' ? 'عرض المنتج' : 'View product') : t(lang, 'addToCart')}
          </button>
        ) : product.isAvailable !== false ? (
          <button
            type="button"
            disabled
            className="site-button mt-3 w-full cursor-not-allowed rounded-2xl px-3 py-3 text-[12px] font-semibold leading-5 opacity-95"
          >
            {orderPrompt}
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
