import { formatCurrency } from '../lib/format';
import { useLanguage } from '../context/LanguageContext';
import { t } from '../lib/i18n';

export function CartDrawer({ items, onChangeQty, onPlaceOrder, onPlaceOrderAndClose, open, onClose }) {
  const { lang } = useLanguage();
  const total = items.reduce((sum, item) => sum + Number(item.effectivePrice) * item.quantity, 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/35 backdrop-blur-sm">
      <aside
        className={`absolute ${lang === 'ar' ? 'left-0' : 'right-0'} top-0 h-full w-[min(100vw,420px)] bg-[var(--site-card)] text-[var(--site-text)] shadow-[0_20px_70px_rgba(15,23,42,0.2)]`}
        style={{ borderInlineStart: '1px solid var(--site-border)' }}
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
              <div key={item.id} className="rounded-2xl border p-3" style={{ borderColor: 'var(--site-border)', background: 'rgba(255,255,255,0.04)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[var(--site-text)]">{item.title}</p>
                    <p className="mt-1 text-sm text-[var(--site-muted)]">{formatCurrency(item.effectivePrice)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="h-8 w-8 rounded-full border text-[var(--site-text)]"
                      style={{ borderColor: 'var(--site-border)', background: 'rgba(255,255,255,0.04)' }}
                      onClick={() => onChangeQty(item.id, -1)}
                    >
                      -
                    </button>
                    <span className="min-w-6 text-center text-sm font-semibold">{item.quantity}</span>
                    <button
                      type="button"
                      className="h-8 w-8 rounded-full border text-[var(--site-text)]"
                      style={{ borderColor: 'var(--site-border)', background: 'rgba(255,255,255,0.04)' }}
                      onClick={() => onChangeQty(item.id, 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 py-4" style={{ borderTop: '1px solid var(--site-border)' }}>
            <div className="flex items-center justify-between text-base font-bold text-[var(--site-text)]">
              <span>الإجمالي</span>
              <span>{formatCurrency(total)}</span>
            </div>
            <button
              type="button"
              disabled={items.length === 0}
              onClick={onPlaceOrder}
              className="site-button mt-4 w-full rounded-2xl px-5 py-4 text-sm font-bold text-[var(--site-button-text)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t(lang, 'placeOrder')}
            </button>
            {onPlaceOrderAndClose ? (
              <button
                type="button"
                disabled={items.length === 0}
                onClick={onPlaceOrderAndClose}
                className="mt-3 w-full rounded-2xl border px-5 py-4 text-sm font-bold text-[var(--site-text)] disabled:cursor-not-allowed disabled:opacity-50"
                style={{ borderColor: 'var(--site-border)', background: 'rgba(255,255,255,0.04)' }}
              >
                {lang === 'ar' ? 'إرسال الطلب وإغلاق الطاولة' : 'Place order and close table'}
              </button>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}
