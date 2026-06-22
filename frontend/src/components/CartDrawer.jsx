import { formatCurrency } from '../lib/format';
import { useLanguage } from '../context/LanguageContext';
import { t } from '../lib/i18n';

export function CartDrawer({ items, onChangeQty, onPlaceOrder, open, onClose, vipDiscount = null, submitting = false }) {
  const { lang } = useLanguage();
  const subtotal = items.reduce((sum, item) => sum + Number(item.effectivePrice) * item.quantity, 0);
  const discountAmount = vipDiscount?.type === 'fixed'
    ? Math.min(Number(vipDiscount.fixedAmount ?? 0), subtotal)
    : vipDiscount?.type === 'percent'
      ? Math.min(Number(((subtotal * Number(vipDiscount.percentage ?? 0)) / 100).toFixed(2)), subtotal)
      : 0;
  const total = Math.max(0, subtotal - discountAmount);
  const discountLabel = vipDiscount?.type === 'fixed'
    ? `${lang === 'ar' ? 'خصم العملاء المميزين' : 'VIP discount'} (${Number(vipDiscount.fixedAmount ?? 0).toFixed(2)})`
    : vipDiscount?.type === 'percent'
      ? `${lang === 'ar' ? 'خصم العملاء المميزين' : 'VIP discount'} (${Number(vipDiscount.percentage ?? 0)}%)`
      : '';

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 bg-black/35 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <aside
        className={`absolute ${lang === 'ar' ? 'left-0' : 'right-0'} top-0 h-full w-[min(100vw,420px)] bg-[var(--site-card)] text-[var(--site-text)] shadow-[0_20px_70px_rgba(15,23,42,0.2)]`}
        style={{ borderInlineStart: '1px solid var(--site-border)' }}
        onClick={(event) => event.stopPropagation()}
        role="presentation"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--site-border)' }}>
            <h3 className="text-lg font-extrabold text-[var(--site-text)]">{t(lang, 'cart')}</h3>
            <button
              type="button"
              className="rounded-full border px-4 py-2 text-sm font-medium text-[var(--site-text)]"
              style={{ borderColor: 'var(--site-border)', background: 'rgba(255,255,255,0.04)' }}
              onClick={onClose}
            >
              إغلاق
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {items.length === 0 ? <p className="text-[var(--site-muted)]">السلة فارغة</p> : null}
            {items.map((item) => (
              <div
                key={item.key ?? item.id}
                className="rounded-2xl border p-3"
                style={{ borderColor: 'var(--site-border)', background: 'rgba(255,255,255,0.04)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[var(--site-text)]">
                      {item.kind === 'offer' ? `${lang === 'ar' ? 'عرض' : 'Offer'}: ${item.title}` : item.title}
                    </p>
                    <p className="mt-1 text-sm text-[var(--site-muted)]">{formatCurrency(item.effectivePrice)}</p>
                    {item.isVipGiftProduct ? (
                      <div className="mt-2 inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                        {lang === 'ar' ? 'هدية مجانية' : 'Free gift'}
                      </div>
                    ) : null}
                    {item.kind === 'offer' ? (
                      <div className="mt-2 space-y-1 text-xs text-[var(--site-muted)]">
                        {(item.selectedOptions?.selectedOfferItems ?? []).map((selection) => (
                          <div key={`${selection.groupId ?? 'group'}:${selection.product?.id ?? 'product'}`}>
                            {lang === 'ar'
                              ? (selection.groupTitleAr || selection.groupTitleEn || 'مجموعة')
                              : (selection.groupTitleEn || selection.groupTitleAr || 'Group')}
                            : {lang === 'ar'
                              ? (selection.product?.nameAr || selection.product?.nameEn || '')
                              : (selection.product?.nameEn || selection.product?.nameAr || '')}
                          </div>
                        ))}
                        {item.selectedOptions?.note ? (
                          <div>{lang === 'ar' ? 'ملاحظة' : 'Note'}: {item.selectedOptions.note}</div>
                        ) : null}
                      </div>
                    ) : item.selectedOptions ? (
                      <div className="mt-2 space-y-1 text-xs text-[var(--site-muted)]">
                        {item.selectedOptions.sizeLabelAr || item.selectedOptions.sizeLabelEn ? (
                          <div>{lang === 'ar' ? 'الحجم' : 'Size'}: {item.selectedOptions.sizeLabelAr || item.selectedOptions.sizeLabelEn}</div>
                        ) : null}
                        {(item.selectedOptions.addonLabelsAr ?? []).length ? (
                          <div>{lang === 'ar' ? 'الإضافات' : 'Add-ons'}: {(item.selectedOptions.addonLabelsAr ?? []).join(', ')}</div>
                        ) : null}
                        {(item.selectedOptions.sideDishLabelsAr ?? []).length ? (
                          <div>{lang === 'ar' ? 'الأطباق الإضافية' : 'Extras'}: {(item.selectedOptions.sideDishLabelsAr ?? []).join(', ')}</div>
                        ) : null}
                        {(item.selectedOptions.customChoiceSelections ?? []).length ? (
                          <div className="space-y-1">
                            {(item.selectedOptions.customChoiceSelections ?? []).map((selection) => {
                              const groupLabel = lang === 'ar'
                                ? (selection.groupTitleAr || selection.groupTitleEn || '')
                                : (selection.groupTitleEn || selection.groupTitleAr || '');
                              const choiceLabel = lang === 'ar'
                                ? (selection.choiceLabelAr || selection.choiceLabelEn || '')
                                : (selection.choiceLabelEn || selection.choiceLabelAr || '');
                              return (
                                <div key={`${selection.groupId ?? 'group'}:${selection.choiceId ?? 'choice'}`}>
                                  {groupLabel ? `${groupLabel}: ` : ''}
                                  {choiceLabel}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                        {item.selectedOptions.note ? (
                          <div>{lang === 'ar' ? 'ملاحظة' : 'Note'}: {item.selectedOptions.note}</div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  {item.isVipGiftProduct ? (
                    <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-sm font-bold text-emerald-700">
                      1
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="h-8 w-8 rounded-full border text-[var(--site-text)]"
                        style={{ borderColor: 'var(--site-border)', background: 'rgba(255,255,255,0.04)' }}
                        onClick={() => onChangeQty(item.key ?? item.id, -1)}
                      >
                        -
                      </button>
                      <span className="min-w-6 text-center text-sm font-semibold">{item.quantity}</span>
                      <button
                        type="button"
                        className="h-8 w-8 rounded-full border text-[var(--site-text)]"
                        style={{ borderColor: 'var(--site-border)', background: 'rgba(255,255,255,0.04)' }}
                        onClick={() => onChangeQty(item.key ?? item.id, 1)}
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 py-4" style={{ borderTop: '1px solid var(--site-border)' }}>
            {discountAmount > 0 ? (
              <div className="mb-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-700">
                <div className="flex items-center justify-between gap-3">
                  <span>{discountLabel}</span>
                  <span>- {formatCurrency(discountAmount)}</span>
                </div>
              </div>
            ) : null}
            <div className="flex items-center justify-between text-base font-bold text-[var(--site-text)]">
              <span>الإجمالي</span>
              <span>{formatCurrency(total)}</span>
            </div>
            <button
              type="button"
              disabled={items.length === 0 || submitting}
              onClick={onPlaceOrder}
              className="site-button mt-4 w-full rounded-2xl px-5 py-4 text-sm font-bold text-[var(--site-button-text)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (lang === 'ar' ? 'جارٍ الإرسال...' : 'Sending...') : t(lang, 'placeOrder')}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
