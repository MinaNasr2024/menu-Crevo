import { useEffect, useMemo, useState } from 'react';
import { resolveMediaUrl } from './ProductMedia';
import { useLanguage } from '../context/LanguageContext';
import { getTagLabel, normalizeSelectedTags } from '../lib/productTags';
import { formatCurrency } from '../lib/format';
import { t } from '../lib/i18n';

function isVideoUrl(url) {
  const value = String(url ?? '').toLowerCase();
  if (!value) return false;
  if (value.startsWith('data:video')) return true;
  return /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/.test(value);
}

function ShareIcon({ type }) {
  const className = 'h-4 w-4 fill-current';
  switch (type) {
    case 'whatsapp':
      return <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.2L2 22l4.9-1.3A10 10 0 1 0 12 2zm0 2a8 8 0 0 1 6.9 12A8 8 0 0 1 6.1 18.4l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 0 1 12 4zm4.5 10.6c-.2.6-1.1 1.1-1.5 1.1-.4 0-1 .1-3.3-.8-2.9-1.2-4.8-4-5-4.2-.1-.2-1.2-1.6-1.2-3 0-1.5.8-2.3 1.1-2.6.3-.3.7-.4.9-.4h.7c.2 0 .5-.1.8.6l.9 2c.1.2.1.4 0 .5-.1.1-.1.3-.3.5l-.4.4c-.1.2-.3.4-.1.7.2.3.9 1.4 1.9 2.2 1.2 1.1 2.2 1.4 2.5 1.5.3.1.5.1.7-.1l.8-1c.2-.2.4-.2.6-.1l1.8.9c.3.1.5.2.6.4.1.3.1.7 0 1z" /></svg>;
    case 'facebook':
      return <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><path d="M14 8.5V7c0-.8.2-1.5 1.5-1.5H18V2h-2.7C12.2 2 11 3.7 11 6.5V8H8v3h3v11h3v-11h2.9l.5-3H14z" /></svg>;
    case 'copy':
      return <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><path d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H10V7h9v14z" /></svg>;
    default:
      return null;
  }
}

function ShareButton({ type, href, label, onClick, className = '' }) {
  const common = 'flex h-11 items-center justify-center rounded-full border bg-[var(--site-card)] text-[var(--site-text)] shadow-sm transition hover:brightness-95';

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${common} w-11 ${className}`} style={{ borderColor: 'var(--site-border)' }} aria-label={label}>
        <ShareIcon type={type} />
      </button>
    );
  }

  return (
    <a
      href={href || '#'}
      target="_blank"
      rel="noreferrer"
      className={`${common} w-11 ${className}`}
      style={{ borderColor: 'var(--site-border)' }}
      aria-label={label}
    >
      <ShareIcon type={type} />
    </a>
  );
}

function isSelectedId(collection, id) {
  return collection.includes(String(id));
}

function OptionRow({
  checked,
  label,
  price,
  onClick,
  type = 'checkbox',
  lang = 'ar',
  selectedColor = 'var(--site-button)',
  disabled = false
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-right transition ${
        checked
          ? 'border-[var(--site-button)] bg-[var(--site-button)]/10'
          : 'border-[var(--site-border)] bg-transparent hover:bg-black/5'
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold"
          style={{
            borderColor: checked ? selectedColor : 'var(--site-border)',
            color: checked ? selectedColor : 'var(--site-muted)',
            background: checked ? 'rgba(215, 164, 57, 0.08)' : 'rgba(255,255,255,0.02)'
          }}
        >
          {checked ? '✓' : '+'}
        </span>
        <span className="min-w-0 truncate text-sm font-semibold text-[var(--site-text)]">{label}</span>
      </span>
      <span className="shrink-0 text-sm font-bold text-[var(--site-button)]">
        {price ? `+ ${price}` : lang === 'ar' ? 'اختيار' : 'Select'}
      </span>
    </button>
  );
}

function normalizeChoiceGroups(groups = []) {
  return Array.isArray(groups)
    ? groups.map((group) => {
      const items = Array.isArray(group?.items)
        ? group.items.filter(Boolean).map((item) => ({
          id: String(item?.id ?? ''),
          labelAr: String(item?.labelAr ?? item?.label ?? '').trim(),
          labelEn: String(item?.labelEn ?? item?.labelAr ?? item?.label ?? '').trim(),
          price: String(item?.price ?? '0'),
          required: Boolean(item?.required)
        })).filter((item) => item.id && (item.labelAr || item.labelEn))
        : [];
      const titleAr = String(group?.titleAr ?? '').trim();
      const titleEn = String(group?.titleEn ?? titleAr ?? '').trim() || titleAr;
      if (!titleAr && !titleEn && !items.length) return null;
      return {
        id: String(group?.id ?? ''),
        titleAr,
        titleEn,
        items
      };
    }).filter((group) => (group.titleAr || group.titleEn) && group.items.length)
    : [];
}

export function ProductModal({ product, open, onClose, onAdd, verified }) {
  const { lang } = useLanguage();
  const [index, setIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [selectedSizeId, setSelectedSizeId] = useState('');
  const [selectedSideDishIds, setSelectedSideDishIds] = useState([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState([]);
  const [selectedCustomChoiceIds, setSelectedCustomChoiceIds] = useState({});
  const [customerNote, setCustomerNote] = useState('');

  const gallery = useMemo(
    () => [product?.coverMediaUrl, ...(product?.galleryUrls ?? [])].filter(Boolean),
    [product]
  );
  const tags = useMemo(() => normalizeSelectedTags(product?.tags), [product]);
  const ingredients = useMemo(() => (Array.isArray(product?.ingredients) ? product.ingredients.filter(Boolean) : []), [product]);
  const allergens = useMemo(() => (Array.isArray(product?.allergens) ? product.allergens.filter(Boolean) : []), [product]);
  const sizeOptions = useMemo(() => (Array.isArray(product?.sizeOptions) ? product.sizeOptions.filter(Boolean) : []), [product]);
  const sideDishOptions = useMemo(() => (Array.isArray(product?.sideDishOptions) ? product.sideDishOptions.filter(Boolean) : []), [product]);
  const addonOptions = useMemo(() => (Array.isArray(product?.addonOptions) ? product.addonOptions.filter(Boolean) : []), [product]);
  const customChoiceGroups = useMemo(() => normalizeChoiceGroups(product?.customChoiceGroups), [product]);

  useEffect(() => {
    setIndex(0);
    setCopied(false);
    setSelectedSizeId('');
    setSelectedSideDishIds([]);
    setSelectedAddonIds([]);
    setCustomerNote('');
  }, [product]);

  useEffect(() => {
    const initialSelections = {};
    for (const group of customChoiceGroups) {
      const requiredChoice = group.items.find((item) => Boolean(item.required));
      if (requiredChoice) {
        initialSelections[group.id] = String(requiredChoice.id);
      }
    }
    setSelectedCustomChoiceIds(initialSelections);
  }, [customChoiceGroups, product]);

  if (!open || !product) return null;

  const title = lang === 'ar' ? product.nameAr : product.nameEn;
  const description = lang === 'ar' ? product.descriptionAr : product.descriptionEn;
  const currentUrl = resolveMediaUrl(gallery[index] ?? product.coverMediaUrl);
  const currentIsVideo = isVideoUrl(currentUrl) || (index === 0 && product.mediaType === 'video');
  const selectedSize = sizeOptions.find((item) => String(item.id) === String(selectedSizeId)) ?? null;
  const selectedSideDishItems = sideDishOptions.filter((item) => isSelectedId(selectedSideDishIds, item.id));
  const selectedAddonItems = addonOptions.filter((item) => isSelectedId(selectedAddonIds, item.id));
  const selectedCustomChoices = customChoiceGroups
    .map((group) => {
      const selectedId = String(selectedCustomChoiceIds[group.id] ?? '');
      if (!selectedId) return null;
      const choice = group.items.find((item) => String(item.id) === selectedId) ?? null;
      if (!choice) return null;
      return {
        groupId: group.id,
        groupTitleAr: group.titleAr,
        groupTitleEn: group.titleEn,
        choiceId: choice.id,
        choiceLabelAr: choice.labelAr,
        choiceLabelEn: choice.labelEn,
        choicePrice: String(choice.price ?? '0')
      };
    })
    .filter(Boolean);
  const basePrice = product.isDiscounted && product.discountPrice ? Number(product.discountPrice) : Number(product.price ?? 0);
  const productBasePrice = selectedSize ? Number(selectedSize.price ?? 0) : basePrice;
  const productPrice = productBasePrice
    + selectedSideDishItems.reduce((sum, item) => sum + Number(item.price ?? 0), 0)
    + selectedAddonItems.reduce((sum, item) => sum + Number(item.price ?? 0), 0)
    + selectedCustomChoices.reduce((sum, item) => sum + Number(item.choicePrice ?? 0), 0);
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/menu?product=${encodeURIComponent(product.id)}`
    : '';

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  function changeIndex(nextIndex) {
    if (!gallery.length) return;
    setIndex((nextIndex + gallery.length) % gallery.length);
  }

  function toggleId(collection, setCollection, id) {
    const key = String(id);
    setCollection((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }

  function toggleSingleSize(id) {
    setSelectedSizeId((current) => (String(current) === String(id) ? '' : String(id)));
  }

  function setCustomChoice(groupId, choiceId) {
    setSelectedCustomChoiceIds((current) => ({
      ...current,
      [String(groupId)]: String(choiceId)
    }));
  }

  function submitProduct() {
    if (!onAdd) return;
    onAdd({
      ...product,
      title,
      effectivePrice: productPrice,
      selectedOptions: {
        sizeId: selectedSizeId || null,
        sizeLabelAr: selectedSize ? selectedSize.labelAr : null,
        sizeLabelEn: selectedSize ? selectedSize.labelEn : null,
        sideDishIds: selectedSideDishIds,
        sideDishLabelsAr: selectedSideDishItems.map((item) => item.labelAr),
        sideDishLabelsEn: selectedSideDishItems.map((item) => item.labelEn),
        addonIds: selectedAddonIds,
        addonLabelsAr: selectedAddonItems.map((item) => item.labelAr),
        addonLabelsEn: selectedAddonItems.map((item) => item.labelEn),
        customChoiceSelections: selectedCustomChoices,
        note: String(customerNote ?? '').trim()
      }
    });
    onClose?.();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative w-full max-w-[675px] overflow-hidden rounded-[28px] bg-[var(--site-card)] text-[var(--site-text)] shadow-[0_30px_100px_rgba(15,23,42,0.35)]"
        style={{ border: '1px solid var(--site-border)' }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute left-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border bg-[var(--site-card)] text-2xl leading-none text-[var(--site-text)] shadow-sm transition hover:brightness-95"
          aria-label="Close"
        >
          ×
        </button>

        <div className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto">
          <div className="px-5 pb-5 pt-14 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3 text-right">
              <div className="min-w-0">
                <h2 className="site-heading text-[30px] font-extrabold leading-tight text-[var(--site-text)]">{title}</h2>
                <p className="mt-1 text-sm font-medium text-[var(--site-muted)]">
                  {lang === 'ar' ? 'تفاصيل المنتج' : 'Product details'}
                </p>
              </div>
              {product.averageWaitTime ? (
                <div className="rounded-full border px-4 py-2 text-xs font-semibold text-[var(--site-muted)]" style={{ borderColor: 'var(--site-border)', background: 'rgba(255,255,255,0.04)' }}>
                  {lang === 'ar' ? 'متوسط الانتظار' : 'Average wait'}: {product.averageWaitTime} {lang === 'ar' ? 'دقيقة' : 'min'}
                </div>
              ) : null}
            </div>

            <div className="mt-4 overflow-hidden rounded-[24px] bg-black/5">
              <div className="relative aspect-[16/10] w-full">
                {currentIsVideo ? (
                  <video
                    key={currentUrl}
                    className="h-full w-full object-cover"
                    src={currentUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                ) : (
                  <img className="h-full w-full object-cover" src={currentUrl} alt="" />
                )}

                {gallery.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => changeIndex(index - 1)}
                      className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-2xl text-white backdrop-blur-sm transition hover:bg-black/65"
                      aria-label="previous image"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => changeIndex(index + 1)}
                      className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-2xl text-white backdrop-blur-sm transition hover:bg-black/65"
                      aria-label="next image"
                    >
                      ›
                    </button>
                  </>
                ) : null}

                {tags.length ? (
                  <div className="absolute left-3 top-3 flex max-w-[85%] flex-wrap gap-2">
                    {tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag.id}
                        className="rounded-full px-3 py-1.5 text-[11px] font-bold text-white shadow-lg backdrop-blur-sm"
                        style={{ backgroundColor: tag.color || '#64748b' }}
                      >
                        {getTagLabel(tag, lang)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {gallery.length > 1 ? (
              <div className="mt-3 flex justify-center gap-2">
                {gallery.map((item, galleryIndex) => (
                  <button
                    type="button"
                    key={`${item}-${galleryIndex}`}
                    onClick={() => setIndex(galleryIndex)}
                    className={`h-2.5 rounded-full transition-all ${
                      galleryIndex === index ? 'w-8 bg-[var(--site-button)]' : 'w-2.5 bg-slate-300'
                    }`}
                    aria-label={`slide-${galleryIndex + 1}`}
                  />
                ))}
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-[var(--site-muted)]">{lang === 'ar' ? 'مشاركة' : 'Share'}</p>
              </div>
              <div className="flex items-center gap-2">
                <ShareButton
                  type="whatsapp"
                  href={shareUrl ? `https://wa.me/?text=${encodeURIComponent(shareUrl)}` : '#'}
                  label="WhatsApp"
                />
                <ShareButton
                  type="facebook"
                  href={shareUrl ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}` : '#'}
                  label="Facebook"
                />
                <ShareButton type="copy" label="Copy link" onClick={copyLink} />
              </div>
            </div>

            {copied ? (
              <p className="mt-2 text-right text-sm font-semibold text-emerald-600">
                {lang === 'ar' ? 'تم نسخ الرابط' : 'Link copied'}
              </p>
            ) : null}

            {sizeOptions.length ? (
              <section className="mt-5 text-right">
                <h3 className="text-sm font-bold text-[var(--site-text)]">{lang === 'ar' ? 'الأحجام' : 'Sizes'}</h3>
                <div className="mt-3 space-y-2">
                  {sizeOptions.map((item) => {
                    const checked = String(selectedSizeId) === String(item.id);
                    return (
                      <OptionRow
                        key={item.id}
                        checked={checked}
                        label={lang === 'ar' ? item.labelAr : item.labelEn}
                        price={formatCurrency(item.price)}
                        lang={lang}
                        type="radio"
                        onClick={() => toggleSingleSize(item.id)}
                      />
                    );
                  })}
                  {!sizeOptions.length ? null : (
                    <OptionRow
                      checked={!selectedSizeId}
                      label={lang === 'ar' ? 'بدون حجم إضافي' : 'No extra size'}
                      price=""
                      lang={lang}
                      type="radio"
                      onClick={() => toggleSingleSize('')}
                    />
                  )}
                </div>
              </section>
            ) : null}

            <div className="mt-5 flex items-end justify-between gap-4">
              <div className="text-right">
                <p className="text-sm font-semibold text-[var(--site-muted)]">{lang === 'ar' ? 'السعر' : 'Price'}</p>
                <div className="mt-1 text-[30px] font-black text-[var(--site-button)]">{formatCurrency(productPrice)}</div>
              </div>
            </div>

            {description ? (
              <section className="mt-5 text-right">
                <h3 className="text-sm font-bold text-[var(--site-text)]">{lang === 'ar' ? 'الوصف' : 'Description'}</h3>
                <p className="mt-2 leading-8 text-[var(--site-muted)]">{description}</p>
              </section>
            ) : null}

            {customChoiceGroups.length ? (
              <section className="mt-5 space-y-4 text-right">
                {customChoiceGroups.map((group) => {
                  const selectedChoiceId = String(selectedCustomChoiceIds[group.id] ?? '');
                  const groupTitle = lang === 'ar' ? (group.titleAr || group.titleEn) : (group.titleEn || group.titleAr);
                  return (
                    <div key={group.id} className="rounded-[24px] border border-[var(--site-border)] bg-[rgba(255,255,255,0.03)] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--site-text)]">
                            <span>{groupTitle}</span>
                            {group.items.some((item) => Boolean(item.required)) ? (
                              <span className="rounded-full bg-rose-500/15 px-2 py-1 text-[10px] font-bold text-rose-300">
                                {lang === 'ar' ? 'مطلوب' : 'Required'}
                              </span>
                            ) : null}
                          </h3>
                          <p className="mt-1 text-xs text-[var(--site-muted)]">
                            {group.minSelect}-{group.maxSelect} {lang === 'ar' ? 'اختيارات مطلوبة' : 'required selections'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        {group.items.map((item) => {
                          const checked = String(item.id) === selectedChoiceId;
                          return (
                            <OptionRow
                              key={item.id}
                              checked={checked}
                              label={lang === 'ar' ? item.labelAr : item.labelEn}
                              price={formatCurrency(item.price)}
                              lang={lang}
                              type="radio"
                              onClick={() => setCustomChoice(group.id, item.id)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </section>
            ) : null}

            {sideDishOptions.length ? (
              <section className="mt-5 text-right">
                <h3 className="text-sm font-bold text-[var(--site-text)]">{lang === 'ar' ? 'الأطباق الإضافية' : 'Side dishes'}</h3>
                <div className="mt-3 space-y-2">
                  {sideDishOptions.map((item) => {
                    const checked = isSelectedId(selectedSideDishIds, item.id);
                    return (
                      <OptionRow
                        key={item.id}
                        checked={checked}
                        label={lang === 'ar' ? item.labelAr : item.labelEn}
                        price={formatCurrency(item.price)}
                        lang={lang}
                        onClick={() => toggleId(selectedSideDishIds, setSelectedSideDishIds, item.id)}
                      />
                    );
                  })}
                </div>
              </section>
            ) : null}

            {addonOptions.length ? (
              <section className="mt-5 text-right">
                <h3 className="text-sm font-bold text-[var(--site-text)]">{lang === 'ar' ? 'الإضافات' : 'Add-ons'}</h3>
                <div className="mt-3 space-y-2">
                  {addonOptions.map((item) => {
                    const checked = isSelectedId(selectedAddonIds, item.id);
                    return (
                      <OptionRow
                        key={item.id}
                        checked={checked}
                        label={lang === 'ar' ? item.labelAr : item.labelEn}
                        price={formatCurrency(item.price)}
                        lang={lang}
                        onClick={() => toggleId(selectedAddonIds, setSelectedAddonIds, item.id)}
                      />
                    );
                  })}
                </div>
              </section>
            ) : null}

            {ingredients.length ? (
              <section className="mt-5 text-right">
                <h3 className="text-sm font-bold text-[var(--site-text)]">{lang === 'ar' ? 'المكونات' : 'Ingredients'}</h3>
                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  {ingredients.map((item) => (
                    <span key={item} className="rounded-full border px-3 py-1.5 text-sm text-[var(--site-text)]" style={{ borderColor: 'var(--site-border)', background: 'rgba(255,255,255,0.04)' }}>
                      {item}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            {allergens.length ? (
              <section className="mt-5 text-right">
                <h3 className="text-sm font-bold text-[var(--site-text)]">{lang === 'ar' ? 'مسببات الحساسية' : 'Allergens'}</h3>
                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  {allergens.map((item) => (
                    <span key={item} className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-sm font-semibold text-amber-700">
                      {item}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="mt-5 rounded-[18px] border px-4 py-3 text-center text-sm font-semibold text-[var(--site-muted)]" style={{ borderColor: 'var(--site-border)', background: 'rgba(255,255,255,0.04)' }}>
              cal {product.calories ?? 0}
            </div>

            <section className="mt-5 text-right">
              <h3 className="text-sm font-bold text-[var(--site-text)]">{lang === 'ar' ? 'ملاحظات العميل' : 'Customer note'}</h3>
              <textarea
                className="mt-2 min-h-24 w-full rounded-2xl border border-[var(--site-border)] bg-[var(--site-card)] px-4 py-3 text-[var(--site-text)] outline-none"
                placeholder={lang === 'ar' ? 'اكتب أي ملاحظة للمنتج' : 'Write any special request for this item...'}
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
              />
            </section>

            {onAdd ? (
              <button
                type="button"
                onClick={submitProduct}
                className="site-button mt-5 w-full rounded-2xl px-5 py-4 text-sm font-bold text-[var(--site-button-text)] transition hover:brightness-105"
                disabled={verified === false}
              >
                {verified === false ? t(lang, 'scanQrToOrder') : (lang === 'ar' ? 'أضف إلى السلة' : 'Add to cart')}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}


