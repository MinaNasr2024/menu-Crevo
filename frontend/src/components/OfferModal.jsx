import { useEffect, useMemo, useState } from 'react';
import { resolveMediaUrl } from './ProductMedia';
import { formatCurrency } from '../lib/format';

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

function ChoiceRow({ checked, label, price, onClick, lang }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-right transition ${
        checked
          ? 'border-[var(--site-button)] bg-[var(--site-button)]/10'
          : 'border-[var(--site-border)] bg-transparent hover:bg-black/5'
      }`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold"
          style={{
            borderColor: checked ? 'var(--site-button)' : 'var(--site-border)',
            color: checked ? 'var(--site-button)' : 'var(--site-muted)',
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

export function OfferModal({ offer, open, onClose, onAddToCart, lang = 'ar' }) {
  const groups = useMemo(() => {
    if (!offer || !Array.isArray(offer.groups)) return [];
    return offer.groups.filter((group) => Array.isArray(group.items) && group.items.length > 0);
  }, [offer]);
  const [selectedByGroup, setSelectedByGroup] = useState({});
  const [selectedProductChoices, setSelectedProductChoices] = useState({});
  const [note, setNote] = useState('');

  useEffect(() => {
    setSelectedByGroup({});
    setSelectedProductChoices({});
    setNote('');
  }, [offer]);

  function getSelectedItems(group) {
    const selected = selectedByGroup[String(group.id)];
    if (!selected) return [];
    return Array.isArray(selected) ? selected : [selected];
  }

  function getMinimumRequired(group) {
    if (String(group.selectionMode ?? 'checkbox') === 'radio') return 1;
    const minSelect = Number(group.minSelect ?? 0);
    return group.required ? Math.max(1, minSelect) : 0;
  }

  function isGroupValid(group) {
    const selectedCount = getSelectedItems(group).length;
    const mode = String(group.selectionMode ?? 'checkbox');
    const maxAllowed = mode === 'radio' ? 1 : Number(group.maxSelect ?? 0);
    return selectedCount >= getMinimumRequired(group) && selectedCount <= maxAllowed;
  }

  function isOfferValid() {
    return groups.every((group) => isGroupValid(group));
  }

  function getProductChoiceGroups(item) {
    return normalizeChoiceGroups(item?.product?.customChoiceGroups);
  }

  function getResolvedProductChoices(item) {
    const choiceGroups = getProductChoiceGroups(item);
    const explicit = selectedProductChoices[String(item.id)] ?? {};
    const resolved = {};

    for (const choiceGroup of choiceGroups) {
      const selectedId = String(explicit[String(choiceGroup.id)] ?? '');
      if (selectedId) {
        resolved[choiceGroup.id] = selectedId;
        continue;
      }
      const requiredChoice = choiceGroup.items.find((candidate) => Boolean(candidate.required));
      if (requiredChoice) {
        resolved[choiceGroup.id] = String(requiredChoice.id);
      }
    }

    return resolved;
  }

  function getSelectedChoicePrice(item) {
    const choiceGroups = getProductChoiceGroups(item);
    const resolved = getResolvedProductChoices(item);
    return choiceGroups.reduce((sum, choiceGroup) => {
      const selectedId = String(resolved[String(choiceGroup.id)] ?? '');
      if (!selectedId) return sum;
      const selectedChoice = choiceGroup.items.find((candidate) => String(candidate.id) === selectedId);
      return sum + Number(selectedChoice?.price ?? 0);
    }, 0);
  }

  function setProductChoice(itemId, groupId, choiceId) {
    setSelectedProductChoices((state) => {
      const key = String(itemId);
      const current = state[key] ?? {};
      return {
        ...state,
        [key]: {
          ...current,
          [String(groupId)]: String(choiceId)
        }
      };
    });
  }

  function toggleItem(group, item) {
    const key = String(group.id);
    const current = Array.isArray(selectedByGroup[key]) ? selectedByGroup[key] : [];
    const itemKey = String(item.productId);
    const mode = String(group.selectionMode ?? 'checkbox');
    const exists = current.includes(itemKey);

    let next = current;
    if (exists) {
      next = current.filter((candidate) => candidate !== itemKey);
    } else if (mode === 'radio') {
      next = [itemKey];
    } else {
      next = [...current, itemKey];
    }

    setSelectedByGroup((state) => ({
      ...state,
      [key]: next
    }));
  }

  const selectedTotal = useMemo(() => {
    const extraTotal = groups.reduce((sum, group) => (
      sum + getSelectedItems(group).reduce((groupSum, productId) => {
        const item = group.items.find((candidate) => String(candidate.productId) === String(productId));
        if (!item) return groupSum;
        return groupSum + Number(item.extraPrice ?? 0) + getSelectedChoicePrice(item);
      }, 0)
    ), 0);
    return Number((Number(offer?.totalPrice ?? 0) + extraTotal).toFixed(2));
  }, [groups, offer, selectedByGroup, selectedProductChoices]);

  function handleAddToCart() {
    if (!offer || !onAddToCart || !isOfferValid()) return;
    const items = [];

    for (const group of groups) {
      const selectedIds = getSelectedItems(group);
      for (const productId of selectedIds) {
        const item = group.items.find((candidate) => String(candidate.productId) === String(productId));
        if (!item?.product) continue;
        const choiceGroups = getProductChoiceGroups(item);
        const resolvedChoices = getResolvedProductChoices(item);
        const productCustomChoiceSelections = choiceGroups.map((choiceGroup) => {
          const selectedChoiceId = String(resolvedChoices[String(choiceGroup.id)] ?? '');
          const selectedChoice = choiceGroup.items.find((candidate) => String(candidate.id) === selectedChoiceId) ?? null;
          return selectedChoice
            ? {
              groupId: choiceGroup.id,
              groupTitleAr: choiceGroup.titleAr,
              groupTitleEn: choiceGroup.titleEn,
              choiceId: selectedChoice.id,
              choiceLabelAr: selectedChoice.labelAr,
              choiceLabelEn: selectedChoice.labelEn,
              choicePrice: selectedChoice.price
            }
            : null;
        }).filter(Boolean);

        items.push({
          itemId: item.id,
          groupId: group.id,
          groupTitleAr: group.titleAr,
          groupTitleEn: group.titleEn,
          product: item.product,
          extraPrice: Number(item.extraPrice ?? 0),
          selectionMode: String(group.selectionMode ?? 'checkbox'),
          includeProductOptions: Boolean(item.includeProductOptions),
          productCustomChoiceSelections
        });
      }
    }

    if (items.length) {
      onAddToCart({ offer, items, note: String(note ?? '').trim() });
    }
  }

  if (!open || !offer) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative w-full max-w-[820px] overflow-hidden rounded-[28px] bg-[var(--site-card)] text-[var(--site-text)] shadow-[0_30px_100px_rgba(15,23,42,0.35)]"
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
          <div className="px-5 pb-6 pt-14 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="site-heading text-[28px] font-extrabold leading-tight text-[var(--site-text)]">
                  {offer?.nameAr ?? offer?.nameEn ?? ''}
                </h2>
                <p className="mt-1 text-sm font-medium text-[var(--site-muted)]">
                  {offer?.nameEn || (lang === 'ar' ? 'تفاصيل العرض' : 'Offer details')}
                </p>
                {(offer.noteAr || offer.noteEn) ? (
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--site-muted)]">
                    {lang === 'ar' ? (offer.noteAr || offer.noteEn) : (offer.noteEn || offer.noteAr)}
                  </p>
                ) : null}
              </div>
              <div className="rounded-full border px-4 py-2 text-sm font-bold text-[var(--site-button)]" style={{ borderColor: 'var(--site-border)' }}>
                {formatCurrency(selectedTotal)}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--site-muted)]">
              <span className="rounded-full border border-[var(--site-border)] bg-[rgba(255,255,255,0.04)] px-3 py-1.5">
                {lang === 'ar' ? 'السعر يتحدث حسب الاختيارات' : 'Price updates with selections'}
              </span>
            </div>

            {offer.imageUrl ? (
              <div className="mt-4 overflow-hidden rounded-[24px] bg-black/5">
                <img
                  src={resolveMediaUrl(offer.imageUrl)}
                  alt={offer?.nameAr ?? offer?.nameEn ?? 'offer'}
                  className="aspect-[16/9] w-full object-cover"
                />
              </div>
            ) : null}

            <div className="mt-5 space-y-5">
              {groups.map((group) => (
                <section key={group.id} className="rounded-[24px] border border-[var(--site-border)] bg-[var(--site-card)] p-4">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h3 className="flex items-center gap-2 text-lg font-bold text-[var(--site-text)]">
                        <span>{group.titleAr || group.titleEn}</span>
                        {group.required ? (
                          <span
                            className={`px-1 py-0 text-sm font-medium ${
                              isGroupValid(group) ? 'text-[var(--site-muted)]' : 'text-rose-500'
                            }`}
                          >
                            {lang === 'ar' ? 'مطلوب' : 'Required'}
                          </span>
                        ) : null}
                      </h3>
                      <p className="mt-1 text-xs text-[var(--site-muted)]">
                        {group.minSelect}-{group.maxSelect} {lang === 'ar' ? 'اختيارات مطلوبة' : 'required selections'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {group.items.map((item) => {
                      const product = item.product ?? {};
                      const checked = getSelectedItems(group).includes(String(item.productId));
                      const mode = String(group.selectionMode ?? 'checkbox');
                      const productChoiceGroups = getProductChoiceGroups(item);
                      const showProductDetails = Boolean(item.includeProductOptions);
                      const itemChoices = getResolvedProductChoices(item);
                      return (
                        <div
                          key={item.id}
                          className={`rounded-2xl border px-4 py-3 text-right transition ${
                            checked
                              ? 'border-[var(--site-button)] bg-[var(--site-button)]/18 ring-1 ring-[var(--site-button)]/30 shadow-[0_0_0_1px_rgba(215,164,57,0.18)]'
                              : 'border-[var(--site-border)] bg-white/5 hover:bg-black/5'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleItem(group, item)}
                            className="flex w-full items-center justify-between gap-3 text-right transition"
                          >
                            <span className="flex items-center gap-3">
                              <span className="text-sm font-bold text-[var(--site-text)]">
                              {product?.nameAr || product?.nameEn || ''}
                              </span>
                              {Number(item.extraPrice ?? 0) > 0 ? (
                                <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-1 text-[10px] font-bold text-amber-800">
                                  +{formatCurrency(Number(item.extraPrice))}
                                </span>
                              ) : null}
                            </span>
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border text-[11px] font-bold ${
                                checked ? 'border-[var(--site-button)] bg-[var(--site-button)] text-[var(--site-button-text)]' : 'border-[var(--site-border)] text-transparent'
                              }`}
                            >
                              {mode === 'radio' ? (checked ? '◉' : '○') : (checked ? '✓' : '')}
                            </span>
                          </button>

                          {showProductDetails ? (
                            <div className="mt-3 space-y-3 rounded-2xl border border-[var(--site-border)] bg-[rgba(255,255,255,0.04)] p-3">
                              {Number(item.extraPrice ?? 0) > 0 ? (
                                <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-800">
                                  {lang === 'ar' ? 'تكلفة إضافية لهذا المنتج' : 'Extra cost for this product'}: {formatCurrency(Number(item.extraPrice))}
                                </div>
                              ) : null}
                              {product.descriptionAr || product.descriptionEn ? (
                                <p className="text-xs leading-6 text-[var(--site-muted)]">
                                  {lang === 'ar' ? (product.descriptionAr || product.descriptionEn) : (product.descriptionEn || product.descriptionAr)}
                                </p>
                              ) : null}

                              {(Array.isArray(product.ingredients) && product.ingredients.length) ? (
                                <div>
                                  <div className="text-[11px] font-semibold text-[var(--site-muted)]">
                                    {lang === 'ar' ? 'المكونات' : 'Ingredients'}
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {product.ingredients.map((ingredient) => (
                                      <span key={ingredient} className="rounded-full border border-[var(--site-border)] bg-[rgba(255,255,255,0.06)] px-2.5 py-1 text-[11px] text-[var(--site-text)]">
                                        {ingredient}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              {(Array.isArray(product.allergens) && product.allergens.length) ? (
                                <div>
                                  <div className="text-[11px] font-semibold text-[var(--site-muted)]">
                                    {lang === 'ar' ? 'مسببات الحساسية' : 'Allergens'}
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {product.allergens.map((allergen) => (
                                      <span key={allergen} className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                                        {allergen}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              {productChoiceGroups.length ? (
                                <div className="space-y-2">
                                  <div className="text-[11px] font-semibold text-[var(--site-muted)]">
                                    {lang === 'ar' ? 'اختيارات إضافية' : 'Choice groups'}
                                  </div>
                                  {productChoiceGroups.map((choiceGroup) => (
                                    <details key={choiceGroup.id} className="group rounded-xl border border-[var(--site-border)] bg-black/10 px-3 py-2" open={choiceGroup.items.some((candidate) => Boolean(candidate.required))}>
                                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                                        <div className="text-xs font-semibold text-[var(--site-text)]">
                                          {lang === 'ar' ? (choiceGroup.titleAr || choiceGroup.titleEn) : (choiceGroup.titleEn || choiceGroup.titleAr)}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {choiceGroup.items.some((candidate) => Boolean(candidate.required)) ? (
                                            <span className="rounded-full bg-rose-500/15 px-2 py-1 text-[10px] font-bold text-rose-300">
                                              {lang === 'ar' ? 'مطلوب' : 'Required'}
                                            </span>
                                          ) : null}
                                          <span className="text-[10px] font-bold text-[var(--site-muted)] transition group-open:rotate-180">⌄</span>
                                        </div>
                                      </summary>
                                      <div className="mt-2 space-y-2">
                                        {choiceGroup.items.map((choice) => {
                                          const choiceChecked = String(itemChoices[String(choiceGroup.id)] ?? '') === String(choice.id);
                                          return (
                                            <ChoiceRow
                                              key={choice.id}
                                              checked={choiceChecked}
                                              label={lang === 'ar' ? (choice.labelAr || choice.labelEn) : (choice.labelEn || choice.labelAr)}
                                              price={formatCurrency(choice.price)}
                                              lang={lang}
                                              onClick={() => setProductChoice(item.id, choiceGroup.id, choice.id)}
                                            />
                                          );
                                        })}
                                      </div>
                                    </details>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-5 rounded-[24px] border border-[var(--site-border)] bg-[rgba(255,255,255,0.04)] p-4">
              <label className="block space-y-2">
                <span className="block text-xs font-semibold text-[var(--site-muted)]">
                  {lang === 'ar' ? 'ملاحظات العرض' : 'Offer note'}
                </span>
                <textarea
                  rows={3}
                  className="w-full rounded-2xl border border-[var(--site-border)] bg-[var(--site-card)] px-4 py-3 text-sm text-[var(--site-text)] outline-none placeholder:text-[var(--site-muted)]"
                  placeholder={lang === 'ar' ? 'اكتب ملاحظة للعرض إذا أردت' : 'Write a note for this offer if needed'}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[var(--site-border)] bg-[rgba(255,255,255,0.04)] px-4 py-4">
              <div className="text-sm font-semibold text-[var(--site-muted)]">
                {lang === 'ar' ? 'اختر المنتج ثم اختر الاختيارات الداخلية وأضفه إلى السلة' : 'Choose the product, select its options, then add it to cart'}
              </div>
              <div className="text-right text-sm font-bold text-[var(--site-text)]">
                {lang === 'ar' ? 'الإجمالي الآن' : 'Current total'}: {formatCurrency(selectedTotal)}
              </div>
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!isOfferValid()}
                className="rounded-2xl bg-[var(--site-button)] px-5 py-3 text-sm font-bold text-[var(--site-button-text)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {lang === 'ar' ? 'أضف إلى السلة' : 'Add to cart'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
