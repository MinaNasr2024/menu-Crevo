import { useLanguage } from '../context/LanguageContext';
import { getTagLabel, normalizeSelectedTags } from '../lib/productTags';
import { ProductMedia } from './ProductMedia';

function optionCountLabel(product, lang) {
  const sizeCount = Array.isArray(product?.sizeOptions) ? product.sizeOptions.length : 0;
  const addonCount = Array.isArray(product?.addonOptions) ? product.addonOptions.length : 0;
  const sideCount = Array.isArray(product?.sideDishOptions) ? product.sideDishOptions.length : 0;
  const parts = [];
  if (sizeCount) parts.push(lang === 'ar' ? `${sizeCount} أحجام` : `${sizeCount} sizes`);
  if (addonCount) parts.push(lang === 'ar' ? `${addonCount} إضافات` : `${addonCount} add-ons`);
  if (sideCount) parts.push(lang === 'ar' ? `${sideCount} أطباق` : `${sideCount} extras`);
  return parts.join(' · ');
}

export function StudioProductCard({ product, onOpen }) {
  const { lang } = useLanguage();
  const title = lang === 'ar' ? product.nameAr : product.nameEn;
  const description = lang === 'ar' ? product.descriptionAr : product.descriptionEn;
  const sizeOptions = Array.isArray(product?.sizeOptions) ? product.sizeOptions.filter(Boolean) : [];
  const tags = normalizeSelectedTags(product.tags).slice(0, 2);
  const isVariable = (Array.isArray(product?.sizeOptions) && product.sizeOptions.length > 0)
    || (Array.isArray(product?.addonOptions) && product.addonOptions.length > 0)
    || (Array.isArray(product?.sideDishOptions) && product.sideDishOptions.length > 0);

  return (
    <article
      className="w-[80vw] max-w-[255px] shrink-0 overflow-hidden rounded-[28px] border bg-[var(--site-card)] text-[var(--site-text)] shadow-[0_16px_48px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_54px_rgba(15,23,42,0.16)] sm:w-[250px] md:w-[270px]"
      style={{ borderColor: 'var(--site-border)' }}
    >
      <button type="button" className="block w-full" onClick={() => onOpen(product)}>
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
          <ProductMedia product={product} className="h-full w-full object-cover object-center" />
          {isVariable ? (
            <div className="absolute right-3 top-3 rounded-full bg-black/70 px-3 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
              {lang === 'ar' ? 'متغير' : 'Variable'}
            </div>
          ) : null}
          {tags.length ? (
            <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-24px)] flex-wrap gap-1.5">
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

      <div className="space-y-3 px-4 pb-4 pt-4 text-right">
        <div>
          <div className="text-[15px] font-bold leading-6 text-[var(--site-text)]">{title}</div>
          <div
            className="mt-1 text-[11px] leading-5 text-[var(--site-muted)]"
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {description || (lang === 'ar' ? 'وصف المنتج' : 'Product description')}
          </div>
        </div>

        {sizeOptions.length ? (
          <div className="space-y-1 text-right">
            <div className="text-[11px] font-semibold text-[var(--site-muted)]">
              {lang === 'ar' ? 'الأحجام' : 'Sizes'}
            </div>
            <select
              className="w-full rounded-2xl border border-[var(--site-border)] bg-white px-3 py-2 text-sm text-[var(--site-text)] outline-none"
              value=""
              disabled
            >
              <option value="">{lang === 'ar' ? 'اختر المقاس' : 'Choose size'}</option>
              {sizeOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {lang === 'ar' ? item.labelAr : item.labelEn} + {Number(item.price ?? 0).toFixed(2)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-[var(--site-muted)]">
          <span>{lang === 'ar' ? 'التحضير' : 'Prep'} {Number(product.averageWaitTime ?? 0)} {lang === 'ar' ? 'دقيقة' : 'min'}</span>
          {isVariable ? (
            <span className="rounded-full bg-[var(--site-button)]/10 px-2.5 py-1 text-[var(--site-button)]">
              {optionCountLabel(product, lang) || (lang === 'ar' ? 'متغير' : 'Variable')}
            </span>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-[18px] font-black text-[var(--site-button)]">
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
      </div>
    </article>
  );
}
