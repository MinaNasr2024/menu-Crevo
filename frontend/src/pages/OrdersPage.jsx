import { useEffect, useMemo, useState } from 'react';
import { AdminShell } from '../components/AdminShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { api } from '../lib/api';
import { formatCurrency } from '../lib/format';
import { resolveMediaUrl } from '../components/ProductMedia';
import { getApiBase, getSocketBase } from '../lib/api';
import { io } from 'socket.io-client';
import { useWindowDataChanged } from '../hooks/useWindowDataChanged';

const statusLabels = {
  pending: 'قيد الانتظار',
  completed: 'تم التسليم',
  cancelled: 'ملغى'
};

  const statusMeta = {
    pending: {
      label: 'قيد الانتظار',
      chipClass: 'border-amber-400/25 bg-amber-500/10 text-amber-100',
      icon: 'pending'
  },
  completed: {
    label: 'تم التسليم',
    chipClass: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100',
    icon: 'completed'
  },
    cancelled: {
      label: 'ملغى',
      chipClass: 'border-red-400/25 bg-red-500/10 text-red-100',
      icon: 'cancelled'
    }
};

function itemStatus(item = {}) {
  const selectedOptions = normalizeSelectedOptions(item.selectedOptions ?? {});
  return ['pending', 'completed', 'cancelled'].includes(String(selectedOptions.adminStatus ?? ''))
    ? String(selectedOptions.adminStatus)
    : 'pending';
}

function itemMatchesFilter(item = {}, filter = 'all') {
  if (filter === 'all') return true;
  return itemStatus(item) === filter;
}

function statusIcon(status) {
  switch (status) {
    case 'completed':
      return (
        <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
          <path fill="currentColor" d="M7.7 13.5 4.4 10.2l-1.4 1.4 4.7 4.7L17 7l-1.4-1.4z" />
        </svg>
      );
    case 'cancelled':
      return (
        <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
          <path fill="currentColor" d="M5 4.6 4.6 5 9.6 10 4.6 15 5 15.4 10 10.4l5 5 .4-.4-5-5 5-5-.4-.4-5 5z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
          <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path fill="currentColor" d="M9.2 5.5h1.6v4.8L13 12.5l-1.1 1.1-2.7-2.7z" />
        </svg>
      );
  }
}

function formatDateTime(value) {
  if (!value) return 'غير متاح';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'غير متاح';
  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeSelectedOptions(value) {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value;
}

function extractNote(selectedOptions = {}) {
  const source = normalizeSelectedOptions(selectedOptions);
  const directCandidates = [
    source.note,
    source.customerNote,
    source.notes,
    source.comment,
    source.comments,
    source.remark,
    source.remarks
  ];
  const direct = directCandidates.map((value) => String(value ?? '').trim()).find(Boolean);
  if (direct) return direct;
  const entry = Object.entries(source).find(([key, value]) => /note|comment|remark/i.test(key) && String(value ?? '').trim());
  return entry ? String(entry[1]).trim() : '';
}

function extractCancelReason(selectedOptions = {}) {
  const source = normalizeSelectedOptions(selectedOptions);
  const directCandidates = [
    source.adminStatusReason,
    source.cancelReason,
    source.cancellationReason,
    source.reason,
    source.note
  ];
  const direct = directCandidates.map((value) => String(value ?? '').trim()).find(Boolean);
  if (direct) return direct;
  const entry = Object.entries(source).find(([key, value]) => /reason|cancel/i.test(key) && String(value ?? '').trim());
  return entry ? String(entry[1]).trim() : '';
}

function getOrderBaseTotal(order = {}) {
  const items = Array.isArray(order.items) ? order.items : [];
  return items.reduce((sum, item) => sum + Number(item.priceAtSale ?? 0) * Number(item.quantity ?? 0), 0);
}

function getOrderTotal(order = {}) {
  const storedTotal = Number(order?.totalAmount ?? NaN);
  if (Number.isFinite(storedTotal)) return storedTotal;
  return getOrderBaseTotal(order);
}

function getVipDiscountInfo(order = {}) {
  const items = Array.isArray(order.items) ? order.items : [];
  const selectedOptions = items
    .map((item) => normalizeSelectedOptions(item.selectedOptions ?? {}))
    .find((entry) => Number(entry.vipDiscountAmount ?? 0) > 0 || entry.vipDiscountType || entry.vipDiscountLabel);
  if (!selectedOptions) return null;
  const amount = Math.max(0, Number(selectedOptions.vipDiscountAmount ?? 0));
  if (!amount) return null;
  const type = String(selectedOptions.vipDiscountType ?? '').toLowerCase();
  const percentage = Number(selectedOptions.vipDiscountPercentage ?? 0);
  const fixedAmount = Number(selectedOptions.vipDiscountFixedAmount ?? 0);
  const baseAmount = Math.max(0, Number(selectedOptions.vipDiscountBaseAmount ?? (getOrderBaseTotal(order) || amount)));
  const label = String(selectedOptions.vipDiscountLabel ?? 'خصم العملاء المميزين');
  const descriptor = type === 'fixed'
    ? `${label} (${formatCurrency(fixedAmount || amount)})`
    : type === 'percent'
      ? `${label} (${percentage}%)`
      : label;
  return {
    amount,
    type,
    percentage,
    fixedAmount,
    baseAmount,
    descriptor,
    finalAmount: Math.max(0, Number((baseAmount - amount).toFixed(2)))
  };
}

function labelForOption(options = [], id, lang = 'ar') {
  const match = toArray(options).find((item) => String(item?.id) === String(id));
  if (!match) return null;
  return lang === 'ar'
    ? (match.labelAr || match.labelEn || null)
    : (match.labelEn || match.labelAr || null);
}

function customChoiceGroups(item = {}, lang = 'ar') {
  const selectedOptions = normalizeSelectedOptions(item.selectedOptions ?? {});
  const product = item.product ?? {};
  const groups = toArray(selectedOptions.customChoiceSelections).map((selection, index) => {
    const group = toArray(product.customChoiceGroups).find((candidate) => String(candidate?.id) === String(selection.groupId));
    const fallbackTitle = lang === 'ar' ? `حقل اختياري ${index + 1}` : `Custom field ${index + 1}`;
    const title = lang === 'ar'
      ? (selection.groupTitleAr || selection.groupTitleEn || group?.titleAr || group?.titleEn || fallbackTitle)
      : (selection.groupTitleEn || selection.groupTitleAr || group?.titleEn || group?.titleAr || fallbackTitle);
    const fallbackValue = lang === 'ar' ? String(selection.choiceId ?? '').trim() : String(selection.choiceId ?? '').trim();
    const value = lang === 'ar'
      ? (selection.choiceLabelAr || selection.choiceLabelEn || fallbackValue)
      : (selection.choiceLabelEn || selection.choiceLabelAr || fallbackValue);
    return { title, value };
  }).filter((group) => group.title || group.value);
  return groups;
}

function offerSelectionGroups(item = {}, lang = 'ar') {
  const selectedOptions = normalizeSelectedOptions(item.selectedOptions ?? {});
  const rawSelections = toArray(selectedOptions.offerGroupSelections).length
    ? toArray(selectedOptions.offerGroupSelections)
    : toArray(selectedOptions.selectedOfferItems);
  const groups = rawSelections.map((selection, index) => {
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
    const ingredients = toArray(selection.productIngredients).filter(Boolean);
    const allergens = toArray(selection.productAllergens).filter(Boolean);
    const selectedCustomChoices = toArray(selection.productCustomChoiceSelections).filter(Boolean);
    const customGroups = toArray(selection.productCustomChoiceGroups)
      .map((group) => {
        const groupTitle = lang === 'ar'
          ? (group.titleAr || group.titleEn || '')
          : (group.titleEn || group.titleAr || '');
        const matchingSelection = selectedCustomChoices.find((choice) => String(choice.groupId) === String(group.id));
        if (!matchingSelection) return null;
        const selectedValue = lang === 'ar'
          ? (matchingSelection.choiceLabelAr || matchingSelection.choiceLabelEn || matchingSelection.choiceId || '')
          : (matchingSelection.choiceLabelEn || matchingSelection.choiceLabelAr || matchingSelection.choiceId || '');
        if (!groupTitle && !selectedValue) return null;
        return {
          title: groupTitle || (lang === 'ar' ? 'حقل اختياري' : 'Custom field'),
          value: selectedValue
        };
      })
      .filter(Boolean);

    if (selection.includeProductOptions && description) {
      details.push({ title: lang === 'ar' ? 'الوصف' : 'Description', value: description });
    }
    if (selection.includeProductOptions && ingredients.length) {
      details.push({ title: lang === 'ar' ? 'المكونات' : 'Ingredients', value: ingredients.join('، ') });
    }
    if (selection.includeProductOptions && allergens.length) {
      details.push({ title: lang === 'ar' ? 'مسببات الحساسية' : 'Allergens', value: allergens.join('، ') });
    }
    if (customGroups.length) {
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
      value: extra > 0 ? `${valueBase} (+${formatCurrency(extra)})` : valueBase,
      details
    };
  }).filter((group) => group.title || group.value);
  return groups;
}

function isOfferItem(item = {}) {
  const selectedOptions = normalizeSelectedOptions(item.selectedOptions ?? {});
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
    || toArray(selectedOptions.selectedOfferItems).length
    || toArray(selectedOptions.offerGroupSelections).length
  );
}

function getOfferMeta(item = {}, lang = 'ar') {
  const selectedOptions = normalizeSelectedOptions(item.selectedOptions ?? {});
  return {
    name: lang === 'ar'
      ? (item.displayNameAr || selectedOptions.displayNameAr || selectedOptions.offerNameAr || item.offer?.nameAr || item.displayNameEn || selectedOptions.displayNameEn || selectedOptions.offerNameEn || item.offer?.nameEn || 'العرض')
      : (item.displayNameEn || selectedOptions.displayNameEn || selectedOptions.offerNameEn || item.offer?.nameEn || item.displayNameAr || selectedOptions.displayNameAr || selectedOptions.offerNameAr || item.offer?.nameAr || 'Offer'),
    imageUrl: item.displayImageUrl || selectedOptions.displayImageUrl || selectedOptions.offerImageUrl || item.offer?.imageUrl || '',
    note: extractNote(selectedOptions)
  };
}

function getItemDisplayName(item = {}, lang = 'ar') {
  if (isOfferItem(item)) {
    return getOfferMeta(item, lang).name;
  }
  return lang === 'ar'
    ? (item.product?.nameAr ?? item.product?.nameEn ?? 'صنف')
    : (item.product?.nameEn ?? item.product?.nameAr ?? 'Item');
}

function getItemDisplayImageUrl(item = {}) {
  if (isOfferItem(item)) {
    return getOfferMeta(item, 'ar').imageUrl;
  }
  return item.product?.coverMediaUrl ?? '';
}

function optionSummary(item = {}, lang = 'ar') {
  const selectedOptions = normalizeSelectedOptions(item.selectedOptions ?? {});
  const product = item.product ?? {};
  const lines = [];
  const isOffer = Boolean(
    String(selectedOptions.itemType ?? '').toLowerCase() === 'offer'
    || item.offerId
    || selectedOptions.offerId
    || selectedOptions.displayNameAr
    || selectedOptions.displayNameEn
    || selectedOptions.offerNameAr
    || selectedOptions.offerNameEn
    || toArray(selectedOptions.selectedOfferItems).length
    || toArray(selectedOptions.offerGroupSelections).length
  );
  if (isOffer) {
    lines.push(`${lang === 'ar' ? 'العرض' : 'Offer'}: ${lang === 'ar' ? (selectedOptions.offerNameAr || selectedOptions.offerNameEn || 'العرض') : (selectedOptions.offerNameEn || selectedOptions.offerNameAr || 'Offer')}`);
  }
  const sizeLabel = selectedOptions.sizeLabelAr
    || selectedOptions.sizeLabelEn
    || labelForOption(product.sizeOptions, selectedOptions.sizeId, lang);
  if (sizeLabel) {
    lines.push(`${lang === 'ar' ? 'الحجم' : 'Size'}: ${sizeLabel}`);
  }
  const addonLabels = toArray(selectedOptions.addonLabelsAr).length
    ? toArray(selectedOptions.addonLabelsAr)
    : toArray(selectedOptions.addonIds).map((id) => labelForOption(product.addonOptions, id, lang)).filter(Boolean);
  if (addonLabels.length) {
    lines.push(`${lang === 'ar' ? 'الإضافات' : 'Add-ons'}: ${addonLabels.join('، ')}`);
  }
  const sideDishLabels = toArray(selectedOptions.sideDishLabelsAr).length
    ? toArray(selectedOptions.sideDishLabelsAr)
    : toArray(selectedOptions.sideDishIds).map((id) => labelForOption(product.sideDishOptions, id, lang)).filter(Boolean);
  if (sideDishLabels.length) {
    lines.push(`${lang === 'ar' ? 'الأطباق الإضافية' : 'Extras'}: ${sideDishLabels.join('، ')}`);
  }
  for (const group of customChoiceGroups(item, lang)) {
    lines.push(`${group.title}: ${group.value}`);
  }
  const note = extractNote(selectedOptions);
  if (note) {
    lines.push(`${lang === 'ar' ? 'ملاحظات العميل' : 'Customer note'}: ${note}`);
  }
  return lines;
}

function detailedOptionGroups(item = {}, lang = 'ar') {
  const selectedOptions = normalizeSelectedOptions(item.selectedOptions ?? {});
  const product = item.product ?? {};
  const groups = [];
  const isOffer = Boolean(
    String(selectedOptions.itemType ?? '').toLowerCase() === 'offer'
    || item.offerId
    || selectedOptions.offerId
    || selectedOptions.displayNameAr
    || selectedOptions.displayNameEn
    || selectedOptions.offerNameAr
    || selectedOptions.offerNameEn
    || toArray(selectedOptions.offerGroupSelections).length
  );

  if (isOffer) {
    groups.push({
      title: lang === 'ar' ? 'العرض' : 'Offer',
      value: lang === 'ar'
        ? (selectedOptions.offerNameAr || selectedOptions.offerNameEn || 'العرض')
        : (selectedOptions.offerNameEn || selectedOptions.offerNameAr || 'Offer')
    });
  }

  const sizeLabel = selectedOptions.sizeLabelAr
    || selectedOptions.sizeLabelEn
    || labelForOption(product.sizeOptions, selectedOptions.sizeId, lang);
  if (sizeLabel) {
    groups.push({
      title: lang === 'ar' ? 'الحجم' : 'Size',
      value: sizeLabel
    });
  }

  const addonLabels = toArray(selectedOptions.addonLabelsAr).length
    ? toArray(selectedOptions.addonLabelsAr)
    : toArray(selectedOptions.addonIds).map((id) => labelForOption(product.addonOptions, id, lang)).filter(Boolean);
  if (addonLabels.length) {
    groups.push({
      title: lang === 'ar' ? 'الإضافات' : 'Add-ons',
      value: addonLabels.join('، ')
    });
  }

  const sideDishLabels = toArray(selectedOptions.sideDishLabelsAr).length
    ? toArray(selectedOptions.sideDishLabelsAr)
    : toArray(selectedOptions.sideDishIds).map((id) => labelForOption(product.sideDishOptions, id, lang)).filter(Boolean);
  if (sideDishLabels.length) {
    groups.push({
      title: lang === 'ar' ? 'الأطباق الإضافية' : 'Extras',
      value: sideDishLabels.join('، ')
    });
  }

  for (const group of customChoiceGroups(item, lang)) {
    groups.push(group);
  }

  if (isOffer) {
    for (const group of offerSelectionGroups(item, lang)) {
      groups.push(group);
    }
  }

  return groups;
}

export function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [message, setMessage] = useState('');
  const [cancelItem, setCancelItem] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonItem, setCancelReasonItem] = useState(null);
  const [detailsItem, setDetailsItem] = useState(null);
  const [closeOrder, setCloseOrder] = useState(null);

  async function refresh() {
    const data = await api.orders();
    setOrders(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    refresh().catch((error) => setMessage(error.message));
  }, []);

  useWindowDataChanged(() => {
    refresh().catch(() => {});
  });

  useEffect(() => {
    let socket;
    let mounted = true;

    try {
      socket = io(getSocketBase() || getApiBase(), {
        transports: ['websocket']
      });

      const handleLiveUpdate = () => {
        if (!mounted) return;
        refresh().catch(() => {});
      };

      socket.on('connect', handleLiveUpdate);
      socket.on('order:new', handleLiveUpdate);
      socket.on('invoice:request:new', handleLiveUpdate);
      socket.on('waiter:call:new', handleLiveUpdate);
      socket.emit('join:admin');
    } catch {
      const interval = window.setInterval(() => {
        refresh().catch(() => {});
      }, 5000);
      return () => {
        mounted = false;
        window.clearInterval(interval);
        socket?.disconnect();
      };
    }

    return () => {
      mounted = false;
      socket?.disconnect();
    };
  }, []);

  const currentOrders = useMemo(() => {
    return orders.filter((order) => {
      if (!order?.table) return false;
      const openedAt = order.table.openedAt ? new Date(order.table.openedAt).getTime() : null;
      const currentPhone = String(order.table.currentPhone ?? '').trim();
      const createdAt = order.createdAt ? new Date(order.createdAt).getTime() : null;
      if (!openedAt || !currentPhone || !createdAt) return false;
      if (order.status === 'cancelled') return false;
      return createdAt >= openedAt;
    });
  }, [orders]);

  const groupedOrders = useMemo(() => {
    const map = new Map();
    for (const order of currentOrders) {
      const tableId = String(order?.table?.id ?? order?.tableId ?? 'unknown');
      const tableKey = tableId || 'unknown';
      const current = map.get(tableKey) ?? {
        tableId: tableKey,
        tableNumber: order?.table?.tableNumber ?? 'غير محدد',
        tableColor: order?.table?.tableColor || '#d4af37',
        table: order?.table ?? null,
        orders: []
      };
      current.orders.push(order);
      if (!current.table && order?.table) current.table = order.table;
      map.set(tableKey, current);
    }
    return [...map.values()];
  }, [currentOrders]);

  function isHistoricalOrder(order) {
    const createdAt = order?.createdAt ? new Date(order.createdAt).getTime() : null;
    const openedAt = order?.table?.openedAt ? new Date(order.table.openedAt).getTime() : null;
    const tableClosed = Boolean(order?.table) && !order?.table?.currentPhone && !order?.table?.openedAt;
    if (!createdAt) return false;
    if (tableClosed) return true;
    if (!openedAt) return order.status === 'cancelled';
    return createdAt < openedAt || order.status === 'cancelled';
  }

  async function updateStatus(orderId, status, reason = '') {
    try {
      if (status === 'cancelled') {
        await api.updateOrderStatusWithReason(orderId, status, reason);
      } else {
        await api.updateOrderStatus(orderId, status);
      }
      await refresh();
      setMessage(status === 'cancelled' ? 'تم إلغاء الطلب' : 'تم تحديث حالة الطلب');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function updateItemStatus(itemId, status, reason = '') {
    try {
      const currentItem = currentOrders
        .flatMap((order) => order.items)
        .find((item) => Number(item.id) === Number(itemId));
      const currentStatus = currentItem ? itemStatus(currentItem) : 'pending';
      if (currentStatus === 'cancelled' && status !== 'cancelled') {
        setMessage('لا يمكن تغيير الصنف بعد إلغائه');
        return;
      }
      await api.updateOrderItemStatus(itemId, status, reason);
      await refresh();
      setMessage(status === 'cancelled' ? 'تم إلغاء الصنف' : 'تم تحديث حالة الصنف');
    } catch (error) {
      setMessage(error.message);
    }
  }

  function openCancelDialog(item) {
    setCancelItem(item);
    setCancelReason('');
  }

  async function confirmCancel() {
    if (!cancelItem) return;
    await updateItemStatus(cancelItem.id, 'cancelled', cancelReason);
    setCancelItem(null);
    setCancelReason('');
  }

  function openDetails(item) {
    setDetailsItem(item);
  }

  function openCancelReason(item) {
    setCancelReasonItem(item);
  }

  async function closeTable(order) {
    const tableUuid = order?.table?.qrCodeUuid;
    const phone = order?.table?.currentPhone;
    const session = order?.table?.sessionUuid;
    if (!tableUuid || !phone) {
      setMessage('لا يمكن إغلاق الطاولة لأن بيانات الفتح غير متوفرة');
      return;
    }
    try {
      await api.closeTable({ uuid: tableUuid, phone, session });
      setMessage(`تم إغلاق الطاولة ${order?.table?.tableNumber ?? ''}`);
      refresh().catch((refreshError) => {
        console.warn('[OrdersPage] refresh after close failed', refreshError);
      });
    } catch (error) {
      try {
        await api.closeTable({ uuid: tableUuid, phone });
        setMessage(`تم إغلاق الطاولة ${order?.table?.tableNumber ?? ''}`);
        refresh().catch((refreshError) => {
          console.warn('[OrdersPage] refresh after retry close failed', refreshError);
        });
      } catch (retryError) {
        setMessage(retryError.message || error.message);
      }
    }
  }

  function printTableReceipt(order) {
      const total = getOrderTotal(order);
      const vipDiscount = getVipDiscountInfo(order);
      const rows = order.items.map((item) => `
        <div style="display:flex; justify-content:space-between; gap:8px; margin-top:6px;">
          <span style="flex:1; text-align:right;">${getItemDisplayName(item, 'ar')}</span>
          <span>${item.quantity} x ${formatCurrency(item.priceAtSale)}</span>
        </div>
      `).join('');
    const html = `
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8" />
          <title>إيصال الطاولة</title>
          <style>
            @page { size: 80mm auto; margin: 4mm; }
            body { margin: 0; font-family: Arial, sans-serif; width: 72mm; color: #000; }
            .receipt { width: 72mm; padding: 0; }
            .center { text-align: center; }
            .title { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
            .muted { font-size: 11px; color: #444; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; margin-top: 4px; }
            .total { font-size: 14px; font-weight: 700; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="center">
              <div class="title">إيصال إغلاق الطاولة</div>
              <div class="muted">الطاولة: ${order?.table?.tableNumber ?? '-'}</div>
              <div class="muted">الطلب رقم: ${order?.orderNumber ?? order?.id ?? '-'}</div>
              <div class="muted">${new Date().toLocaleString('ar-EG')}</div>
            </div>
            <div class="divider"></div>
            ${rows}
            ${vipDiscount ? `
              <div class="divider"></div>
              <div class="row" style="color:#0f8f4d;">
                <span>${vipDiscount.descriptor}</span>
                <span>- ${formatCurrency(vipDiscount.amount)}</span>
              </div>
            ` : ''}
            <div class="divider"></div>
            <div class="total row"><span>الإجمالي</span><span>${formatCurrency(total)}</span></div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=420,height=700');
    if (!printWindow) {
      setMessage('تعذر فتح نافذة الطباعة');
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

  async function confirmCloseTable() {
    if (!closeOrder) return;
    await closeTable(closeOrder);
    printTableReceipt(closeOrder);
    setCloseOrder(null);
  }

  return (
    <AdminShell title="الطلبات">
      <div className="space-y-6">
        <section className="glass-panel rounded-[32px] p-5 sm:p-6 shadow-glow">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">إدارة الطلبات</p>
              <h1 className="mt-2 text-3xl font-bold text-cream">الطلبات</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              {['all', 'pending', 'completed', 'cancelled'].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-2xl border px-4 py-2 text-sm transition ${
                    statusFilter === status ? 'border-gold bg-gold/10 text-gold' : 'border-white/10 text-white/75 hover:bg-white/5'
                  }`}
                >
                  {status === 'all' ? 'الكل' : statusLabels[status]}
                </button>
              ))}
            </div>
          </div>
          {message ? <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">{message}</p> : null}
        </section>

        <section className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-2">
          {groupedOrders.map((tableGroup) => {
            const tableOrders = tableGroup.orders;
              const sessionOrderCount = tableOrders.length;
            const filteredTableOrders = tableOrders
              .map((order) => ({
                ...order,
                items: order.items.filter((item) => itemMatchesFilter(item, statusFilter))
              }))
              .filter((order) => order.items.length);
            if (!filteredTableOrders.length) return null;
            const firstOrder = filteredTableOrders[0];
            const tableClosed = Boolean(tableGroup.table) && !tableGroup.table.currentPhone && !tableGroup.table.openedAt;
            const isHistoricalGroup = filteredTableOrders.every((order) => isHistoricalOrder(order));
            const total = filteredTableOrders.reduce((outerSum, order) => outerSum + getOrderTotal(order), 0);
            const orderNumbers = filteredTableOrders.map((order) => order.orderNumber ?? order.id).join('، ');
            const createdAt = filteredTableOrders.length ? formatDateTime(filteredTableOrders[0].createdAt) : 'غير متاح';

            return (
              <article
                key={tableGroup.tableId}
                className={`glass-panel rounded-[32px] p-5 transition ${
                  isHistoricalGroup || tableClosed ? 'opacity-35 saturate-0 grayscale-[0.9] contrast-75 shadow-none' : ''
                }`}
                style={{
                  borderColor: tableGroup.tableColor,
                  boxShadow: isHistoricalGroup || tableClosed
                    ? '0 0 0 1px rgba(255,255,255,0.025) inset'
                    : `0 0 0 1px ${tableGroup.tableColor}33 inset`
                }}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full border border-white/20"
                        style={{ backgroundColor: tableGroup.tableColor }}
                      />
                      <h2 className="text-2xl font-bold text-cream">
                        الطاولة {tableGroup.tableNumber}
                      </h2>
                    </div>
                    <p className="mt-1 text-sm text-white/60">الطلبات: #{orderNumbers}</p>
                    <p className="mt-1 text-sm text-white/60">إجمالي الطلبات: {sessionOrderCount}</p>
                    <p className="mt-1 text-xs text-white/45">{createdAt}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <p className={`text-xs uppercase tracking-[0.35em] ${isHistoricalGroup ? 'text-white/30' : 'text-gold'}`}>
                        {tableClosed ? 'مطفى' : 'مفتوح'}
                      </p>
                      {isHistoricalGroup ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/35">
                          هادئ
                        </span>
                      ) : null}
                      {tableClosed ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/35">
                          مغلق
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                      <div className={`rounded-2xl border px-4 py-3 text-sm ${isHistoricalGroup ? 'border-white/5 bg-white/[0.03] text-white/45' : 'border-white/10 bg-white/5 text-white/75'}`}>
                        الإجمالي: {formatCurrency(total)}
                      </div>
                    <button
                      type="button"
                      onClick={() => setCloseOrder(firstOrder)}
                      className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                        isHistoricalGroup || tableClosed
                          ? 'border-white/[0.03] text-white/25 hover:bg-white/[0.03]'
                          : 'border-amber-400/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20'
                      }`}
                    >
                      إغلاق الطاولة
                    </button>
                  </div>
                </div>

                <div className="mt-5 space-y-6">
                  {filteredTableOrders.map((order) => {
                    const orderHistorical = isHistoricalOrder(order);
                    const orderClosed = Boolean(order?.table) && !order?.table?.currentPhone && !order?.table?.openedAt;
                    const orderTotal = getOrderTotal(order);
                    const vipDiscount = getVipDiscountInfo(order);
                    return (
                      <div key={order.id} className="space-y-3 rounded-[28px] border border-white/10 bg-black/10 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-xl font-bold text-cream">طلب #{order.orderNumber ?? order.id}</h3>
                              {orderHistorical ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/35">هادئ</span> : null}
                              {orderClosed ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/35">مطفى</span> : null}
                            </div>
                            <p className="mt-1 text-xs text-white/45">{formatDateTime(order.createdAt)}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
                            {vipDiscount ? (
                              <div className="mb-2 space-y-1">
                                <div className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                                  {vipDiscount.descriptor}
                                </div>
                                <div className="text-xs text-white/45">
                                  {orderHistorical ? 'الإجمالي بعد الخصم' : 'الإجمالي بعد الخصم'}: {formatCurrency(orderTotal)}
                                </div>
                                <div className="text-xs text-white/45">
                                  قبل الخصم: {formatCurrency(vipDiscount.baseAmount)}
                                </div>
                              </div>
                            ) : null}
                            الإجمالي: {formatCurrency(orderTotal)}
                          </div>
                        </div>

                          <div className="space-y-3">
                            {order.items.map((item) => {
                              const selectedOptions = normalizeSelectedOptions(item.selectedOptions ?? {});
                              const offerItem = isOfferItem(item);
                              const offerMeta = offerItem ? getOfferMeta(item, 'ar') : null;
                              const offerSelections = offerItem ? offerSelectionGroups(item, 'ar') : [];
                              const lines = offerItem ? [] : optionSummary(item, 'ar');
                              const status = itemStatus(item);
                              const meta = statusMeta[status] ?? statusMeta.pending;
                              const cancelledItem = status === 'cancelled';
                              return (
                              <div
                                key={item.id}
                                className={`flex items-start gap-3 rounded-2xl border p-3 transition ${
                                  orderHistorical
                                    ? 'border-white/[0.03] bg-black/5'
                                    : cancelledItem
                                      ? 'border-red-400/20 bg-red-500/5 opacity-50 saturate-0 grayscale-[0.35]'
                                      : offerItem
                                        ? 'border-amber-400/25 bg-amber-500/5'
                                        : 'border-white/10 bg-white/5'
                                }`}
                                >
                                  <div className={`h-16 w-16 overflow-hidden rounded-xl border ${orderHistorical ? 'border-white/[0.03] bg-white/[0.02]' : offerItem ? 'border-amber-400/25 bg-amber-500/10' : 'border-white/10 bg-white/5'}`}>
                                    <img
                                      src={resolveMediaUrl(getItemDisplayImageUrl(item) || offerMeta?.imageUrl)}
                                      alt={offerItem ? (offerMeta?.name ?? 'صورة العرض') : (item.product?.nameAr ?? item.product?.nameEn ?? 'صورة المنتج')}
                                      className={`h-full w-full object-cover ${orderHistorical ? 'opacity-40' : ''}`}
                                    />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        {offerItem ? (
                                          <div className="mb-1 inline-flex rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-100">
                                            عرض مجمّع
                                          </div>
                                        ) : null}
                                        <p className={`font-semibold ${orderHistorical ? 'text-white/45' : 'text-cream'}`}>
                                          {getItemDisplayName(item, 'ar')}
                                        </p>
                                        <p className={`mt-1 text-xs ${orderHistorical ? 'text-white/25' : 'text-white/55'}`}>
                                          الكمية: {item.quantity} • سعر الوحدة: {formatCurrency(item.priceAtSale)}
                                        </p>
                                      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                                        <span
                                          className={`inline-flex min-w-[150px] items-center justify-center gap-1.5 rounded-full border px-5 py-2.5 text-[13px] font-bold transition ${
                                            status === 'completed'
                                              ? 'border-emerald-500 bg-emerald-500 text-white shadow-[0_0_0_1px_rgba(34,197,94,0.45)]'
                                              : status === 'cancelled'
                                                ? 'border-red-300 bg-red-500 text-white shadow-[0_0_0_1px_rgba(239,68,68,0.45)]'
                                                : meta.chipClass
                                          }`}
                                        >
                                          <span className="text-current">{statusIcon(status)}</span>
                                          {meta.label}
                                        </span>
                                      </div>
                                      {lines.length ? (
                                        <div className={`mt-2 space-y-1 text-xs ${orderHistorical ? 'text-white/25' : 'text-white/55'}`}>
                                          {lines.map((line) => <p key={line}>{line}</p>)}
                                        </div>
                                      ) : null}
                                      {offerItem && offerSelections.length ? (
                                        <div className={`mt-2 space-y-1 rounded-2xl border px-3 py-2 text-xs ${
                                          orderHistorical
                                            ? 'border-white/[0.04] bg-white/[0.02] text-white/35'
                                            : 'border-amber-400/20 bg-amber-500/5 text-amber-50'
                                        }`}>
                                          <p className="font-semibold text-current">
                                            {offerSelections.length} {orderHistorical ? 'اختيار' : 'اختيارات'} داخل العرض
                                          </p>
                                          <div className="space-y-1">
                                            {offerSelections.map((group) => (
                                              <div key={`${item.id}-${group.title}`} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                                                <div className="flex items-center justify-between gap-2">
                                                  <p className="text-current/90">
                                                    <span className="font-semibold">{group.title}:</span> {group.value}
                                                  </p>
                                                </div>
                                                {Array.isArray(group.details) && group.details.length ? (
                                                  <div className="mt-2 space-y-1 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-current/80">
                                                    {group.details.map((detail) => (
                                                      <p key={`${item.id}-${group.title}-${detail.title}`} className="text-current/80">
                                                        <span className="font-semibold">{detail.title}:</span> {detail.value}
                                                      </p>
                                                    ))}
                                                  </div>
                                                ) : null}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                    <div className={`text-sm font-semibold ${orderHistorical ? 'text-white/25' : 'text-gold'}`}>
                                      {formatCurrency(Number(item.priceAtSale) * item.quantity)}
                                      {cancelledItem ? (
                                        <button
                                          type="button"
                                          onClick={() => openCancelReason(item)}
                                          className="mt-2 block rounded-2xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/20"
                                        >
                                          سبب الإلغاء
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {!cancelledItem ? (
                                      <button
                                        type="button"
                                        onClick={() => openCancelDialog(item)}
                                        className={`rounded-2xl border px-3 py-2 text-xs transition ${
                                          orderHistorical
                                            ? 'border-white/[0.03] text-white/25 hover:bg-white/[0.03]'
                                            : 'border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20'
                                        }`}
                                      >
                                        <span className="inline-flex items-center gap-1.5 text-red-200">
                                          <span className="text-current">{statusIcon('cancelled')}</span>
                                          إلغاء
                                        </span>
                                      </button>
                                    ) : null}
                                    {!cancelledItem ? (
                                      <button
                                        type="button"
                                        onClick={() => updateItemStatus(item.id, 'completed')}
                                        className={`rounded-2xl border px-3 py-2 text-xs transition ${
                                          orderHistorical
                                            ? 'border-white/[0.03] text-white/25 hover:bg-white/[0.03]'
                                            : 'border-emerald-600 text-white hover:brightness-95'
                                        }`}
                                        style={orderHistorical ? undefined : { backgroundColor: '#16a34a', borderColor: '#16a34a', color: '#ffffff' }}
                                      >
                                        <span className="inline-flex items-center gap-1.5 text-emerald-100">
                                          <span className="text-white">{statusIcon('completed')}</span>
                                          <span className="font-semibold text-emerald-100">تم التسليم</span>
                                        </span>
                                      </button>
                                    ) : (
                                      <div className="rounded-2xl border border-white/[0.03] bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/35">
                                        لا يمكن إعادة الطلب بعد الإلغاء
                                      </div>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => openDetails(item)}
                                      className={`rounded-2xl border px-3 py-2 text-xs transition ${
                                        orderHistorical
                                          ? 'border-white/[0.03] text-white/25 hover:bg-white/[0.03]'
                                          : 'border-white/10 text-white/75 hover:bg-white/5'
                                      }`}
                                    >
                                      عرض
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </section>

        {currentOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-white/60">
            لا توجد طلبات حالية للطاولات المفتوحة.
          </div>
        ) : null}
      </div>

            <ConfirmDialog
        open={Boolean(cancelItem)}
        title="سبب الإلغاء"
        description="اكتب سبب إلغاء الصنف ليتم حفظه."
        confirmLabel="حفظ الإلغاء"
        cancelLabel="إلغاء"
        onConfirm={confirmCancel}
        onCancel={() => {
          setCancelItem(null);
          setCancelReason('');
        }}
      >
        <label className="block space-y-2 text-right">
          <span className="text-sm font-semibold text-slate-700">السبب</span>
          <textarea
            className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-right outline-none"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="اكتب سبب الإلغاء هنا..."
          />
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(detailsItem)}
        title={detailsItem ? `${isOfferItem(detailsItem) ? 'تفاصيل العرض' : 'تفاصيل الصنف'} #${detailsItem.id}` : ''}
        description=""
        confirmLabel="إغلاق"
        cancelLabel={null}
        onConfirm={() => setDetailsItem(null)}
        onCancel={() => setDetailsItem(null)}
      >
          {detailsItem ? (
            (() => {
              const selectedOptions = normalizeSelectedOptions(detailsItem.selectedOptions ?? {});
              const offerItem = isOfferItem(detailsItem);
              const offerMeta = offerItem ? getOfferMeta(detailsItem, 'ar') : null;
              const offerSelections = offerItem ? offerSelectionGroups(detailsItem, 'ar') : [];
              return (
            <div className="space-y-3 text-right">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="h-44 bg-slate-100">
                  <img
                    src={resolveMediaUrl(getItemDisplayImageUrl(detailsItem) || offerMeta?.imageUrl)}
                    alt={offerItem ? (offerMeta?.name ?? 'صورة العرض') : (detailsItem.product?.nameAr ?? detailsItem.product?.nameEn ?? 'صورة المنتج')}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="p-4">
                  {offerItem ? (
                    <div className="mb-3 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                      عرض مجمّع
                    </div>
                  ) : null}
                  <div className="font-semibold text-slate-900">
                    {getItemDisplayName(detailsItem, 'ar')}
                  </div>
                  {offerItem ? (
                    <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      <span className="font-semibold">الوصف:</span> {selectedOptions.offerNoteAr || selectedOptions.offerNoteEn || offerMeta?.note || 'لا يوجد وصف'}
                    </div>
                  ) : null}
                <div className="mt-2 grid gap-1 text-sm text-slate-600">
                  <div>
                    الكمية: {detailsItem.quantity} • سعر الوحدة: {formatCurrency(detailsItem.priceAtSale)}
                  </div>
                  <div className="font-semibold text-slate-900">
                    الإجمالي: {formatCurrency(Number(detailsItem.priceAtSale) * detailsItem.quantity)}
                  </div>
                </div>
                {detailedOptionGroups(detailsItem, 'ar').length ? (
                  <div className="mt-3 space-y-2">
                    {detailedOptionGroups(detailsItem, 'ar').map((group) => (
                      <div key={`${detailsItem.id}-${group.title}`} className={`rounded-2xl px-3 py-2 text-sm ${offerItem ? 'bg-amber-50 text-amber-950' : 'bg-slate-50 text-slate-700'}`}>
                        <span className="font-semibold text-slate-900">{group.title}:</span> {group.value}
                      </div>
                    ))}
                  </div>
                ) : null}
                {offerItem && offerSelections.length ? (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
                    <div className="mb-2 font-semibold">اختيارات العرض:</div>
                    <div className="space-y-2">
                      {offerSelections.map((group) => (
                        <div key={`${detailsItem.id}-${group.title}-summary`} className="space-y-2 rounded-2xl border border-amber-200 bg-white/80 px-3 py-2">
                          <div>
                            <span className="font-semibold">{group.title}:</span> {group.value}
                          </div>
                          {Array.isArray(group.details) && group.details.length ? (
                            <div className="space-y-1 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-amber-900">
                              {group.details.map((detail) => (
                                <div key={`${detailsItem.id}-${group.title}-${detail.title}`}>
                                  <span className="font-semibold">{detail.title}:</span> {detail.value}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {(() => {
                  const note = extractNote(selectedOptions);
                  return note ? (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      <span className="font-semibold">ملاحظات العميل:</span> {note}
                    </div>
                  ) : null;
                })()}
                {!detailedOptionGroups(detailsItem, 'ar').length ? (
                  <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-500">
                    لا توجد اختيارات إضافية لهذا الصنف
                  </div>
                ) : null}
              </div>
            </div>
          </div>
            );
          })()
        ) : null}
        </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(cancelReasonItem)}
        title="سبب الإلغاء"
        description=""
        confirmLabel="إغلاق"
        cancelLabel={null}
        onConfirm={() => setCancelReasonItem(null)}
        onCancel={() => setCancelReasonItem(null)}
      >
        <div className="space-y-3 text-right">
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {cancelReasonItem ? (
              extractCancelReason(cancelReasonItem.selectedOptions ?? {}) || 'لم يتم تسجيل سبب الإلغاء لهذا الصنف.'
            ) : null}
          </div>
        </div>
      </ConfirmDialog>

        <ConfirmDialog
          open={Boolean(closeOrder)}
        title="هل تريد إغلاق الطاولة؟"
        description={closeOrder ? `سيتم إغلاق الطاولة ${closeOrder.table?.tableNumber ?? ''} فورًا.` : ''}
        confirmLabel="نعم"
        cancelLabel="لا"
        onConfirm={confirmCloseTable}
        onCancel={() => setCloseOrder(null)}
      />
    </AdminShell>
  );
}
