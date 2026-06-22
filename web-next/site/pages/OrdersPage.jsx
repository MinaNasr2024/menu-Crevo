import { useEffect, useMemo, useState } from 'react';
import { AdminShell } from '../components/AdminShell';
import { api } from '../lib/api';
import { formatCurrency } from '../lib/format';
import { resolveMediaUrl } from '../components/ProductMedia';

const statusLabels = {
  pending: 'قيد الانتظار',
  completed: 'مكتمل',
  cancelled: 'ملغي'
};

const statusButtons = [
  { value: 'pending', label: 'قيد الانتظار' },
  { value: 'completed', label: 'تم التسليم' },
  { value: 'cancelled', label: 'ملغي' }
];

export function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [message, setMessage] = useState('');

  function isHistoricalOrder(order) {
    const createdAt = order?.createdAt ? new Date(order.createdAt).getTime() : null;
    const openedAt = order?.table?.openedAt ? new Date(order.table.openedAt).getTime() : null;
    if (!createdAt) return false;
    if (!openedAt) return true;
    return createdAt < openedAt;
  }

  async function refresh() {
    const data = await api.orders();
    setOrders(data);
  }

  useEffect(() => {
    refresh().catch((error) => setMessage(error.message));
  }, []);

  const visibleOrders = useMemo(() => {
    if (statusFilter === 'all') return orders;
    return orders.filter((order) => order.status === statusFilter);
  }, [orders, statusFilter]);

  const groupedOrders = useMemo(() => {
    const groups = new Map();
    for (const order of visibleOrders) {
      const tableId = order.table?.id ?? order.tableId ?? 'unknown';
      const tableNumber = order.table?.tableNumber ?? 'غير محدد';
      const current = groups.get(tableId) ?? { tableId, tableNumber, orders: [] };
      current.orders.push(order);
      groups.set(tableId, current);
    }
    return Array.from(groups.values());
  }, [visibleOrders]);

  async function updateStatus(orderId, status) {
    try {
      await api.updateOrderStatus(orderId, status);
      await refresh();
      setMessage('تم تحديث حالة الطلب');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function closeTable(group) {
    const firstOrder = group.orders[0];
    const tableUuid = firstOrder?.table?.qrCodeUuid;
    const phone = firstOrder?.table?.currentPhone;
    const session = firstOrder?.table?.sessionUuid;

    if (!tableUuid || !phone) {
      setMessage('لا يمكن إغلاق الطاولة لأن بيانات الفتح غير متوفرة');
      return;
    }

    try {
      await api.closeTable({ uuid: tableUuid, phone, session });
      await refresh();
      setMessage(`تم إغلاق الطاولة ${group.tableNumber}`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <AdminShell title="الطلبات">
      <div className="space-y-6">
        <section className="glass-panel rounded-[32px] p-6 shadow-glow">
          <div className="flex flex-wrap items-start justify-between gap-4">
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

        <section className="space-y-6">
          {groupedOrders.map((group) => {
            const groupTotal = group.orders.reduce(
              (sum, order) => sum + order.items.reduce((sub, item) => sub + Number(item.priceAtSale) * item.quantity, 0),
              0
            );

            return (
              <article key={group.tableId} className="glass-panel rounded-[32px] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-cream">الطاولة {group.tableNumber}</h2>
                    <p className="mt-1 text-sm text-white/60">{group.orders.length} طلب</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
                      الإجمالي: {formatCurrency(groupTotal)}
                    </div>
                    <button
                      type="button"
                      onClick={() => closeTable(group)}
                      className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/20"
                    >
                      إغلاق الطاولة
                    </button>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  {group.orders.map((order) => {
                    const total = order.items.reduce((sum, item) => sum + Number(item.priceAtSale) * item.quantity, 0);
                    const historical = isHistoricalOrder(order);
                    return (
                      <div
                        key={order.id}
                        className={`rounded-[28px] border p-4 transition ${
                          historical
                            ? 'border-white/[0.04] bg-black/15 opacity-35 grayscale contrast-75 saturate-0 shadow-none'
                            : 'border-white/10 bg-white/5'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <h3 className="text-xl font-bold text-cream">طلب #{order.id}</h3>
                            <p className="mt-1 text-sm text-white/60">
                              {new Date(order.createdAt).toLocaleString('ar-EG')}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.35em] text-gold">
                              {statusLabels[order.status] ?? order.status}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
                            الإجمالي: {formatCurrency(total)}
                          </div>
                        </div>

                        <div className="mt-5 space-y-3">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                              <div className="h-16 w-16 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                                <img
                                  src={resolveMediaUrl(item.product?.coverMediaUrl)}
                                  alt={item.product?.nameAr ?? item.product?.nameEn ?? 'صورة المنتج'}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="font-semibold text-cream">{item.product?.nameAr ?? item.product?.nameEn}</p>
                                    <p className="mt-1 text-xs text-white/55">
                                      الكمية: {item.quantity} • سعر الوحدة: {formatCurrency(item.priceAtSale)}
                                    </p>
                                  </div>
                                  <div className="text-sm font-semibold text-gold">
                                    {formatCurrency(Number(item.priceAtSale) * item.quantity)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2">
                          {statusButtons.map((button) => (
                            <button
                              key={button.value}
                              type="button"
                              onClick={() => updateStatus(order.id, button.value)}
                              className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-white/75 transition hover:bg-white/5"
                            >
                              {button.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </section>

        {groupedOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-white/60">
            لا توجد طلبات مطابقة لهذا الفلتر.
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
