import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { api, getApiBase, getSocketBase } from '../lib/api';
import { StatCard } from '../components/StatCard';
import { LineBars } from '../components/LineBars';
import { AdminShell } from '../components/AdminShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useLanguage } from '../context/LanguageContext';
import { Toast } from '../components/Toast';
import { resolveMediaUrl } from '../components/ProductMedia';
import { applySiteTheme } from '../lib/siteTheme';
import { useWindowDataChanged } from '../hooks/useWindowDataChanged';
import { notifyLiveChange } from '../lib/liveSync';

async function fileToUploadPayload(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('تعذر قراءة الملف'));
    reader.readAsDataURL(file);
  });
  const uploaded = await api.upload({ fileData: String(dataUrl), fileName: file.name });
  return uploaded.url;
}

function Field({ label, children, hint }) {
  return (
    <label className="block space-y-2">
      <span className="block text-sm font-medium text-white/75">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-white/45">{hint}</span> : null}
    </label>
  );
}

function extractCustomerNote(selectedOptions = {}) {
  const source = selectedOptions && typeof selectedOptions === 'object' ? selectedOptions : {};
  const candidates = [
    source.note,
    source.customerNote,
    source.notes,
    source.comment,
    source.comments,
    source.remark,
    source.remarks
  ];
  return candidates.map((value) => String(value ?? '').trim()).find(Boolean) || '';
}

function extractCustomChoices(selectedOptions = {}) {
  const source = selectedOptions && typeof selectedOptions === 'object' ? selectedOptions : {};
  return Array.isArray(source.customChoiceSelections) ? source.customChoiceSelections : [];
}

function offerSelectionGroups(item = {}, lang = 'ar') {
  const selectedOptions = item.selectedOptions && typeof item.selectedOptions === 'object' ? item.selectedOptions : {};
  const rawSelections = Array.isArray(selectedOptions.offerGroupSelections) && selectedOptions.offerGroupSelections.length
    ? selectedOptions.offerGroupSelections
    : Array.isArray(selectedOptions.selectedOfferItems)
      ? selectedOptions.selectedOfferItems
      : [];
  return rawSelections.map((selection, index) => {
    const fallbackTitle = lang === 'ar' ? `مجموعة العرض ${index + 1}` : `Offer group ${index + 1}`;
    const title = lang === 'ar'
      ? (selection.groupTitleAr || selection.groupTitleEn || fallbackTitle)
      : (selection.groupTitleEn || selection.groupTitleAr || fallbackTitle);
    const valueBase = lang === 'ar'
      ? (selection.productNameAr || selection.productNameEn || '')
      : (selection.productNameEn || selection.productNameAr || '');
    const extra = Number(selection.extraPrice ?? 0);
    const details = [];
    const description = lang === 'ar'
      ? (selection.productDescriptionAr || selection.productDescriptionEn || '')
      : (selection.productDescriptionEn || selection.productDescriptionAr || '');
    const ingredients = Array.isArray(selection.productIngredients) ? selection.productIngredients.filter(Boolean) : [];
    const allergens = Array.isArray(selection.productAllergens) ? selection.productAllergens.filter(Boolean) : [];
    const customGroups = Array.isArray(selection.productCustomChoiceGroups)
      ? selection.productCustomChoiceGroups.map((group) => {
        const groupTitle = lang === 'ar'
          ? (group.titleAr || group.titleEn || '')
          : (group.titleEn || group.titleAr || '');
        const choices = Array.isArray(group.items)
          ? group.items.map((choice) => (lang === 'ar' ? (choice.labelAr || choice.labelEn || '') : (choice.labelEn || choice.labelAr || ''))).filter(Boolean)
          : [];
        if (!groupTitle && !choices.length) return null;
        return {
          title: groupTitle || (lang === 'ar' ? 'حقل اختياري' : 'Custom field'),
          value: choices.join('، ')
        };
      }).filter(Boolean)
      : [];

    if (selection.includeProductOptions && description) {
      details.push({ title: lang === 'ar' ? 'الوصف' : 'Description', value: description });
    }
    if (selection.includeProductOptions && ingredients.length) {
      details.push({ title: lang === 'ar' ? 'المكونات' : 'Ingredients', value: ingredients.join('، ') });
    }
    if (selection.includeProductOptions && allergens.length) {
      details.push({ title: lang === 'ar' ? 'مسببات الحساسية' : 'Allergens', value: allergens.join('، ') });
    }
    if (selection.includeProductOptions && customGroups.length) {
      details.push(...customGroups);
    }
    if (selection.includeProductOptions && selection.productCalories != null) {
      details.push({ title: lang === 'ar' ? 'السعرات' : 'Calories', value: String(selection.productCalories) });
    }
    if (selection.includeProductOptions && selection.productAverageWaitTime != null) {
      details.push({ title: lang === 'ar' ? 'متوسط الانتظار' : 'Average wait', value: String(selection.productAverageWaitTime) });
    }

    return {
      title,
      value: extra > 0 ? `${valueBase} (+EGP ${extra.toFixed(2)})` : valueBase,
      details
    };
  }).filter((group) => group.title || group.value);
}

function isOfferItem(item = {}) {
  const selectedOptions = item.selectedOptions && typeof item.selectedOptions === 'object' ? item.selectedOptions : {};
  return Boolean(
    String(item.itemType ?? '').toLowerCase() === 'offer'
    || String(selectedOptions.itemType ?? '').toLowerCase() === 'offer'
    || item.offerId
    || item.displayNameAr
    || item.displayNameEn
    || item.displayImageUrl
    || selectedOptions.offerId
    || selectedOptions.displayNameAr
    || selectedOptions.displayNameEn
    || selectedOptions.offerNameAr
    || selectedOptions.offerNameEn
    || Array.isArray(selectedOptions.offerGroupSelections) && selectedOptions.offerGroupSelections.length
  );
}

function getItemDisplayName(item = {}) {
  const selectedOptions = item.selectedOptions && typeof item.selectedOptions === 'object' ? item.selectedOptions : {};
  if (isOfferItem(item)) {
    return item.displayNameAr
      || selectedOptions.displayNameAr
      || selectedOptions.offerNameAr
      || item.displayNameEn
      || selectedOptions.displayNameEn
      || selectedOptions.offerNameEn
      || 'العرض';
  }
  return item.product?.nameAr ?? item.product?.nameEn ?? 'منتج';
}

function calculateVipDiscount(vipData, tablePhone, subtotal) {
  const campaign = vipData?.campaign ?? {};
  const progress = vipData?.progress ?? {};
  if (!campaign.isActive || campaign.rewardType !== 'financial' || !progress.isRewardActive) return { amount: 0, label: '' };
  if (campaign.financialDiscountType === 'fixed') {
    return {
      amount: Math.min(Number(campaign.fixedAmount ?? 0), subtotal),
      label: 'خصم العملاء المميزين'
    };
  }
  const amount = Number(((subtotal * Number(campaign.percentage ?? 0)) / 100).toFixed(2));
  return {
    amount: Math.min(amount, subtotal),
    label: 'خصم العملاء المميزين'
  };
}

const inputClass = 'w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition placeholder:text-white/25 focus:border-gold';

export function AdminDashboardPage() {
  try {
    if (typeof window !== 'undefined') {
      window.__crevoAdminRendered = true;
    }
  } catch {
    // Ignore debug failures.
  }

  const navigate = useNavigate();
  const { setLang } = useLanguage();
  const [summary, setSummary] = useState(null);
  const [calls, setCalls] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [peakHours, setPeakHours] = useState([]);
  const [revenue, setRevenue] = useState([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [invoicePanelOpen, setInvoicePanelOpen] = useState(false);
  const [activeTable, setActiveTable] = useState(null);
  const [invoiceTable, setInvoiceTable] = useState(null);
  const [invoicePrintTable, setInvoicePrintTable] = useState(null);
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
    socialLinks: {
      facebook: '',
      instagram: '',
      snapchat: '',
      tiktok: '',
      youtube: ''
    }
  });
  const [toast, setToast] = useState(null);
  const [selectedTableId, setSelectedTableId] = useState(null);
  const siteSettingsRef = useRef(siteSettings);
  const refreshSeqRef = useRef(0);

  useEffect(() => {
    siteSettingsRef.current = siteSettings;
  }, [siteSettings]);

  function syncSiteSettings(nextSettings) {
    siteSettingsRef.current = nextSettings;
    setSiteSettings(nextSettings);
  }

  useEffect(() => {
    setLang('ar');
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'ar';
  }, [setLang]);

  async function refresh({ loadOrders = false, loadAnalytics = false } = {}) {
    const refreshSeq = ++refreshSeqRef.current;
    const requests = [
      api.adminSummary(),
      api.tables(),
      api.waiterCalls(),
      api.publicSiteSettings(),
      loadOrders ? api.orders() : Promise.resolve([]),
      loadAnalytics ? api.topProducts({ bucket: 'day' }) : Promise.resolve([]),
      loadAnalytics ? api.peakHours({ bucket: 'day' }) : Promise.resolve([]),
      loadAnalytics ? api.revenue({ bucket: 'day' }) : Promise.resolve([])
    ];
    const [summaryResult, tableResult, callResult, settingsResult, orderResult, topResult, peakResult, revResult] = await Promise.allSettled(requests);
    if (refreshSeq !== refreshSeqRef.current) return;
    setSummary(summaryResult.status === 'fulfilled' ? summaryResult.value : null);
    setTables(tableResult.status === 'fulfilled' && Array.isArray(tableResult.value) ? tableResult.value : []);
    setCalls(callResult.status === 'fulfilled' && Array.isArray(callResult.value) ? callResult.value.filter((call) => call.status !== 'completed') : []);
    if (loadOrders) {
      setOrders(orderResult.status === 'fulfilled' && Array.isArray(orderResult.value) ? orderResult.value : []);
      setOrdersLoaded(true);
    }
    if (loadAnalytics) {
      setTopProducts(topResult.status === 'fulfilled' && Array.isArray(topResult.value) ? topResult.value : []);
      setPeakHours(peakResult.status === 'fulfilled' && Array.isArray(peakResult.value) ? peakResult.value : []);
      setRevenue(revResult.status === 'fulfilled' && Array.isArray(revResult.value) ? revResult.value : []);
      setAnalyticsLoaded(true);
    }
    setActiveTable((current) => {
      const tableData = tableResult.status === 'fulfilled' && Array.isArray(tableResult.value) ? tableResult.value : [];
      if (!tableData.length) return null;
      if (!current) return tableData[0] ?? null;
      const preserved = tableData.find((table) => String(table.id) === String(current.id));
      return preserved ?? tableData[0] ?? current ?? null;
    });
    const settings = settingsResult.status === 'fulfilled' ? settingsResult.value : null;
    syncSiteSettings({
      ...siteSettingsRef.current,
      ...(settings && typeof settings === 'object' ? settings : {}),
      heroSlides: Array.isArray(settings?.heroSlides) ? settings.heroSlides : [],
      vipCampaigns: Array.isArray(settings?.vipCampaigns) ? settings.vipCampaigns : [],
      socialLinks: {
        facebook: String(settings?.socialLinks?.facebook ?? '').trim(),
        instagram: String(settings?.socialLinks?.instagram ?? '').trim(),
        snapchat: String(settings?.socialLinks?.snapchat ?? '').trim(),
        tiktok: String(settings?.socialLinks?.tiktok ?? '').trim(),
        youtube: String(settings?.socialLinks?.youtube ?? '').trim()
      }
    });
  }

  async function refreshCore() {
    await refresh({ loadOrders: false, loadAnalytics: false });
  }

  useEffect(() => {
    refreshCore().catch((error) => setToast({ type: 'error', title: 'خطأ', description: error.message }));
    const interval = window.setInterval(() => {
      refresh({
        loadOrders: ordersLoaded,
        loadAnalytics: analyticsLoaded
      }).catch(() => {});
    }, 5000);
    return () => {
      window.clearInterval(interval);
    };
  }, [analyticsLoaded, ordersLoaded]);

  useWindowDataChanged(() => {
    refreshCore().catch(() => {});
  });

  useEffect(() => {
    let socket;
    let mounted = true;

    try {
      socket = io(getSocketBase() || getApiBase(), { transports: ['websocket'] });
      const handleLiveUpdate = (payload = {}) => {
        if (!mounted) return;
        refresh({
          loadOrders: ordersLoaded && String(payload?.entity ?? '') === 'order',
          loadAnalytics: false
        }).catch(() => {});
      };

      socket.on('connect', handleLiveUpdate);
      socket.on('order:new', handleLiveUpdate);
      socket.on('invoice:request:new', handleLiveUpdate);
      socket.on('waiter:call:new', handleLiveUpdate);
      socket.emit('join:admin');
    } catch {
      return () => {
        mounted = false;
        socket?.disconnect();
      };
    }

    return () => {
      mounted = false;
      socket?.disconnect();
    };
  }, [analyticsLoaded, ordersLoaded]);

  const selectedTable = useMemo(() => activeTable ?? tables[0] ?? null, [activeTable, tables]);
  const openTables = useMemo(() => tables.filter((table) => table.currentPhone), [tables]);
  const invoiceTables = useMemo(() => tables.filter((table) => table.invoiceRequestedAt), [tables]);
  const ordersByTableId = useMemo(() => {
    const map = new Map();
    for (const order of orders) {
      const key = String(order?.table?.id ?? '');
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(order);
      map.set(key, list);
    }
    return map;
  }, [orders]);

  const invoiceTableOrders = useMemo(() => {
    if (!invoiceTable) return [];
    const tableOrders = ordersByTableId.get(String(invoiceTable.id)) ?? [];
    const activeOrderNumber = Number(invoiceTable.activeOrderNumber ?? 0);
    const openedAt = invoiceTable.openedAt ? new Date(invoiceTable.openedAt).getTime() : null;
    const currentOrders = activeOrderNumber
      ? tableOrders.filter((order) => Number(order.orderNumber ?? 0) === activeOrderNumber)
      : openedAt
        ? tableOrders.filter((order) => {
          const createdAt = order?.createdAt ? new Date(order.createdAt).getTime() : 0;
          return createdAt >= openedAt;
        })
        : tableOrders;
    return currentOrders.sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
  }, [invoiceTable, ordersByTableId]);

  async function loadInvoiceOrders() {
    try {
      setInvoicePanelOpen(true);
      await refresh({
        loadOrders: true,
        loadAnalytics: false
      });
    } catch (error) {
      setToast({ type: 'error', title: 'خطأ', description: error.message });
    }
  }

  async function loadAnalyticsData() {
    try {
      setAnalyticsOpen(true);
      await refresh({
        loadOrders: false,
        loadAnalytics: true
      });
    } catch (error) {
      setToast({ type: 'error', title: 'خطأ', description: error.message });
    }
  }

  async function saveBranding() {
    try {
      const currentSettings = siteSettingsRef.current;
      const savedSettings = await api.updateSiteSettings({
        ...currentSettings,
        restaurantNameAr: String(currentSettings.restaurantNameAr ?? '').trim(),
        restaurantNameEn: String(currentSettings.restaurantNameEn ?? '').trim(),
        restaurantName: String(currentSettings.restaurantNameAr ?? '').trim()
          || String(currentSettings.restaurantNameEn ?? '').trim(),
        logoUrl: String(currentSettings.logoUrl ?? '').trim(),
        faviconUrl: String(currentSettings.faviconUrl ?? '').trim(),
        phone: String(currentSettings.phone ?? '').trim(),
        theme: currentSettings.theme === 'dark' ? 'dark' : 'light',
        buttonColor: String(currentSettings.buttonColor ?? '#d7a439').trim() || '#d7a439',
        headingColor: String(currentSettings.headingColor ?? '#10172a').trim() || '#10172a',
        headingFont: String(currentSettings.headingFont ?? 'Tajawal').trim() || 'Tajawal',
        bodyFont: String(currentSettings.bodyFont ?? 'Tajawal').trim() || 'Tajawal',
        heroSlides: Array.isArray(currentSettings.heroSlides) ? currentSettings.heroSlides.filter(Boolean) : [],
        vipCampaigns: Array.isArray(currentSettings.vipCampaigns) ? currentSettings.vipCampaigns : [],
        socialLinks: {
          facebook: String(currentSettings.socialLinks?.facebook ?? '').trim(),
          instagram: String(currentSettings.socialLinks?.instagram ?? '').trim(),
          snapchat: String(currentSettings.socialLinks?.snapchat ?? '').trim(),
          tiktok: String(currentSettings.socialLinks?.tiktok ?? '').trim(),
          youtube: String(currentSettings.socialLinks?.youtube ?? '').trim()
        }
      });
      syncSiteSettings(savedSettings);
      applySiteTheme(savedSettings);
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('crevo-site-settings-updated', String(Date.now()));
        }
      } catch {
        // Ignore storage failures.
      }
      notifyLiveChange({ entity: 'site-settings', action: 'updated', settings: savedSettings });
      window.dispatchEvent(new Event('crevo-site-settings-updated'));
      setToast({ type: 'success', title: 'تم الحفظ بنجاح' });
      await refreshCore().catch(() => {});
    } catch (error) {
      setToast({ type: 'error', title: 'خطأ', description: error.message });
    }
  }

  function openInvoiceDetails(table) {
    if (!invoicePanelOpen) {
      loadInvoiceOrders().catch((error) => setToast({ type: 'error', title: 'خطأ', description: error.message }));
    }
    setInvoiceTable(table);
  }

  function openInvoicePrintDialog(table) {
    setInvoicePrintTable(table);
  }

  async function completeInvoiceTable(table) {
    try {
      if (!table?.currentPhone || !table?.sessionUuid) {
        setToast({ type: 'error', title: 'خطأ', description: 'لا يمكن إغلاق الطاولة لأن بيانات الفتح غير مكتملة' });
        return;
      }
      const tableOrders = ordersByTableId.get(String(table.id)) ?? [];
      const activeOrderNumber = Number(table.activeOrderNumber ?? 0);
      const openedAt = table.openedAt ? new Date(table.openedAt).getTime() : null;
      const currentOrders = activeOrderNumber
        ? tableOrders.filter((order) => Number(order.orderNumber ?? 0) === activeOrderNumber)
        : openedAt
          ? tableOrders.filter((order) => {
            const createdAt = order?.createdAt ? new Date(order.createdAt).getTime() : 0;
            return createdAt >= openedAt;
          })
          : tableOrders;
      const subtotal = currentOrders.reduce((sum, order) => sum + Number(order.totalAmount ?? 0), 0);
      let vipDiscount = { amount: 0, label: '' };
      try {
        vipDiscount = await api.vipSummary(table.currentPhone, subtotal);
      } catch {
        vipDiscount = { amount: 0, label: '' };
      }
      const receiptSource = {
        ...table,
        orders: currentOrders,
        totalAmount: subtotal,
        vipDiscountAmount: Number(vipDiscount?.discountAmount ?? 0),
        vipDiscountLabel: String(vipDiscount?.label ?? '')
      };
      printInvoiceReceipt(receiptSource);
      try {
        await api.closeTable({ uuid: table.qrCodeUuid, phone: table.currentPhone, session: table.sessionUuid });
      } catch (error) {
        await api.closeTable({ uuid: table.qrCodeUuid, phone: table.currentPhone });
      }
      setToast({ type: 'success', title: 'تم إغلاق الطاولة' });
      setInvoiceTable(null);
      refreshCore().catch((refreshError) => {
        console.warn('[AdminDashboardPage] refresh after close failed', refreshError);
      });
    } catch (error) {
      setToast({ type: 'error', title: 'خطأ', description: error.message });
    }
  }

  function printInvoiceReceipt(table) {
    const ordersList = Array.isArray(table?.orders) ? table.orders : [];
    const total = Number(table?.totalAmount ?? ordersList.reduce((sum, order) => sum + Number(order.totalAmount ?? 0), 0));
    const vipDiscountAmount = Number(table?.vipDiscountAmount ?? 0);
    const vipDiscountLabel = String(table?.vipDiscountLabel ?? 'خصم العملاء المميزين');
    const rows = ordersList.map((order) => {
      const items = Array.isArray(order.items) ? order.items : [];
      const itemRows = items.map((item) => `
        <div style="display:flex; justify-content:space-between; gap:8px; margin-top:4px; font-size:11px;">
          <span style="flex:1; text-align:right;">${getItemDisplayName(item)}</span>
          <span>${item.quantity} x EGP ${Number(item.priceAtSale ?? 0).toFixed(2)}</span>
        </div>
      `).join('');
      return `
        <div style="margin-top:10px; padding-top:8px; border-top:1px dashed #000;">
          <div style="font-weight:700; font-size:12px; margin-bottom:4px;">طلب #${order.orderNumber ?? order.id}</div>
          ${itemRows}
          <div style="display:flex; justify-content:space-between; gap:8px; margin-top:4px; font-weight:700; font-size:12px;">
            <span>إجمالي الطلب</span>
            <span>EGP ${Number(order.totalAmount ?? 0).toFixed(2)}</span>
          </div>
        </div>
      `;
    }).join('');
    const html = `
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8" />
          <title>فاتورة إغلاق الطاولة</title>
          <style>
            @page { size: 80mm auto; margin: 4mm; }
            body { margin: 0; font-family: Arial, sans-serif; width: 72mm; color: #000; }
            .receipt { width: 72mm; }
            .center { text-align: center; }
            .title { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
            .muted { font-size: 11px; color: #444; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .total { font-size: 14px; font-weight: 700; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="center">
              <div class="title">فاتورة إغلاق الطاولة</div>
              <div class="muted">الطاولة: ${table?.tableNumber ?? '-'}</div>
              <div class="muted">رقم الطلب: ${table?.activeOrderNumber ?? '-'}</div>
              <div class="muted">${new Date().toLocaleString('ar-EG')}</div>
            </div>
            <div class="divider"></div>
            ${rows}
            ${vipDiscountAmount > 0 ? `
            <div class="divider"></div>
            <div style="display:flex; justify-content:space-between; gap:8px; font-size:12px; font-weight:700;">
              <span>${vipDiscountLabel}</span>
              <span>- EGP ${vipDiscountAmount.toFixed(2)}</span>
            </div>
            ` : ''}
            <div class="divider"></div>
            <div class="total" style="display:flex; justify-content:space-between; gap:8px;">
              <span>الإجمالي النهائي</span>
              <span>EGP ${(total - vipDiscountAmount).toFixed(2)}</span>
            </div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=420,height=700');
    if (!printWindow) {
      setToast({ type: 'error', title: 'خطأ', description: 'تعذر فتح نافذة الطباعة' });
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  }

  async function confirmPrintInvoiceTable() {
    if (!invoicePrintTable) return;
    const table = invoicePrintTable;
    setInvoicePrintTable(null);
    await completeInvoiceTable(table);
  }

  return (
    <AdminShell title="لوحة التحكم">
      <div className="space-y-6">
        <section className="glass-panel rounded-[32px] p-5 sm:p-6 shadow-glow">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">إدارة كريڤو</p>
              <h1 className="mt-2 text-3xl font-bold text-cream">لوحة تحكم عربية</h1>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:flex xl:flex-wrap">
              <button type="button" onClick={() => navigate('/admin/qr')} className="rounded-2xl bg-gold px-4 py-3 text-sm font-bold text-ink">
                توليد QR للطاولات
              </button>
              <button type="button" onClick={() => navigate('/reports/daily')} className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/80">
                التقارير اليومية
              </button>
              <button type="button" onClick={() => navigate('/employees')} className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/80">
                الموظفون
              </button>
              <button type="button" onClick={() => navigate('/admin/categories')} className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/80">
                الأقسام
              </button>
              <button type="button" onClick={() => navigate('/admin/products')} className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/80">
                المنتجات
              </button>
            </div>
          </div>
        </section>

        {summary ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <StatCard label="الأقسام" value={summary.categories} />
            <StatCard label="المنتجات" value={summary.products} />
            <StatCard label="الطاولات" value={summary.tables} />
            <StatCard label="طلبات النادل" value={summary.pendingCalls} />
            <StatCard label="طلبات الفاتورة" value={summary.pendingInvoices ?? 0} />
            <StatCard label="الطلبات" value={summary.orders} />
          </section>
        ) : null}

        <section className="glass-panel rounded-[32px] p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">الطاولات المفتوحة</p>
              <h2 className="mt-2 text-xl font-bold text-cream">الطاولات المفتوحة حاليًا</h2>
            </div>
            <span className="text-xs text-white/50">{openTables.length} طاولة</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {openTables.length ? (
              openTables.map((table) => (
                <div key={table.id} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="text-sm font-semibold text-cream">طاولة {table.tableNumber}</div>
                  <div className="mt-1 text-xs text-white/55">{table.qrCodeUuid}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-center text-xs font-semibold text-emerald-100">
                      مفتوحة
                    </div>
                    {table.invoiceRequestedAt ? (
                      <div className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-center text-xs font-semibold text-violet-100">
                        تطلب الفاتورة
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/55 sm:col-span-2 xl:col-span-4">
                لا توجد طاولات مفتوحة حاليًا
              </div>
            )}
          </div>
        </section>

        <section className="glass-panel rounded-[32px] p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-bold text-cream">متابعة النادل</h2>
            {selectedTable ? <span className="text-xs text-white/50">Table {selectedTable.tableNumber}</span> : null}
          </div>
          <div className="mt-4 max-h-[420px] overflow-auto pr-1">
            {calls.length ? (
              <div className="space-y-3">
                {calls.map((call) => (
                  <div
                    key={call.id}
                    className={`rounded-[24px] p-4 transition ${
                      String(call.status ?? 'pending') === 'pending'
                        ? 'border border-red-400/30 bg-red-500/10 shadow-[0_0_0_1px_rgba(239,68,68,0.15)]'
                        : 'border border-white/10 bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-cream">الطاولة {call.table?.tableNumber ?? call.tableNumber ?? '-'}</p>
                        <p className={`mt-1 text-xs uppercase tracking-[0.3em] ${String(call.status ?? 'pending') === 'pending' ? 'text-red-200' : 'text-white/40'}`}>
                          {call.status ?? 'pending'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          api.completeCall(call.id)
                            .then(() => setCalls((current) => current.filter((item) => item.id !== call.id)))
                            .catch((error) => setToast({ type: 'error', title: 'خطأ', description: error.message }));
                        }}
                        className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-100 transition hover:bg-emerald-400/20"
                      >
                        تم
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/55">
                لا توجد طلبات نادل حاليًا
              </div>
            )}
          </div>
        </section>

        <section className="glass-panel rounded-[32px] p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">طلبات الفاتورة</p>
              <h2 className="mt-2 text-xl font-bold text-cream">الطاولات التي تطلب الفاتورة</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/50">{invoiceTables.length} طاولة</span>
              {!invoicePanelOpen ? (
                <button
                  type="button"
                  onClick={loadInvoiceOrders}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
                >
                  عرض التفاصيل
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setInvoicePanelOpen(false)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
                >
                  إخفاء التفاصيل
                </button>
              )}
            </div>
          </div>
          {invoicePanelOpen ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {invoiceTables.length ? (
                invoiceTables.map((table) => {
                  const tableOrders = ordersByTableId.get(String(table.id)) ?? [];
                  const activeOrderNumber = Number(table.activeOrderNumber ?? 0);
                  const openedAt = table.openedAt ? new Date(table.openedAt).getTime() : null;
                  const currentOrders = activeOrderNumber
                    ? tableOrders.filter((order) => Number(order.orderNumber ?? 0) === activeOrderNumber)
                    : openedAt
                      ? tableOrders.filter((order) => {
                        const createdAt = order?.createdAt ? new Date(order.createdAt).getTime() : 0;
                        return createdAt >= openedAt;
                      })
                      : tableOrders;
                  const totalAmount = currentOrders.reduce((sum, order) => sum + Number(order.totalAmount ?? 0), 0);
                  return (
                    <div key={table.id} className="rounded-[24px] border border-violet-400/20 bg-violet-400/10 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">طاولة {table.tableNumber}</div>
                          <div className="mt-1 text-xs text-white/60">
                            طلب #{activeOrderNumber || currentOrders[0]?.orderNumber || '-'}
                          </div>
                          <div className="mt-1 text-xs text-white/70">
                            {ordersLoaded ? `المبلغ: EGP ${totalAmount.toFixed(2)}` : 'اضغط عرض التفاصيل لتحميل الطلبات'}
                          </div>
                        </div>
                        <div className="rounded-full border border-violet-200/30 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white">
                          تطلب الفاتورة
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openInvoiceDetails(table)}
                          className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
                        >
                          عرض الطلبات
                        </button>
                        <button
                          type="button"
                          onClick={() => openInvoicePrintDialog(table)}
                          className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm font-bold text-amber-100 transition hover:bg-amber-500/20"
                        >
                          طباعة فاتورة
                        </button>
                        <button
                          type="button"
                          onClick={() => completeInvoiceTable(table)}
                          className="rounded-2xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-100 transition hover:bg-red-500/20"
                        >
                          إغلاق الطاولة
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[24px] border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/55 sm:col-span-2 xl:col-span-3">
                  لا توجد طاولات تطلب الفاتورة حاليًا
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 rounded-[24px] border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/55">
              تم تأجيل تحميل تفاصيل الفاتورة لتخفيف الصفحة. اضغط عرض التفاصيل عند الحاجة.
            </div>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          <div className="glass-panel rounded-[32px] p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-cream">أكثر المنتجات بيعًا</h2>
              {!analyticsOpen ? (
                <button
                  type="button"
                  onClick={loadAnalyticsData}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
                >
                  تحميل
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setAnalyticsOpen(false)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
                >
                  إخفاء
                </button>
              )}
            </div>
            {analyticsOpen ? (
              <div className="mt-4">
                <LineBars items={topProducts} labelKey="name_ar" valueKey="total_quantity" />
              </div>
            ) : (
              <div className="mt-4 rounded-[24px] border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/55">
                هذا القسم يتم تحميله عند الطلب فقط.
              </div>
            )}
          </div>
          <div className="glass-panel rounded-[32px] p-5">
            <h2 className="text-xl font-bold text-cream">أكثر الساعات طلبًا</h2>
            {analyticsOpen ? (
              <div className="mt-4">
                <LineBars items={peakHours.map((item) => ({ ...item, label: `${item.hour_of_day}:00` }))} labelKey="label" valueKey="order_count" />
              </div>
            ) : (
              <div className="mt-4 rounded-[24px] border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/55">
                افتح التحليلات لإظهار الرسم.
              </div>
            )}
          </div>
          <div className="glass-panel rounded-[32px] p-5">
            <h2 className="text-xl font-bold text-cream">إيرادات المبيعات</h2>
            {analyticsOpen ? (
              <div className="mt-4 space-y-3">
                {revenue.map((item) => (
                  <div key={item.period} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span>{String(item.period).slice(0, 10)}</span>
                      <span className="font-semibold text-gold">EGP {Number(item.gross_sales).toFixed(2)}</span>
                    </div>
                    <div className="mt-2 text-xs text-white/60">متوسط قيمة الطلب: EGP {Number(item.average_order_value ?? 0).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-[24px] border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/55">
                يتم تحميل الإيرادات فقط عند فتح التحليلات.
              </div>
            )}
          </div>
        </section>

        {invoiceTable ? (
          <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm">
            <div className="w-full max-w-4xl rounded-[32px] border border-white/10 bg-[#11131a] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/40">طلبات الطاولة</p>
                  <h3 className="mt-2 text-2xl font-bold text-cream">طاولة {invoiceTable.tableNumber}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInvoiceTable(null)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80"
                >
                  إغلاق
                </button>
              </div>

              <div className="mt-4 max-h-[65vh] space-y-3 overflow-auto pr-1">
                {invoiceTableOrders.length ? (
                  invoiceTableOrders.map((order) => (
                    <article key={order.id} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-white">طلب #{order.orderNumber ?? order.id}</div>
                          <div className="mt-1 text-xs text-white/55">
                            {order.createdAt ? new Date(order.createdAt).toLocaleString('ar-EG') : 'غير متاح'}
                          </div>
                        </div>
                        <div className="text-sm font-bold text-gold">EGP {Number(order.totalAmount ?? 0).toFixed(2)}</div>
                      </div>

                      <div className="mt-3 space-y-2">
                        {order.items?.map((item) => (
                          <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white/80">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-semibold text-white">{getItemDisplayName(item)}</div>
                                <div className="mt-1 text-xs text-white/55">
                                  الكمية: {item.quantity} • سعر الوحدة: EGP {Number(item.priceAtSale ?? 0).toFixed(2)}
                                </div>
                              </div>
                              <div className="font-semibold text-gold">
                                EGP {Number((item.priceAtSale ?? 0) * item.quantity).toFixed(2)}
                              </div>
                            </div>
                            {extractCustomerNote(item.selectedOptions ?? {}) ? (
                              <div className="mt-2 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
                                تفاصيل العميل: {extractCustomerNote(item.selectedOptions ?? {})}
                              </div>
                            ) : null}
                            {extractCustomChoices(item.selectedOptions ?? {}).length ? (
                              <div className="mt-2 space-y-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75">
                                {extractCustomChoices(item.selectedOptions ?? {}).map((choice) => (
                                  <div key={`${choice.groupId ?? 'group'}:${choice.choiceId ?? 'choice'}`}>
                                    {choice.groupTitleAr || choice.groupTitleEn ? `${choice.groupTitleAr || choice.groupTitleEn}: ` : ''}
                                    {choice.choiceLabelAr || choice.choiceLabelEn || ''}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            {isOfferItem(item) && offerSelectionGroups(item, 'ar').length ? (
                              <div className="mt-2 space-y-2 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-50">
                                {offerSelectionGroups(item, 'ar').map((group) => (
                                  <div key={`${item.id}-${group.title}`} className="space-y-1 rounded-lg bg-black/10 px-3 py-2">
                                    <div className="font-semibold text-white">{group.title}: {group.value}</div>
                                    {Array.isArray(group.details) && group.details.length ? (
                                      <div className="space-y-1 text-white/80">
                                        {group.details.map((detail) => (
                                          <div key={`${item.id}-${group.title}-${detail.title}`}>
                                            <span className="font-semibold text-white">{detail.title}:</span> {detail.value}
                                          </div>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-[24px] border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/55">
                    لا توجد طلبات لهذه الطاولة
                  </div>
                )}
              </div>
              <div className="mt-5 flex flex-wrap justify-end gap-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => openInvoicePrintDialog(invoiceTable)}
                  className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-100 transition hover:bg-amber-500/20"
                >
                  طباعة فاتورة
                </button>
                <button
                  type="button"
                  onClick={() => completeInvoiceTable(invoiceTable)}
                  className="rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100 transition hover:bg-red-500/20"
                >
                  إغلاق الطاولة
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceTable(null)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={Boolean(invoicePrintTable)}
        title="هل تريد طباعة فاتورة؟"
        description="عند الضغط على نعم سيتم طباعة الريسيت ثم إغلاق الطاولة مباشرة."
        confirmLabel="نعم"
        cancelLabel="لا"
        onConfirm={confirmPrintInvoiceTable}
        onCancel={() => setInvoicePrintTable(null)}
      />

      <Toast
        open={Boolean(toast)}
        tone={toast?.type ?? 'success'}
        title={toast?.title}
        description={toast?.description}
        durationMs={5000}
        onClose={() => setToast(null)}
      />
    </AdminShell>
  );
}


