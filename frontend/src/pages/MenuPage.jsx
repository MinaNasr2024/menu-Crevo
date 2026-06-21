import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { flushSync } from 'react-dom';
import { api } from '../lib/api';
import { applySiteTheme } from '../lib/siteTheme';
import { useLanguage } from '../context/LanguageContext';
import { useTableSession } from '../context/TableSessionContext';
import { ProductCard } from '../components/ProductCard';
import { ProductModal } from '../components/ProductModal';
import { OfferModal } from '../components/OfferModal';
import { WaiterButton } from '../components/WaiterButton';
import { CartDrawer } from '../components/CartDrawer';
import { HeroSection } from '../components/HeroSection';
import { InvoiceReviewDialog } from '../components/InvoiceReviewDialog';
import { resolveMediaUrl } from '../components/ProductMedia';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { notifyLiveChange } from '../lib/liveSync';

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
            onClick={() => scrollByAmount(520)}
            className="absolute right-0 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-2xl text-slate-700 shadow-lg transition hover:bg-slate-50 md:flex"
            aria-label="Scroll previous"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount(-520)}
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
  return lang === 'ar'
    ? (product?.nameAr ?? product?.nameEn ?? '')
    : (product?.nameEn ?? product?.nameAr ?? '');
}

function matchesQuery(product, category, query) {
  if (!query) return true;
  if (!product || !category) return false;
  return [product?.nameAr, product?.nameEn, product?.descriptionAr, product?.descriptionEn, category?.nameAr, category?.nameEn]
    .some((value) => String(value ?? '').toLowerCase().includes(query));
}

const defaultSiteSettings = {
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
  vipCampaign: {
    isActive: false,
    targetMode: 'visits',
    targetTrigger: 10,
    targetAmount: 0,
    rewardType: 'product',
    productRewardId: '',
    productRewardTitleAr: '',
    productRewardTitleEn: '',
    financialDiscountType: 'percent',
    percentage: 10,
    fixedAmount: 50,
    popupTitleAr: 'شكراً لزيارتك المتكررة!',
    popupTitleEn: 'Thank you for returning!',
    popupBodyAr: 'في مرتك القادمة ستحصل على هدية خاصة للعملاء المميزين.',
    popupBodyEn: 'On your next visit, you will receive a special VIP reward.'
  },
  offerGroup: {
    titleAr: '',
    titleEn: '',
    productIds: [],
    price: '',
    isActive: false
  },
  socialLinks: {
    facebook: '',
    instagram: '',
    snapchat: '',
    tiktok: '',
    youtube: ''
  }
};

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

function emptyCartState() {
  return [];
}

function buildSiteSettings(source = {}) {
  return {
    ...defaultSiteSettings,
    ...source,
    heroSlides: Array.isArray(source.heroSlides) ? source.heroSlides.filter(Boolean) : [],
    vipCampaign: {
      ...defaultSiteSettings.vipCampaign,
      ...(source.vipCampaign && typeof source.vipCampaign === 'object' ? source.vipCampaign : {})
    },
    offerGroup: {
      ...defaultSiteSettings.offerGroup,
      ...(source.offerGroup && typeof source.offerGroup === 'object' ? source.offerGroup : {})
    },
    socialLinks: {
      ...defaultSiteSettings.socialLinks,
      ...(source.socialLinks && typeof source.socialLinks === 'object' ? source.socialLinks : {})
    }
  };
}

export function MenuPage() {
  const { lang, setLang } = useLanguage();
  const { table, tableUuid, tableSession, verified, loading: tableLoading, needsPhone, phonePrompt, error: tableError, submitPhone, closeCurrentTable } = useTableSession();
  const location = useLocation();
  const [data, setData] = useState({ categories: [], table: null });
  const [offers, setOffers] = useState([]);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneSubmitting, setPhoneSubmitting] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState('');
  const [clientNotice, setClientNotice] = useState('');
  const [vipState, setVipState] = useState(null);
  const [vipPopup, setVipPopup] = useState('');
  const [vipPopupKey, setVipPopupKey] = useState('');
  const [vipRewardUsed, setVipRewardUsed] = useState(false);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [invoiceReviewOpen, setInvoiceReviewOpen] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [hasPlacedOrder, setHasPlacedOrder] = useState(false);
  const [siteSettings, setSiteSettings] = useState({
    ...defaultSiteSettings
  });
  const [search, setSearch] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState('');
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);
  const hasCurrentOrders = Boolean(data?.table?.hasOrders || table?.hasOrders || hasPlacedOrder);

  async function refreshMenuState() {
    const [menuResult, settingsResult, offersResult] = await Promise.allSettled([
      api.menu({ table: tableUuid, session: tableSession, lang }),
      api.publicSiteSettings(),
      api.publicOffers()
    ]);

    if (menuResult.status === 'fulfilled') {
      setData(menuResult.value);
      setVipState(menuResult.value?.vip ?? null);
    }
    if (settingsResult.status === 'fulfilled') {
      setSiteSettings(buildSiteSettings(settingsResult.value));
    }
    if (offersResult.status === 'fulfilled') {
      setOffers(Array.isArray(offersResult.value) ? offersResult.value : []);
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
        return api.menu({ lang })
          .then((fallback) => {
            if (active) {
              setData(fallback);
              setVipState(fallback?.vip ?? null);
            }
          })
          .catch(() => {});
      });
    return () => {
      active = false;
    };
  }, [tableUuid, tableSession, lang]);

  useRealtimeRefresh(() => {
    refreshMenuState().catch(() => {});
  }, { enabled: true, events: ['data:changed', 'order:new', 'invoice:request:new', 'waiter:call:new'], pollIntervalMs: 0 });

  useEffect(() => {
    applySiteTheme(siteSettings ?? defaultSiteSettings);
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
    const reviewKey = tableUuid && tableSession ? `crevo-table-review:${tableUuid}:${tableSession}` : '';
    if (!reviewKey) {
      setReviewSubmitted(false);
      return;
    }
    try {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(reviewKey) : '';
      setReviewSubmitted(saved === '1');
    } catch {
      setReviewSubmitted(false);
    }
  }, [tableUuid, tableSession]);

  useEffect(() => {
    const rewardKey = tableUuid && tableSession ? `crevo-vip-reward-used:${tableUuid}:${tableSession}` : '';
    if (!rewardKey) {
      setVipRewardUsed(false);
      return;
    }
    try {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(rewardKey) : '';
      setVipRewardUsed(saved === '1');
    } catch {
      setVipRewardUsed(false);
    }
  }, [tableUuid, tableSession]);

  useEffect(() => {
    if (!vipState?.campaign?.isActive || !vipState?.progress) {
      setVipPopup('');
      setVipPopupKey('');
      return;
    }

    const rewardType = String(vipState.campaign?.rewardType ?? 'product');
    const popupKey = `${vipState.progress.phone ?? 'guest'}:${vipState.progress.visitCount ?? 0}:${vipState.progress.stage ?? 'none'}:${rewardType}`;
    const popupMessageAr = rewardType === 'financial'
      ? 'مبروك، لقد حصلت على خصم هدية خاصة للعملاء المميزين.'
      : 'مبروك، لقد حصلت على منتج هدية خاصة للعملاء المميزين.';
    const popupMessageEn = rewardType === 'financial'
      ? 'Congratulations, you received a special VIP discount reward.'
      : 'Congratulations, you received a special VIP product gift.';
    if (vipState.progress.stage === 'reward' && vipPopupKey !== popupKey) {
      setVipPopup(lang === 'ar' ? popupMessageAr : popupMessageEn);
      setVipPopupKey(popupKey);
      window.setTimeout(() => setVipPopup(''), 5000);
    }
    if (vipState.progress.stage !== 'reward' && vipPopup) {
      setVipPopup('');
    }
  }, [vipState, lang, vipPopupKey, vipPopup]);

  useEffect(() => {
    function handleSettingsUpdate(event) {
      if (event.type === 'storage' && event.key !== 'crevo-site-settings-updated') return;
      api.publicSiteSettings()
        .then((settings) => setSiteSettings(buildSiteSettings(settings)))
        .catch(() => {});
    }

    window.addEventListener('storage', handleSettingsUpdate);
    window.addEventListener('crevo-site-settings-updated', handleSettingsUpdate);
    return () => {
      window.removeEventListener('storage', handleSettingsUpdate);
      window.removeEventListener('crevo-site-settings-updated', handleSettingsUpdate);
    };
  }, []);

  const vipRewardProductId = useMemo(
    () => String(vipState?.rewardProduct?.id ?? vipState?.campaign?.productRewardId ?? ''),
    [vipState]
  );

  const hideVipRewardProduct = useMemo(() => Boolean(vipRewardUsed), [vipRewardUsed]);
  const safeMenuCategories = useMemo(
    () => (Array.isArray(data.categories) ? data.categories.filter(Boolean) : []),
    [data.categories]
  );
  const safeOffers = useMemo(() => (Array.isArray(offers) ? offers.filter(Boolean) : []), [offers]);

  const visibleCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    return safeMenuCategories
      .map((category) => {
        const products = (Array.isArray(category?.products) ? category.products.filter(Boolean) : [])
          .filter((product) => product.isAvailable !== false)
          .filter((product) => matchesQuery(product, category, query));
        return {
          ...category,
          title: category?.nameAr || category?.nameEn || '',
          products
        };
      })
      .filter((category) => category.products.length > 0);
  }, [safeMenuCategories, search, hideVipRewardProduct, vipRewardProductId]);

  const featuredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return safeMenuCategories
      .flatMap((category) =>
        (Array.isArray(category?.products) ? category.products.filter(Boolean) : [])
          .filter((product) => product.isAvailable !== false)
          .filter((product) => product.isFeatured !== false)
          .filter((product) => matchesQuery(product, category, query))
          .map((product) => ({
            ...product,
            categoryName: category?.nameAr || category?.nameEn || ''
          }))
      );
  }, [safeMenuCategories, search, hideVipRewardProduct, vipRewardProductId]);

  const activeCategoryTitle = useMemo(() => {
    if (!activeCategoryId) return lang === 'ar' ? 'الكل' : 'All';
    return visibleCategories.find((category) => String(category.id) === String(activeCategoryId))?.title
      ?? (lang === 'ar' ? 'الكل' : 'All');
  }, [activeCategoryId, visibleCategories, lang]);

  const vipRewardProduct = useMemo(() => {
    const canRenderReward = Boolean(
      vipState?.campaign?.isActive
      && vipState?.campaign?.rewardType === 'product'
      && !hideVipRewardProduct
      && vipState?.progress?.isRewardActive
    );
    if (!canRenderReward) return null;
    if (vipState.rewardProduct) return vipState.rewardProduct;
    if (!vipRewardProductId) return null;
    return safeMenuCategories
      .flatMap((category) => Array.isArray(category?.products) ? category.products.filter(Boolean) : [])
      .find((product) => String(product.id) === vipRewardProductId) ?? null;
  }, [safeMenuCategories, hideVipRewardProduct, vipRewardProductId, vipState]);

  const vipRewardActive = Boolean(vipState?.campaign?.isActive && vipState?.progress?.isRewardActive);
  const vipRewardIsFinancial = String(vipState?.campaign?.rewardType ?? '') === 'financial';
  const vipRewardDiscount = vipState?.progress?.discount ?? (vipRewardIsFinancial ? {
    type: String(vipState?.campaign?.financialDiscountType ?? 'percent'),
    percentage: Number(vipState?.campaign?.percentage ?? 0),
    fixedAmount: Number(vipState?.campaign?.fixedAmount ?? 0)
  } : null);

  function addToCart(product) {
    if (!verified || !product) return;
    const selectedOptions = {
      sizeId: product.selectedOptions?.sizeId ?? null,
      sideDishIds: Array.isArray(product.selectedOptions?.sideDishIds) ? [...product.selectedOptions.sideDishIds] : [],
      addonIds: Array.isArray(product.selectedOptions?.addonIds) ? [...product.selectedOptions.addonIds] : [],
      customChoiceSelections: Array.isArray(product.selectedOptions?.customChoiceSelections)
        ? [...product.selectedOptions.customChoiceSelections]
        : [],
      note: String(product.selectedOptions?.note ?? '').trim()
    };
    const title = product.title ?? getProductTitle(product, lang);
    const key = `${product.id}:${JSON.stringify(selectedOptions)}`;
    const vipRewardProductId = String(vipState?.rewardProduct?.id ?? vipState?.campaign?.productRewardId ?? '');
    const isVipGiftProduct = Boolean(
      vipState?.campaign?.isActive
      && vipState?.progress?.isRewardActive
      && vipState?.campaign?.rewardType === 'product'
      && vipRewardProductId
      && String(product.id) === vipRewardProductId
    );
    const effectivePrice = isVipGiftProduct ? 0 : Number(product.effectivePrice ?? product.price ?? 0);
    setCart((current) => {
      const existing = current.find((item) => item.key === key);
      if (existing) {
        if (isVipGiftProduct) {
          return current;
        }
        return current.map((item) => (item.key === key ? { ...item, quantity: item.quantity + 1 } : item));
      }
      return [...current, {
        ...product,
        kind: 'product',
        key,
        title,
        quantity: 1,
        effectivePrice,
        selectedOptions,
        isVipGiftProduct
      }];
    });
    setCartOpen(true);
  }

  function openInvoiceReview() {
    if (!verified || !tableUuid || !hasCurrentOrders) return;
    if (reviewSubmitted) {
      setClientNotice('تم إرسال التقييم مسبقاً لهذه الجلسة');
      window.setTimeout(() => setClientNotice(''), 5000);
      return;
    }
    setInvoiceReviewOpen(true);
  }

  async function submitInvoiceReview(payload) {
    if (!verified || !tableUuid || !tableSession || !hasCurrentOrders) return;
    await api.createCustomerReview({
      tableUuid,
      session: tableSession,
      customerName: payload.customerName,
      ratingMode: payload.ratingMode,
      ratingValue: payload.ratingValue,
      comment: payload.comment
    });
    await api.requestInvoice({ tableUuid, session: tableSession });
    notifyLiveChange({
      entity: 'invoice',
      action: 'requested',
      tableUuid,
      session: tableSession
    });
    try {
      const reviewKey = `crevo-table-review:${tableUuid}:${tableSession}`;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(reviewKey, '1');
      }
    } catch {
      // Ignore storage failures.
    }
    setReviewSubmitted(true);
    setClientNotice('تم إرسال التقييم وطلب الفاتورة');
    window.setTimeout(() => setClientNotice(''), 5000);
  }

  function openProduct(product) {
    if (!product) return;
    setSelectedProduct(product);
    if (verified && tableUuid) {
      api.logProductView({ tableUuid, session: tableSession, productId: product.id }).catch(() => {});
    }
  }

  function addOfferToCart({ offer, items, note = '' }) {
    if (!verified || !offer || !Array.isArray(items) || !items.length) return;
    const selectedOfferItems = items.map((entry) => ({
      itemId: entry.itemId,
      groupId: entry.groupId,
      groupTitleAr: entry.groupTitleAr,
      groupTitleEn: entry.groupTitleEn,
      selectionMode: entry.selectionMode,
      extraPrice: Number(entry.extraPrice ?? 0),
      includeProductOptions: Boolean(entry.includeProductOptions),
      product: entry.product,
      productCustomChoiceSelections: Array.isArray(entry.productCustomChoiceSelections) ? entry.productCustomChoiceSelections : []
    }));
    const extraPriceTotal = Number(items.reduce((sum, entry) => {
      const choiceExtra = Array.isArray(entry.productCustomChoiceSelections)
        ? entry.productCustomChoiceSelections.reduce((choiceSum, choice) => choiceSum + Number(choice.choicePrice ?? 0), 0)
        : 0;
      return sum + Number(entry.extraPrice ?? 0) + choiceExtra;
    }, 0).toFixed(2));
    const totalPrice = Number((Number(offer.totalPrice ?? 0) + extraPriceTotal).toFixed(2));
    const selectedOptions = {
      itemType: 'offer',
      offerId: offer.id,
      offerNameAr: offer.nameAr,
      offerNameEn: offer.nameEn,
      offerNoteAr: offer.noteAr || '',
      offerNoteEn: offer.noteEn || '',
      offerImageUrl: offer.imageUrl || '',
      displayNameAr: offer.nameAr,
      displayNameEn: offer.nameEn,
      displayImageUrl: offer.imageUrl || '',
      note: String(note ?? offer.noteAr ?? offer.noteEn ?? '').trim(),
      selectedOfferItems
    };
    const key = `offer:${offer.id}:${JSON.stringify(selectedOfferItems.map((entry) => ({
      itemId: entry.itemId,
      groupId: entry.groupId,
      productId: entry.product?.id,
      extraPrice: entry.extraPrice,
      includeProductOptions: entry.includeProductOptions,
      productCustomChoiceSelections: entry.productCustomChoiceSelections
    })))}:${String(selectedOptions.note ?? '')}`;
    setCart((current) => {
      const existing = current.find((item) => item.key === key);
      if (existing) {
        return current.map((item) => (item.key === key ? { ...item, quantity: item.quantity + 1 } : item));
      }
      return [...current, {
        kind: 'offer',
        id: `offer-${offer.id}`,
        key,
        title: offer.nameAr,
        note: selectedOptions.note,
        quantity: 1,
        effectivePrice: totalPrice > 0 ? totalPrice : Number(offer.totalPrice ?? 0),
        selectedOptions,
        offer,
        offerItems: selectedOfferItems
      }];
    });
    setSelectedOffer(null);
  }
async function submitOrder({ closeTable = false } = {}) {
  const resolvedTableUuid = tableUuid || table?.qrCodeUuid || table?.qr_code_uuid || '';
  const resolvedSession = tableSession || table?.sessionUuid || table?.session_uuid || '';

  if (!resolvedTableUuid || cart.length === 0 || orderSubmitting) {
    return;
  }
  if (!resolvedTableUuid) {
    setMessage('تعذر تحديد الطاولة الحالية');
    return;
  }

  setOrderSubmitting(true);
  setCartOpen(false);

  try {
    const items = cart.flatMap((item) => {
      if (item.kind === 'offer') {
        const offerSelections = Array.isArray(item.offerItems) ? item.offerItems : [];
        const firstProduct = offerSelections[0]?.product;
        if (!firstProduct) return [];
        return [{
          productId: Number(firstProduct.id),
          quantity: item.quantity,
          unitPrice: Number(item.effectivePrice ?? item.offer?.totalPrice ?? 0),
          selectedOptions: {
            offerId: item.selectedOptions?.offerId ?? null,
            offerNameAr: item.selectedOptions?.offerNameAr ?? '',
            offerNameEn: item.selectedOptions?.offerNameEn ?? '',
            offerNoteAr: item.selectedOptions?.offerNoteAr ?? '',
            offerNoteEn: item.selectedOptions?.offerNoteEn ?? '',
            offerImageUrl: item.selectedOptions?.offerImageUrl ?? item.offer?.imageUrl ?? '',
            displayNameAr: item.selectedOptions?.displayNameAr ?? item.selectedOptions?.offerNameAr ?? '',
            displayNameEn: item.selectedOptions?.displayNameEn ?? item.selectedOptions?.offerNameEn ?? '',
            displayImageUrl: item.selectedOptions?.displayImageUrl ?? item.selectedOptions?.offerImageUrl ?? item.offer?.imageUrl ?? '',
            itemType: item.selectedOptions?.itemType ?? 'offer',
            note: String(item.selectedOptions?.note ?? '').trim(),
            offerGroupSelections: offerSelections.map((entry) => ({
              groupId: entry.groupId,
              groupTitleAr: entry.groupTitleAr,
              groupTitleEn: entry.groupTitleEn,
              selectionMode: entry.selectionMode ?? 'checkbox',
              extraPrice: entry.extraPrice,
              includeProductOptions: entry.includeProductOptions ?? false,
              productId: entry.product?.id ?? null,
              productNameAr: entry.product?.nameAr ?? '',
              productNameEn: entry.product?.nameEn ?? '',
              productDescriptionAr: entry.product?.descriptionAr ?? '',
              productDescriptionEn: entry.product?.descriptionEn ?? '',
              productIngredients: Array.isArray(entry.product?.ingredients) ? entry.product.ingredients : [],
              productAllergens: Array.isArray(entry.product?.allergens) ? entry.product.allergens : [],
              productCustomChoiceGroups: Array.isArray(entry.product?.customChoiceGroups) ? entry.product.customChoiceGroups : [],
              productCustomChoiceSelections: Array.isArray(entry.productCustomChoiceSelections) ? entry.productCustomChoiceSelections : [],
              productCalories: entry.product?.calories ?? null,
              productAverageWaitTime: entry.product?.averageWaitTime ?? null
            }))
          }
        }];
      }

      return [{
        productId: item.id,
        quantity: item.quantity,
        unitPrice: Number(item.effectivePrice ?? item.price ?? 0),
        selectedOptions: {
          sizeId: item.selectedOptions?.sizeId ?? null,
          sideDishIds: Array.isArray(item.selectedOptions?.sideDishIds) ? item.selectedOptions.sideDishIds : [],
          addonIds: Array.isArray(item.selectedOptions?.addonIds) ? item.selectedOptions.addonIds : [],
          customChoiceSelections: Array.isArray(item.selectedOptions?.customChoiceSelections)
            ? item.selectedOptions.customChoiceSelections
            : [],
          note: String(item.selectedOptions?.note ?? '').trim()
        }
      }];
    });

    const payloadItems = items.filter((item) => Number(item?.productId ?? 0) > 0 && Number(item?.quantity ?? 0) > 0);
    if (!payloadItems.length) {
      throw new Error('تعذر تجهيز بيانات الطلب');
    }

    const orderPayload = {
      tableUuid: resolvedTableUuid,
      ...(resolvedSession ? { session: resolvedSession } : {}),
      items: payloadItems
    };

    try {
      await api.placeOrder(orderPayload);
    } catch (placeError) {
      console.error('[MenuPage] placeOrder failed', {
        error: placeError,
        orderPayload
      });
      throw placeError;
    }

    flushSync(() => {
      setCart(emptyCartState());
      setCartOpen(false);
      setHasPlacedOrder(true);
    });

    clearStoredCart(resolvedTableUuid, resolvedSession);

      notifyLiveChange({
        entity: 'order',
        action: 'created',
        tableUuid: resolvedTableUuid,
        session: resolvedSession
      });

    const rewardProductId = Number(vipState?.rewardProduct?.id ?? vipState?.campaign?.productRewardId ?? 0);
    const rewardConsumed = Boolean(
      rewardProductId
      && Array.isArray(items)
      && items.some((item) => Number(item.productId) === rewardProductId)
    );

    if (rewardConsumed && resolvedTableUuid && resolvedSession) {
      const rewardKey = `crevo-vip-reward-used:${resolvedTableUuid}:${resolvedSession}`;
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(rewardKey, '1');
        }
      } catch {
        // Ignore storage failures.
      }

      setVipRewardUsed(true);
      setVipState((current) => (current ? {
        ...current,
        rewardProduct: null,
        progress: {
          ...(current.progress ?? {}),
          stage: 'none',
          isRewardActive: false,
          rewardStatus: 'expired',
          visitCount: 0,
          remaining: current?.progress?.targetTrigger ?? 0,
          rewardSessionUuid: ''
        }
      } : current));
    }

    if (closeTable) {
      try {
        const closed = await closeCurrentTable();
        flushSync(() => {
          setCart(emptyCartState());
          setCartOpen(false);
          setHasPlacedOrder(false);
        });
        if (closed?.vip) {
          setVipState(closed.vip);
        }
        await refreshMenuState().catch(() => {});
        setMessage('تم إرسال الطلب وإغلاق الطاولة');
      } catch (closeError) {
        setMessage(`تم إرسال الطلب، لكن تعذر إغلاق الطاولة: ${closeError.message}`);
      }
    } else {
      await refreshMenuState().catch(() => {});
      setMessage('تم إرسال الطلب بنجاح');
    }
  } catch (error) {
    console.error('[MenuPage] submitOrder failed', error);
    setMessage(error.message);
  } finally {
    setOrderSubmitting(false);
  }
}
  
  async function placeOrder() {
    await submitOrder({ closeTable: false });
  }

  async function requestWaiter() {
    if (!verified || !tableUuid) return;
    try {
      await api.callWaiter({ tableUuid, session: tableSession });
      notifyLiveChange({
        entity: 'waiter-call',
        action: 'created',
        tableUuid,
        session: tableSession
      });
      setClientNotice('تم طلب النادل');
      window.setTimeout(() => setClientNotice(''), 5000);
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
      const result = await submitPhone(phone);
      setVipState(result?.vip ?? null);
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

      <div className="mx-auto w-full max-w-[1300px] px-3 pb-4 pt-[110px] sm:px-4 sm:pt-[120px] md:px-6 lg:px-0 lg:pt-[130px] lg:pb-6">
        {clientNotice ? (
          <div className="fixed left-1/2 top-6 z-[200] w-[min(92vw,440px)] -translate-x-1/2 rounded-[26px] border border-transparent bg-[var(--site-button)] px-5 py-4 text-center text-base font-bold text-[var(--site-button-text)] shadow-[0_22px_60px_rgba(215,164,57,0.38)]">
            {clientNotice}
          </div>
        ) : null}
        {vipPopup ? (
          <div className="fixed left-1/2 top-20 z-[210] w-[min(92vw,560px)] -translate-x-1/2 rounded-[28px] border border-amber-200 bg-[linear-gradient(135deg,rgba(17,19,26,0.96),rgba(35,24,8,0.96))] px-6 py-5 text-center text-white shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="text-xs font-bold uppercase tracking-[0.35em] text-amber-200/80">VIP</div>
            <div className="mt-2 text-2xl font-black">
              {lang === 'ar'
                ? (String(vipState?.campaign?.rewardType ?? 'product') === 'financial'
                  ? 'مبروك، حصلت على خصم هدية'
                  : 'مبروك، حصلت على منتج هدية')
                : (String(vipState?.campaign?.rewardType ?? 'product') === 'financial'
                  ? 'Congratulations, you received a discount gift'
                  : 'Congratulations, you received a product gift')}
            </div>
            <div className="mt-2 text-base leading-7 text-white/90">{vipPopup}</div>
          </div>
        ) : null}
        <section className="site-card sticky top-0 z-40 rounded-[26px] border bg-[var(--site-card)] px-4 py-4 shadow-[0_14px_50px_rgba(15,23,42,0.12)] backdrop-blur md:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="md:hidden">
              <button
                type="button"
                onClick={() => setMobileCategoriesOpen((value) => !value)}
                className="flex w-full items-center justify-between rounded-2xl border border-[var(--site-border)] bg-[var(--site-card)] px-4 py-3 text-right text-sm font-semibold text-[var(--site-text)] shadow-sm"
                aria-expanded={mobileCategoriesOpen}
                aria-controls="mobile-category-menu"
              >
                <span>{activeCategoryTitle}</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--site-border)] bg-white/60 text-lg">
                  {mobileCategoriesOpen ? '×' : '☰'}
                </span>
              </button>

              {mobileCategoriesOpen ? (
                <div id="mobile-category-menu" className="mt-3 rounded-2xl border border-[var(--site-border)] bg-[var(--site-card)] p-2 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategoryId('');
                      setMobileCategoriesOpen(false);
                    }}
                    className={`mb-2 w-full rounded-xl px-4 py-3 text-right text-sm font-semibold transition ${
                      !activeCategoryId ? 'site-button text-[var(--site-button-text)]' : 'bg-[var(--site-card)] text-[var(--site-text)]'
                    }`}
                  >
                    الكل
                  </button>
                  <div className="max-h-[42vh] space-y-2 overflow-y-auto pr-1">
                    {visibleCategories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => {
                          setActiveCategoryId(category.id);
                          setMobileCategoriesOpen(false);
                        }}
                        className={`w-full rounded-xl px-4 py-3 text-right text-sm font-medium transition ${
                          activeCategoryId === category.id
                            ? 'site-button text-[var(--site-button-text)]'
                            : 'bg-[var(--site-card)] text-[var(--site-text)]'
                        }`}
                      >
                        {category.title}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <HorizontalSlider className="hidden w-full lg:max-w-[70%] md:flex">
              <a
                href="#top"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveCategoryId('');
                }}
                className="shrink-0 rounded-full border border-[var(--site-border)] bg-[var(--site-card)] px-4 py-2 text-sm font-semibold text-[var(--site-text)] shadow-sm transition hover:brightness-95"
              >
                الكل
              </a>
              {visibleCategories.map((category) => (
                <a
                  key={category.id}
                  href={`#cat-${category.id}`}
                  onClick={() => setActiveCategoryId(category.id)}
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition hover:brightness-95 ${
                    activeCategoryId === category.id
                      ? 'site-button border-transparent text-[var(--site-button-text)]'
                      : 'border-[var(--site-border)] bg-[var(--site-card)] text-[var(--site-text)]'
                  }`}
                >
                  {category.title}
                </a>
              ))}
            </HorizontalSlider>

            <div className="flex flex-wrap items-center gap-2">
              <WaiterButton verified={verified} onRequest={requestWaiter} className="text-[var(--site-text)] hover:brightness-95" />
              {verified && hasCurrentOrders ? (
                <button
                  type="button"
                  onClick={openInvoiceReview}
                  className="site-button rounded-full px-4 py-2 text-sm font-semibold transition hover:brightness-95"
                >
                  طلب الفاتورة
                </button>
              ) : null}
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

        {vipRewardActive ? (
          <section className="site-card mt-6 rounded-[28px] border border-amber-300/30 bg-[linear-gradient(135deg,rgba(215,164,57,0.16),rgba(255,255,255,0.92))] px-4 py-4 shadow-[0_16px_40px_rgba(215,164,57,0.12)] md:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.3em] text-amber-600/80">VIP Reward</div>
                <h2 className="site-heading mt-1 text-2xl font-extrabold text-[var(--site-heading-color)]">
                  {lang === 'ar'
                    ? (vipRewardIsFinancial ? 'خصم العملاء المميزين' : 'هدية العملاء المميزين')
                    : (vipRewardIsFinancial ? 'VIP customer discount' : 'VIP customer gift')}
                </h2>
                <p className="mt-1 text-sm text-[var(--site-muted)]">
                  {lang === 'ar'
                    ? (vipRewardIsFinancial
                      ? 'الخصم سيُطبّق تلقائياً عند إغلاق الطاولة'
                      : 'خاص بالعملاء المميزين - مجاناً')
                    : (vipRewardIsFinancial
                      ? 'Discount will be applied automatically at checkout'
                      : 'Special VIP reward - free of charge')}
                </p>
                {vipRewardIsFinancial && vipRewardDiscount ? (
                  <div className="mt-3 inline-flex rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-800">
                    {vipRewardDiscount.type === 'fixed'
                      ? (lang === 'ar'
                        ? `خصم ثابت ${Number(vipRewardDiscount.fixedAmount ?? 0).toFixed(2)}`
                        : `Fixed discount ${Number(vipRewardDiscount.fixedAmount ?? 0).toFixed(2)}`)
                      : (lang === 'ar'
                        ? `خصم ${Number(vipRewardDiscount.percentage ?? 0).toFixed(0)}%`
                        : `Discount ${Number(vipRewardDiscount.percentage ?? 0).toFixed(0)}%`)}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {!vipRewardIsFinancial ? (
                  vipRewardProduct ? (
                    <button
                      type="button"
                      onClick={() => setSelectedProduct(vipRewardProduct)}
                      className="site-button rounded-2xl px-4 py-3 text-sm font-semibold transition hover:brightness-95"
                    >
                      {lang === 'ar' ? 'عرض المنتج' : 'View product'}
                    </button>
                  ) : null
                ) : null}
              </div>
            </div>
            {!vipRewardIsFinancial ? (
              vipRewardProduct ? (
                <div className="mt-4 max-w-[320px]">
                  <ProductCard
                    product={vipRewardProduct}
                    onOpen={openProduct}
                    onAdd={addToCart}
                    verified={verified}
                    featured
                  />
                </div>
              ) : null
            ) : (
              <div className="mt-4 rounded-[24px] border border-amber-200 bg-white/80 p-4 text-right shadow-sm">
                <div className="text-sm font-semibold text-amber-700">
                  {lang === 'ar' ? 'المكافأة جاهزة للاستخدام' : 'Reward is ready'}
                </div>
                <div className="mt-2 text-sm leading-7 text-[var(--site-text)]">
                  {lang === 'ar'
                    ? 'عند إغلاق الطاولة سيتم تطبيق الخصم تلقائياً على الفاتورة النهائية.'
                    : 'The discount will be applied automatically to the final invoice when the table is closed.'}
                </div>
              </div>
            )}
          </section>
        ) : null}

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
          {offers.length ? (
            <section className="scroll-mt-8">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="site-heading text-2xl font-extrabold tracking-tight text-[var(--site-heading-color)] md:text-3xl">
                    {lang === 'ar' ? 'العروض' : 'Offers'}
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:hidden">
                {safeOffers.map((offer) => (
                  <article
                    key={offer.id}
                    className="overflow-hidden rounded-[24px] border bg-[var(--site-card)] text-[var(--site-text)] shadow-[0_14px_40px_rgba(15,23,42,0.1)]"
                    style={{ borderColor: 'var(--site-border)' }}
                  >
                    <div className="aspect-[16/10] w-full bg-slate-100">
                      {offer?.imageUrl ? <img src={resolveMediaUrl(offer.imageUrl)} alt={offer?.nameAr ?? offer?.nameEn ?? ''} className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="space-y-2 p-3 text-right">
                      <h3 className="text-[16px] font-bold leading-5">{offer?.nameAr ?? offer?.nameEn ?? ''}</h3>
                      {(offer?.noteAr || offer?.noteEn) ? (
                        <p className="text-[13px] leading-5 text-[var(--site-muted)] line-clamp-2">
                          {offer.noteAr || offer.noteEn}
                        </p>
                      ) : null}
                      <div className="text-[18px] font-black text-[var(--site-button)]">
                        {Number(offer?.totalPrice ?? 0).toFixed(2)}
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedOffer(offer)}
                        className="site-button w-full rounded-2xl px-3 py-2.5 text-[12px] font-semibold transition hover:brightness-105"
                      >
                        {lang === 'ar' ? 'عرض المنتج' : 'View product'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <div className="hidden md:block">
                <HorizontalSlider className="w-full">
                  {safeOffers.map((offer) => (
                    <div key={offer.id} className="snap-start w-[76vw] max-w-[290px] shrink-0">
                      <article
                        className="overflow-hidden rounded-[24px] border bg-[var(--site-card)] text-[var(--site-text)] shadow-[0_14px_40px_rgba(15,23,42,0.1)]"
                        style={{ borderColor: 'var(--site-border)' }}
                      >
                        <div className="aspect-[16/10] w-full bg-slate-100">
                          {offer?.imageUrl ? <img src={resolveMediaUrl(offer.imageUrl)} alt={offer?.nameAr ?? offer?.nameEn ?? ''} className="h-full w-full object-cover" /> : null}
                        </div>
                        <div className="space-y-2 p-3 text-right">
                          <h3 className="text-[16px] font-bold leading-5">{offer?.nameAr ?? offer?.nameEn ?? ''}</h3>
                          {(offer?.noteAr || offer?.noteEn) ? (
                            <p className="text-[13px] leading-5 text-[var(--site-muted)] line-clamp-2">
                              {offer.noteAr || offer.noteEn}
                            </p>
                          ) : null}
                          <div className="text-[18px] font-black text-[var(--site-button)]">
                            {Number(offer?.totalPrice ?? 0).toFixed(2)}
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedOffer(offer)}
                            className="site-button w-full rounded-2xl px-3 py-2.5 text-[12px] font-semibold transition hover:brightness-105"
                          >
                            {lang === 'ar' ? 'عرض المنتج' : 'View product'}
                          </button>
                        </div>
                      </article>
                    </div>
                  ))}
                </HorizontalSlider>
              </div>
            </section>
          ) : null}

          {featuredProducts.length ? (
            <section className="scroll-mt-8">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="site-heading text-2xl font-extrabold tracking-tight text-[var(--site-heading-color)] md:text-3xl">
                    {lang === 'ar' ? 'مميز' : 'Featured'}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--site-muted)]">
                    {lang === 'ar' ? 'المنتجات المختارة للظهور أعلى الصفحة' : 'Selected products shown at the top of the page'}
                  </p>
                </div>
                <div className="text-sm text-[var(--site-muted)]">
                  {lang === 'ar' ? 'اسحب لعرض المزيد' : 'Swipe to see more'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:hidden">
                {featuredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onOpen={openProduct}
                    onAdd={addToCart}
                    verified={verified}
                    featured
                    gridMode
                  />
                ))}
              </div>
              <div className="hidden md:block">
                <HorizontalSlider className="w-full">
                  {featuredProducts.map((product) => (
                    <div key={product.id} className="snap-start">
                      <ProductCard product={product} onOpen={openProduct} onAdd={addToCart} verified={verified} featured />
                    </div>
                  ))}
                </HorizontalSlider>
              </div>
            </section>
          ) : null}

          {visibleCategories.map((category) => (
            <section key={category.id} id={`cat-${category.id}`} className="scroll-mt-8">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="site-heading text-2xl font-extrabold tracking-tight text-[var(--site-heading-color)] md:text-3xl">
                    {category.title}
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:hidden">
                {category.products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onOpen={openProduct}
                    onAdd={addToCart}
                    verified={verified}
                    gridMode
                  />
                ))}
              </div>
              <div className="hidden md:block">
                <HorizontalSlider className="w-full">
                  {category.products.map((product) => (
                    <div key={product.id} className="snap-start">
                      <ProductCard product={product} onOpen={openProduct} onAdd={addToCart} verified={verified} />
                    </div>
                  ))}
                </HorizontalSlider>
              </div>
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

      <OfferModal
        offer={selectedOffer}
        open={Boolean(selectedOffer)}
        onClose={() => setSelectedOffer(null)}
        onAddToCart={addOfferToCart}
        lang={lang}
      />

      <InvoiceReviewDialog
        open={invoiceReviewOpen}
        tablePhone={table?.currentPhone ?? ''}
        defaultName={table?.customerName ?? ''}
        onClose={() => setInvoiceReviewOpen(false)}
        onSubmit={submitInvoiceReview}
      />

      <CartDrawer
        open={cartOpen}
        items={cart}
        onClose={() => setCartOpen(false)}
        onChangeQty={(id, delta) => setCart((current) => current
          .map((item) => (item.key === id ? { ...item, quantity: item.quantity + delta } : item))
          .filter((item) => item.quantity > 0))}
        onPlaceOrder={placeOrder}
        submitting={orderSubmitting}
        vipDiscount={vipRewardActive && vipRewardIsFinancial ? vipRewardDiscount : null}
      />

      {tableUuid && (!verified || needsPhone) ? (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm sm:p-4">
            <form onSubmit={submitTablePhone} className="w-full max-w-[420px] rounded-[28px] bg-white p-5 text-slate-900 shadow-[0_30px_100px_rgba(15,23,42,0.35)]">
              <h3 className="text-2xl font-extrabold text-slate-900">
                {lang === 'ar' ? 'فتح الطاولة' : 'Open table'}
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                {tableLoading
                  ? (lang === 'ar' ? 'جارٍ التحقق من رمز الطاولة...' : 'Verifying table QR...')
                  : (tableError || phonePrompt || (lang === 'ar' ? 'الرجاء إدخال رقم الهاتف لفتح الطاولة' : 'Enter the phone number to open the table'))}
              </p>
            <label className="mt-4 block space-y-2">
              <span className="text-sm font-semibold text-slate-700">{lang === 'ar' ? 'رقم الهاتف' : 'Phone number'}</span>
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
              {phoneSubmitting ? (lang === 'ar' ? 'جارٍ الفتح...' : 'Opening...') : (lang === 'ar' ? 'فتح الطاولة' : 'Open table')}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
