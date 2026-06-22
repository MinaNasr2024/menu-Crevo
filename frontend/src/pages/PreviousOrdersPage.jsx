import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { AdminShell } from '../components/AdminShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { resolveMediaUrl } from '../components/ProductMedia';
import { api, getApiBase, getSocketBase } from '../lib/api';
import { formatCurrency } from '../lib/format';
import { useWindowDataChanged } from '../hooks/useWindowDataChanged';

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

function getOrderTotal(order = {}) {
  const storedTotal = Number(order?.totalAmount ?? NaN);
  if (Number.isFinite(storedTotal)) return storedTotal;
  const items = Array.isArray(order.items) ? order.items : [];
  return items.reduce((sum, item) => sum + Number(item.priceAtSale ?? 0) * Number(item.quantity ?? 0), 0);
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
    || selectedOptions.offerGroupSelections?.length
  );
}

function getItemDisplayName(item = {}, lang = 'ar') {
  const selectedOptions = normalizeSelectedOptions(item.selectedOptions ?? {});
  if (isOfferItem(item)) {
    return lang === 'ar'
      ? (item.displayNameAr || selectedOptions.displayNameAr || selectedOptions.offerNameAr || item.displayNameEn || selectedOptions.displayNameEn || selectedOptions.offerNameEn || 'العرض')
      : (item.displayNameEn || selectedOptions.displayNameEn || selectedOptions.offerNameEn || item.displayNameAr || selectedOptions.displayNameAr || selectedOptions.offerNameAr || 'Offer');
  }
  return lang === 'ar'
    ? (item.product?.nameAr ?? item.product?.nameEn ?? 'صنف')
    : (item.product?.nameEn ?? item.product?.nameAr ?? 'Item');
}

function getItemDisplayImageUrl(item = {}) {
  const selectedOptions = normalizeSelectedOptions(item.selectedOptions ?? {});
  return item.displayImageUrl || selectedOptions.displayImageUrl || selectedOptions.offerImageUrl || item.offer?.imageUrl || item.product?.coverMediaUrl || '';
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
  return directCandidates.map((value) => String(value ?? '').trim()).find(Boolean) || '';
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
  return toArray(selectedOptions.customChoiceSelections).map((selection, index) => {
    const group = toArray(product.customChoiceGroups).find((candidate) => String(candidate?.id) === String(selection.groupId));
    const fallbackTitle = lang === 'ar' ? `حقل اختياري ${index + 1}` : `Custom field ${index + 1}`;
    const title = lang === 'ar'
      ? (selection.groupTitleAr || selection.groupTitleEn || group?.titleAr || group?.titleEn || fallbackTitle)
      : (selection.groupTitleEn || selection.groupTitleAr || group?.titleEn || group?.titleAr || fallbackTitle);
    const fallbackValue = String(selection.choiceId ?? '').trim();
    const value = lang === 'ar'
      ? (selection.choiceLabelAr || selection.choiceLabelEn || fallbackValue)
      : (selection.choiceLabelEn || selection.choiceLabelAr || fallbackValue);
    return { title, value };
  }).filter((group) => group.title || group.value);
}

function offerSelectionGroups(item = {}, lang = 'ar') {
  const selectedOptions = normalizeSelectedOptions(item.selectedOptions ?? {});
  const rawSelections = toArray(selectedOptions.offerGroupSelections).length
    ? toArray(selectedOptions.offerGroupSelections)
    : toArray(selectedOptions.selectedOfferItems);
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
}

function detailedOptionGroups(item = {}, lang = 'ar') {
  const selectedOptions = normalizeSelectedOptions(item.selectedOptions ?? {});
  const product = item.product ?? {};
  const groups = [];
  const offerSelections = toArray(selectedOptions.offerGroupSelections).length
    ? toArray(selectedOptions.offerGroupSelections)
    : toArray(selectedOptions.selectedOfferItems);
  const isOffer = Boolean(
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
    || offerSelections.length
  );

  const sizeLabel = selectedOptions.sizeLabelAr
    || selectedOptions.sizeLabelEn
    || labelForOption(product.sizeOptions, selectedOptions.sizeId, lang);
  if (sizeLabel) {
    groups.push({ title: lang === 'ar' ? 'الحجم' : 'Size', value: sizeLabel });
  }

  const addonLabels = toArray(selectedOptions.addonLabelsAr).length
    ? toArray(selectedOptions.addonLabelsAr)
    : toArray(selectedOptions.addonIds).map((id) => labelForOption(product.addonOptions, id, lang)).filter(Boolean);
  if (addonLabels.length) {
    groups.push({ title: lang === 'ar' ? 'الإضافات' : 'Add-ons', value: addonLabels.join('، ') });
  }

  const sideDishLabels = toArray(selectedOptions.sideDishLabelsAr).length
    ? toArray(selectedOptions.sideDishLabelsAr)
    : toArray(selectedOptions.sideDishIds).map((id) => labelForOption(product.sideDishOptions, id, lang)).filter(Boolean);
  if (sideDishLabels.length) {
    groups.push({ title: lang === 'ar' ? 'الأطباق الإضافية' : 'Extras', value: sideDishLabels.join('، ') });
  }

  for (const group of customChoiceGroups(item, lang)) {
    groups.push(group);
  }

  if (isOffer) {
    for (const selection of offerSelectionGroups(item, lang)) {
      groups.push(selection);
    }
  }

  return groups;
}

function isHistoricalOrder(order) {
  const createdAt = order?.createdAt ? new Date(order.createdAt).getTime() : null;
  const openedAt = order?.table?.openedAt ? new Date(order.table.openedAt).getTime() : null;
  const tableClosed = Boolean(order?.table) && !order?.table?.currentPhone && !order?.table?.openedAt;
  if (!createdAt) return false;
  if (!order?.table) return true;
  if (tableClosed) return true;
  if (!openedAt) return order.status === 'cancelled';
  return createdAt < openedAt || order.status === 'cancelled';
}

function buildSessionKey(order = {}) {
  const tableId = String(order?.table?.id ?? order?.tableId ?? 'unknown');
  const archivedAt = order?.archivedAt ? new Date(order.archivedAt) : null;
  const archivedBucket = archivedAt && !Number.isNaN(archivedAt.getTime())
    ? archivedAt.toISOString().slice(0, 19)
    : '';
  const sessionKey = String(
    order?.sessionGroupKey
    ?? order?.sessionUuid
    ?? archivedBucket
    ?? order?.sessionOpenedAt
    ?? order?.table?.openedAt
    ?? order?.createdAt
    ?? ''
  ).trim();
  return `${tableId}:${sessionKey || 'session'}`;
}

export function PreviousOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState('');
  const [detailsItem, setDetailsItem] = useState(null);

  async function refresh() {
    const data = await api.previousOrders();
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
      socket = io(getSocketBase() || getApiBase(), { transports: ['websocket'] });
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
      }, 15000);
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

  const closedOrders = useMemo(() => {
    return orders.filter((order) => Boolean(order?.table) || Boolean(order?.tableId));
  }, [orders]);

  const groupedOrders = useMemo(() => {
    const bySession = new Map();
    const sortedOrders = closedOrders.slice().sort((a, b) => {
      const timeA = new Date(a?.createdAt ?? a?.archivedAt ?? 0).getTime();
      const timeB = new Date(b?.createdAt ?? b?.archivedAt ?? 0).getTime();
      return timeB - timeA;
    });

    for (const order of sortedOrders) {
      const sessionKey = buildSessionKey(order);
      const bucket = bySession.get(sessionKey) ?? {
        tableId: sessionKey,
        sessionUuid: order?.sessionUuid ?? order?.sessionOpenedAt ?? order?.archivedAt ?? order?.table?.openedAt ?? null,
        tableNumber: order?.table?.tableNumber ?? 'غير محدد',
        tableColor: order?.table?.tableColor || '#d4af37',
        table: order?.table ?? null,
        orders: []
      };
      bucket.orders.push(order);
      if (!bucket.table && order?.table) bucket.table = order.table;
      bySession.set(sessionKey, bucket);
    }

    return [...bySession.values()].map((group) => ({
      ...group,
      orders: group.orders.slice().sort((a, b) => {
        const timeA = new Date(a?.createdAt ?? a?.archivedAt ?? 0).getTime();
        const timeB = new Date(b?.createdAt ?? b?.archivedAt ?? 0).getTime();
        return timeB - timeA;
      })
    }));
  }, [closedOrders]);

  return (
    <AdminShell title="الطلبات السابقة">
      <div className="space-y-6">
        <section className="glass-panel rounded-[32px] p-5 sm:p-6 shadow-glow">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">أرشيف الطاولات المغلقة</p>
              <h1 className="mt-2 text-3xl font-bold text-cream">الطلبات السابقة</h1>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
              عدد جلسات الإغلاق: {groupedOrders.length}
            </div>
          </div>
          {message ? <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">{message}</p> : null}
        </section>

        <section className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-2">
          {groupedOrders.map((tableGroup) => {
            const tableOrders = tableGroup.orders;
            const total = tableOrders.reduce((outerSum, order) => outerSum + getOrderTotal(order), 0);
            const orderNumbers = tableOrders.map((order) => order.orderNumber ?? order.id).join('، ');
            const createdAt = tableOrders.length ? formatDateTime(tableOrders[0].createdAt) : 'غير متاح';

            return (
              <article
                key={tableGroup.tableId}
                className="glass-panel rounded-[32px] border border-white/10 bg-white/[0.03] p-5 opacity-60 shadow-none saturate-0"
                style={{
                  borderColor: tableGroup.tableColor,
                  boxShadow: `0 0 0 1px ${tableGroup.tableColor}14 inset`
                }}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full border border-white/20"
                        style={{ backgroundColor: tableGroup.tableColor }}
                      />
                      <h2 className="text-2xl font-bold text-cream">الطاولة {tableGroup.tableNumber}</h2>
                    </div>
                    <p className="mt-1 text-sm text-white/60">الطلبات: #{orderNumbers}</p>
                    {tableGroup.sessionUuid ? (
                      <p className="mt-1 text-xs text-white/40">
                        الجلسة: {new Date(tableGroup.sessionUuid).toLocaleString('ar-EG')}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-white/45">{createdAt}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <p className="text-xs uppercase tracking-[0.35em] text-white/30">مغلقة</p>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/35">
                        منتهية
                      </span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
                    الإجمالي: {formatCurrency(total)}
                  </div>
                </div>

                <div className="mt-5 space-y-6 opacity-85">
                  {tableOrders.map((order) => (
                    <div key={order.id} className="space-y-3 rounded-[28px] border border-white/10 bg-black/20 p-4 opacity-85">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-bold text-cream">طلب #{order.orderNumber ?? order.id}</h3>
                          <p className="mt-1 text-xs text-white/45">{formatDateTime(order.createdAt)}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
                          الإجمالي: {formatCurrency(getOrderTotal(order))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        {order.items.map((item) => {
                          const lines = detailedOptionGroups(item, 'ar');
                          return (
                              <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 opacity-90">
                                <div className="h-16 w-16 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                                  <img
                                    src={resolveMediaUrl(getItemDisplayImageUrl(item))}
                                    alt={getItemDisplayName(item, 'ar') ?? 'صورة المنتج'}
                                    className="h-full w-full object-cover opacity-85"
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      {isOfferItem(item) ? (
                                        <div className="mb-1 inline-flex rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-100">
                                          عرض مجمّع
                                        </div>
                                      ) : null}
                                      <p className="font-semibold text-cream/90">{getItemDisplayName(item, 'ar')}</p>
                                      <p className="mt-1 text-xs text-white/45">
                                        الكمية: {item.quantity} • سعر الوحدة: {formatCurrency(item.priceAtSale)}
                                      </p>
                                     {lines.length ? (
                                       <div className="mt-2 space-y-1 text-xs text-white/45">
                                        {lines.map((line) => (
                                          <div key={`${item.id}-${line.title}`} className="space-y-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                                            <p>
                                              <span className="font-semibold text-white/65">{line.title}:</span> {line.value}
                                            </p>
                                            {Array.isArray(line.details) && line.details.length ? (
                                              <div className="space-y-1 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-[11px] text-white/45">
                                                {line.details.map((detail) => (
                                                  <p key={`${item.id}-${line.title}-${detail.title}`}>
                                                    <span className="font-semibold text-white/65">{detail.title}:</span> {detail.value}
                                                  </p>
                                                ))}
                                              </div>
                                            ) : null}
                                          </div>
                                        ))}
                                       </div>
                                     ) : null}
                                  </div>
                                  <div className="text-sm font-semibold text-gold/80">
                                    {formatCurrency(Number(item.priceAtSale) * item.quantity)}
                                  </div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setDetailsItem(item)}
                                    className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-white/70 transition hover:bg-white/5"
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
                  ))}
                </div>
              </article>
            );
          })}
        </section>

        {closedOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-white/60">
            لا توجد طلبات سابقة بعد.
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={Boolean(detailsItem)}
        title={detailsItem ? `تفاصيل الصنف #${detailsItem.id}` : ''}
        description=""
        confirmLabel="إغلاق"
        cancelLabel={null}
        onConfirm={() => setDetailsItem(null)}
        onCancel={() => setDetailsItem(null)}
      >
        {detailsItem ? (
            <div className="space-y-3 text-right">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="h-44 bg-slate-100">
                  <img
                    src={resolveMediaUrl(getItemDisplayImageUrl(detailsItem))}
                    alt={getItemDisplayName(detailsItem, 'ar') ?? 'صورة المنتج'}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <div className="font-semibold text-slate-900">{getItemDisplayName(detailsItem, 'ar')}</div>
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
                      <div key={`${detailsItem.id}-${group.title}`} className="space-y-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <div>
                          <span className="font-semibold text-slate-900">{group.title}:</span> {group.value}
                        </div>
                        {Array.isArray(group.details) && group.details.length ? (
                          <div className="space-y-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                            {group.details.map((detail) => (
                              <div key={`${detailsItem.id}-${group.title}-${detail.title}`}>
                                <span className="font-semibold text-slate-900">{detail.title}:</span> {detail.value}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                {(() => {
                  const selectedOptions = normalizeSelectedOptions(detailsItem.selectedOptions ?? {});
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
        ) : null}
      </ConfirmDialog>
    </AdminShell>
  );
}
