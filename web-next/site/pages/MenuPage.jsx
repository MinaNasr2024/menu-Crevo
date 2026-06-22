import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { applySiteTheme } from '../lib/siteTheme';
import { useLanguage } from '../context/LanguageContext';
import { useTableSession } from '../context/TableSessionContext';
import { ProductCard } from '../components/ProductCard';
import { ProductModal } from '../components/ProductModal';
import { WaiterButton } from '../components/WaiterButton';
import { CartDrawer } from '../components/CartDrawer';
import { HeroSection } from '../components/HeroSection';
import { resolveMediaUrl } from '../components/ProductMedia';

function HorizontalSlider({ children, className = '' }) {
  const railRef = useRef(null);
  const [canScroll, setCanScroll] = useState(false);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return undefined;

    function update() {
      setCanScroll(rail.scrollWidth > rail.clientWidth + 8);
    }

    update();
    const observer = new ResizeObserver(update);
    observer.observe(rail);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [children]);

  function scrollByAmount(delta) {
    railRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  }

  return (
    <div className={`relative ${className}`}>
      {canScroll ? (
        <>
          <button
            type="button"
            onClick={() => scrollByAmount(-520)}
            className="absolute right-0 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-2xl text-slate-700 shadow-lg transition hover:bg-slate-50 md:flex"
            aria-label="Scroll previous"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount(520)}
            className="absolute left-0 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-2xl text-slate-700 shadow-lg transition hover:bg-slate-50 md:flex"
            aria-label="Scroll next"
          >
            ›
          </button>
        </>
      ) : null}
      <div
        ref={railRef}
        className={`flex w-full gap-4 overflow-x-auto pb-4 scroll-smooth scrollbar-none snap-x snap-mandatory ${
          canScroll ? 'pr-12 pl-12' : 'px-0'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function getProductTitle(product, lang) {
  return lang === 'ar' ? product.nameAr : product.nameEn;
}

function matchesQuery(product, category, query) {
  if (!query) return true;
  return [product.nameAr, product.nameEn, product.descriptionAr, product.descriptionEn, category.nameAr, category.nameEn]
    .some((value) => String(value ?? '').toLowerCase().includes(query));
}

function buildSiteSettings(source = {}) {
  return {
    logoUrl: '',
    restaurantName: '',
    restaurantNameAr: '',
    restaurantNameEn: '',
    faviconUrl: '',
    phone: '',
    theme: 'light',
    buttonColor: '#d7a439',
    headingColor: '#10172a',
    headingFont: 'Tajawal',
    bodyFont: 'Tajawal',
    heroSlides: [],
    socialLinks: {
      facebook: '',
      instagram: '',
      snapchat: '',
      tiktok: '',
      youtube: ''
    },
    ...source,
    heroSlides: Array.isArray(source.heroSlides) ? source.heroSlides.filter(Boolean) : [],
    socialLinks: {
      facebook: '',
      instagram: '',
      snapchat: '',
      tiktok: '',
      youtube: '',
      ...(source.socialLinks ?? {})
    }
  };
}

function clearStoredCart(tableUuid, tableSession) {
  if (typeof window === 'undefined') return;
  const exactKey = `crevo-cart:${String(tableUuid ?? '').trim()}:${String(tableSession ?? '').trim()}`;
  try {
    window.localStorage.removeItem(exactKey);
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key && key.startsWith('crevo-cart:')) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore storage failures.
  }
}

export function MenuPage() {
  const { lang, setLang } = useLanguage();
  const { tableUuid, tableSession, verified, loading: tableLoading, needsPhone, error: tableError, submitPhone, closeCurrentTable } = useTableSession();
  const location = useLocation();
  const [data, setData] = useState({ categories: [], table: null });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneSubmitting, setPhoneSubmitting] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState('');
  const [siteSettings, setSiteSettings] = useState({
    logoUrl: '',
    restaurantName: '',
    restaurantNameAr: '',
    restaurantNameEn: '',
    faviconUrl: '',
    phone: '',
    theme: 'light',
    buttonColor: '#d7a439',
    headingColor: '#10172a',
    headingFont: 'Tajawal',
    bodyFont: 'Tajawal',
    heroSlides: [],
    socialLinks: {
      facebook: '',
      instagram: '',
      snapchat: '',
      tiktok: '',
      youtube: ''
    }
  });
  const [search, setSearch] = useState('');

  async function refreshMenuState() {
    const [menuResult, settingsResult] = await Promise.allSettled([
      api.menu({ table: tableUuid, session: tableSession, lang }),
      api.publicSiteSettings()
    ]);
    if (menuResult.status === 'fulfilled') {
      setData(menuResult.value);
    }
    if (settingsResult.status === 'fulfilled') {
      setSiteSettings(buildSiteSettings(settingsResult.value));
    }
    if (menuResult.status === 'rejected') {
      throw menuResult.reason;
    }
    return menuResult.value;
  }

  useEffect(() => {
    setLang('ar');
  }, [setLang]);

  useEffect(() => {
    let active = true;
    refreshMenuState()
      .catch((error) => {
        if (!active) return;
        setMessage(error.message);
        api.menu({ lang })
          .then((fallback) => {
            if (active) setData(fallback);
          })
          .catch(() => {});
      });
    return () => {
      active = false;
    };
  }, [tableUuid, tableSession, lang]);

  useEffect(() => {
    applySiteTheme(siteSettings);
  }, [siteSettings.buttonColor, siteSettings.headingColor, siteSettings.headingFont, siteSettings.bodyFont, siteSettings.theme]);

  useEffect(() => {
    const iconHref = siteSettings.faviconUrl ? resolveMediaUrl(siteSettings.faviconUrl) : '';
    let link = document.querySelector('link[data-site-favicon]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      link.setAttribute('data-site-favicon', 'true');
      document.head.appendChild(link);
    }
    if (iconHref) {
      link.href = iconHref;
    } else if (link.parentNode) {
      link.parentNode.removeChild(link);
    }
  }, [siteSettings.faviconUrl]);

  useEffect(() => {
    const productId = new URLSearchParams(location.search).get('product');
    if (!productId || !data.categories.length) return;
    const match = data.categories
      .flatMap((category) => category.products ?? [])
      .find((product) => String(product.id) === String(productId));
    if (match) setSelectedProduct(match);
  }, [location.search, data.categories]);

  useEffect(() => {
    function handleSettingsUpdate(event) {
      if (event.type === 'storage' && event.key !== 'crevo-site-settings-updated') return;
      api.publicSiteSettings()
        .then((settings) => setSiteSettings({
          logoUrl: '',
          restaurantName: '',
          restaurantNameAr: '',
          restaurantNameEn: '',
          faviconUrl: '',
          phone: '',
          theme: 'light',
          buttonColor: '#d7a439',
          headingColor: '#10172a',
          headingFont: 'Tajawal',
          bodyFont: 'Tajawal',
          heroSlides: [],
          ...settings,
          socialLinks: {
            facebook: '',
            instagram: '',
            snapchat: '',
            tiktok: '',
            youtube: '',
            ...(settings?.socialLinks ?? {})
          }
        }))
        .catch(() => {});
    }

    window.addEventListener('storage', handleSettingsUpdate);
    window.addEventListener('crevo-site-settings-updated', handleSettingsUpdate);
    return () => {
      window.removeEventListener('storage', handleSettingsUpdate);
      window.removeEventListener('crevo-site-settings-updated', handleSettingsUpdate);
    };
  }, []);

  const visibleCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.categories
      .map((category) => {
        const products = (category.products ?? []).filter((product) => matchesQuery(product, category, query));
        return {
          ...category,
          title: category.nameAr || category.nameEn,
          products
        };
      })
      .filter((category) => category.products.length > 0);
  }, [data.categories, search]);

  function addToCart(product) {
    if (!verified) return;
    const title = getProductTitle(product, lang);
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
      }
      return [...current, {
        ...product,
        title,
        quantity: 1,
        effectivePrice: product.isDiscounted && product.discountPrice ? product.discountPrice : product.price
      }];
    });
    setCartOpen(true);
  }

  function openProduct(product) {
    setSelectedProduct(product);
    if (verified && tableUuid) {
      api.logProductView({ tableUuid, session: tableSession, productId: product.id }).catch(() => {});
    }
  }

  async function submitOrder({ closeTable = false } = {}) {
    if (!verified || !tableUuid || cart.length === 0) return;
    try {
      const resolvedTableUuid = tableUuid || table?.qrCodeUuid || '';
      const resolvedSession = tableSession || table?.sessionUuid || '';
      await api.placeOrder({
        tableUuid: resolvedTableUuid,
        ...(resolvedSession ? { session: resolvedSession } : {}),
        items: cart.map((item) => ({ productId: item.id, quantity: item.quantity }))
      });
      setCart([]);
      setCartOpen(false);
      clearStoredCart(resolvedTableUuid, resolvedSession);
      if (closeTable) {
        await closeCurrentTable();
        await refreshMenuState().catch(() => {});
        setCart([]);
        setCartOpen(false);
        setMessage('تم إرسال الطلب وإغلاق الطاولة');
      } else {
        await refreshMenuState().catch(() => {});
        setMessage('تم إرسال الطلب بنجاح');
      }
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function placeOrder() {
    await submitOrder({ closeTable: false });
  }

  async function placeOrderAndClose() {
    await submitOrder({ closeTable: true });
  }

  async function requestWaiter() {
    if (!verified || !tableUuid) return;
    try {
      await api.callWaiter({ tableUuid, session: tableSession });
      setMessage('تم إرسال طلب النادل');
    } catch (error) {
      setMessage(error.message);
    }
  }

  function resetSearch() {
    setSearch('');
  }

  async function submitTablePhone(event) {
    event.preventDefault();
    setPhoneSubmitting(true);
    setPhoneMessage('');
    try {
      await submitPhone(phone);
      setPhone('');
    } catch (error) {
      setPhoneMessage(error.message);
    } finally {
      setPhoneSubmitting(false);
    }
  }

  return (
    <div className="site-surface min-h-screen bg-[var(--site-bg)] text-[var(--site-text)]">
      <section className="relative">
        <HeroSection settings={siteSettings} language={lang} />
      </section>

      <div className="mx-auto w-full max-w-[1500px] px-3 py-4 sm:px-4 md:px-6 lg:px-0 lg:py-6">
        <section className="site-card sticky top-3 z-30 rounded-[26px] border bg-[var(--site-card)] px-4 py-4 shadow-[0_14px_50px_rgba(15,23,42,0.12)] backdrop-blur md:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <HorizontalSlider className="w-full lg:max-w-[70%]">
              <a
                href="#top"
                onClick={(e) => e.preventDefault()}
                className="site-button shrink-0 rounded-full px-4 py-2 text-sm font-semibold shadow-sm"
              >
                الكل
              </a>
              {visibleCategories.map((category) => (
                <a
                  key={category.id}
                  href={`#cat-${category.id}`}
                  className="shrink-0 rounded-full border border-[var(--site-border)] bg-[var(--site-card)] px-4 py-2 text-sm font-medium text-[var(--site-text)] transition hover:brightness-95"
                >
                  {category.title}
                </a>
              ))}
            </HorizontalSlider>

            <div className="flex flex-wrap items-center gap-2">
              <WaiterButton
                verified={verified}
                onRequest={requestWaiter}
                className="text-[var(--site-text)] hover:brightness-95"
              />
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="site-button rounded-full px-4 py-2 text-sm font-semibold transition hover:brightness-95"
              >
                السلة ({cart.length})
              </button>
            </div>
          </div>
        </section>

        <section className="site-card mt-6 rounded-[26px] border bg-[var(--site-card)] px-4 py-4 shadow-[0_14px_50px_rgba(15,23,42,0.08)] md:px-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px] lg:items-end">
            <div>
              <div className="site-heading mb-2 text-sm font-semibold text-[var(--site-heading-color)]">ابحث عن أطباقك المفضلة</div>
              <div className="relative">
                <input
                  className="w-full rounded-2xl border border-[var(--site-border)] bg-white px-4 py-4 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-white"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="اسم الطبق أو وصفه..."
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={resetSearch}
                className="site-button rounded-2xl px-4 py-3 text-sm font-semibold transition hover:brightness-95"
              >
                إعادة التصفية
              </button>
              <button
                type="button"
                className="rounded-2xl border border-[var(--site-border)] bg-[var(--site-card)] px-4 py-3 text-sm font-semibold text-[var(--site-text)] transition hover:brightness-95"
              >
                الفلاتر
              </button>
            </div>
          </div>
        </section>

        {message ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-sm">
            {message}
          </div>
        ) : null}

        {tableError ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 shadow-sm">
            {tableError}
          </div>
        ) : null}

        <main id="top" className="mt-8 space-y-12 pb-16">
          {visibleCategories.map((category) => (
            <section key={category.id} id={`cat-${category.id}`} className="scroll-mt-8">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="site-heading text-2xl font-extrabold tracking-tight text-[var(--site-heading-color)] md:text-3xl">
                    {category.title}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--site-muted)]">{category.products.length} منتج</p>
                </div>
                <div className="text-sm text-[var(--site-muted)]">اسحب لعرض المزيد</div>
              </div>

              <HorizontalSlider className="w-full">
                {category.products.map((product) => (
                  <div key={product.id} className="snap-start">
                    <ProductCard product={product} onOpen={openProduct} onAdd={addToCart} verified={verified} />
                  </div>
                ))}
              </HorizontalSlider>
            </section>
          ))}

          {visibleCategories.length === 0 ? (
            <div className="site-card mt-8 rounded-[24px] border border-dashed px-6 py-12 text-center text-[var(--site-muted)] shadow-sm">
              لا توجد منتجات مطابقة للبحث الحالي.
            </div>
          ) : null}
        </main>
      </div>

      <ProductModal
        product={selectedProduct}
        open={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        onAdd={addToCart}
        verified={verified}
      />

      <CartDrawer
        open={cartOpen}
        items={cart}
        onClose={() => setCartOpen(false)}
        onChangeQty={(id, delta) => setCart((current) => current
          .map((item) => (item.id === id ? { ...item, quantity: item.quantity + delta } : item))
          .filter((item) => item.quantity > 0))}
        onPlaceOrder={placeOrder}
        onPlaceOrderAndClose={placeOrderAndClose}
      />

      {tableUuid && needsPhone && !verified ? (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm sm:p-4">
            <form onSubmit={submitTablePhone} className="w-full max-w-[420px] rounded-[28px] bg-white p-5 text-slate-900 shadow-[0_30px_100px_rgba(15,23,42,0.35)]">
              <h3 className="text-2xl font-extrabold text-slate-900">فتح الطاولة</h3>
              <p className="mt-2 text-sm text-slate-600">
                {tableLoading
                  ? 'جارٍ التحقق من رمز الطاولة...'
                  : (tableError || 'أدخل رقم الهاتف لفتح الطاولة ومتابعة الطلب.')}
              </p>
            <label className="mt-4 block space-y-2">
              <span className="text-sm font-semibold text-slate-700">رقم الهاتف</span>
              <input
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[var(--site-button)]"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01xxxxxxxxx"
              />
            </label>
            {phoneMessage ? <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{phoneMessage}</div> : null}
            <button
              type="submit"
              disabled={phoneSubmitting}
              className="mt-4 w-full rounded-2xl bg-[var(--site-button)] px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {phoneSubmitting ? 'جارٍ الفتح...' : 'فتح الطاولة'}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
