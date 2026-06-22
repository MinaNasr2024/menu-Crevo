import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { AdminShell } from '../components/AdminShell';
import { StatCard } from '../components/StatCard';
import { formatCurrency } from '../lib/format';
import { useWindowDataChanged } from '../hooks/useWindowDataChanged';

const defaultRange = {
  from: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10),
  to: new Date().toISOString().slice(0, 10)
};

function SectionCard({ title, children, className = '' }) {
  return (
    <section className={`glass-panel rounded-[32px] p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="site-heading text-xl font-bold text-cream">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ message }) {
  return (
    <div className="rounded-[24px] border border-dashed border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-white/55">
      {message}
    </div>
  );
}

function DonutChart({ items }) {
  const total = Math.max(1, items.reduce((sum, item) => sum + Number(item.value ?? 0), 0));
  let acc = 0;
  const radius = 44;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr] lg:items-center">
      <svg viewBox="0 0 120 120" className="mx-auto h-[220px] w-[220px]">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14" />
        {items.map((item, index) => {
          const segment = (Number(item.value ?? 0) / total) * circumference;
          const offset = circumference - acc;
          acc += segment;
          return (
            <circle
              key={`${item.label}-${index}`}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth="14"
              strokeDasharray={`${segment} ${circumference - segment}`}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
            />
          );
        })}
        <text x="60" y="57" textAnchor="middle" className="fill-white text-[13px] font-bold">{items.length}</text>
        <text x="60" y="75" textAnchor="middle" className="fill-white/60 text-[9px]">items</text>
      </svg>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-white/85">{item.label}</span>
              <span className="font-bold" style={{ color: item.color }}>{item.value}</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-white/10">
              <div className="h-2 rounded-full" style={{ width: `${(Number(item.value ?? 0) / total) * 100}%`, background: item.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChart({ items, color = '#d7a439' }) {
  const width = 980;
  const height = 280;
  const padding = 28;
  const values = items.map((item) => Number(item.value ?? 0));
  const max = Math.max(1, ...values);
  const points = items.map((item, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(1, items.length - 1);
    const y = height - padding - (Number(item.value ?? 0) / max) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black/10 p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[280px] w-full">
        {[0.25, 0.5, 0.75, 1].map((fraction) => (
          <line
            key={fraction}
            x1={padding}
            x2={width - padding}
            y1={height - padding - (height - padding * 2) * fraction}
            y2={height - padding - (height - padding * 2) * fraction}
            stroke="rgba(255,255,255,0.08)"
            strokeDasharray="6 8"
          />
        ))}
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points}
        />
        {items.map((item, index) => {
          const x = padding + (index * (width - padding * 2)) / Math.max(1, items.length - 1);
          const y = height - padding - (Number(item.value ?? 0) / max) * (height - padding * 2);
          return <circle key={`${item.label}-${index}`} cx={x} cy={y} r="5" fill={color} />;
        })}
      </svg>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {items.slice(0, 8).map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
            <div className="font-semibold text-white">{item.label}</div>
            <div className="mt-1">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDailyLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value ?? '');
  return new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function formatMonthlyLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value ?? '');
  return new Intl.DateTimeFormat('ar-EG', {
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function getOrderTimestamp(order) {
  const raw = order?.createdAt ?? order?.created_at ?? order?.createdOn ?? order?.date ?? order?.orderDate;
  const value = raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(value) ? value : null;
}

function isCancelledOrder(order) {
  return String(order?.status ?? '').toLowerCase() === 'cancelled';
}

function getOrderAmount(order) {
  const amount = Number(order?.totalAmount ?? order?.total ?? order?.amount ?? order?.finalTotal ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function getCairoParts(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour
  };
}

function getCairoWeekday(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const weekday = new Intl.DateTimeFormat('ar-EG', {
    timeZone: 'Africa/Cairo',
    weekday: 'long'
  }).format(date);
  return weekday;
}

function groupSalesSeries(orders, granularity) {
  const map = new Map();
  for (const order of orders) {
    const timeMs = getOrderTimestamp(order);
    if (timeMs === null) continue;
    const cairo = getCairoParts(timeMs);
    if (!cairo) continue;
    const key = granularity === 'month'
      ? `${cairo.year}-${cairo.month}`
      : `${cairo.year}-${cairo.month}-${cairo.day}`;
    const current = map.get(key) ?? 0;
    map.set(key, current + getOrderAmount(order));
  }
  return [...map.entries()]
    .sort(([a], [b]) => String(a).localeCompare(String(b)))
    .map(([label, value]) => ({ label, value: Number(value.toFixed(2)) }));
}

function groupCountSeries(orders, granularity) {
  const map = new Map();
  for (const order of orders) {
    const timeMs = getOrderTimestamp(order);
    if (timeMs === null) continue;
    const cairo = getCairoParts(timeMs);
    if (!cairo) continue;
    const key = granularity === 'month'
      ? `${cairo.year}-${cairo.month}`
      : `${cairo.year}-${cairo.month}-${cairo.day}`;
    const current = map.get(key) ?? 0;
    map.set(key, current + 1);
  }
  return [...map.entries()]
    .sort(([a], [b]) => String(a).localeCompare(String(b)))
    .map(([label, value]) => ({ label, value }));
}

function groupHoursSeries(orders) {
  const map = new Map();
  for (const order of orders) {
    const timeMs = getOrderTimestamp(order);
    if (timeMs === null) continue;
    const cairo = getCairoParts(timeMs);
    if (!cairo) continue;
    const hour = Number(cairo.hour);
    const current = map.get(hour) ?? 0;
    map.set(hour, current + 1);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, value]) => ({ label: `${String(hour).padStart(2, '0')}:00`, value }));
}

function groupHoursDetailed(orders) {
  const map = new Map();
  for (const order of orders) {
    const timeMs = getOrderTimestamp(order);
    if (timeMs === null) continue;
    const cairo = getCairoParts(timeMs);
    if (!cairo) continue;
    const hour = Number(cairo.hour);
    const current = map.get(hour) ?? { hour, orders: 0, revenue: 0 };
    current.orders += 1;
    current.revenue += getOrderAmount(order);
    map.set(hour, current);
  }
  return [...map.values()]
    .sort((a, b) => b.orders - a.orders || b.revenue - a.revenue)
    .map((item) => ({
      label: `${String(item.hour).padStart(2, '0')}:00`,
      orders: item.orders,
      revenue: Number(item.revenue.toFixed(2))
    }));
}

function groupWeekdaysDetailed(orders) {
  const weekdayOrder = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
  const map = new Map(weekdayOrder.map((day) => [day, { day, orders: 0, revenue: 0 }]));
  for (const order of orders) {
    const timeMs = getOrderTimestamp(order);
    if (timeMs === null) continue;
    const weekday = getCairoWeekday(timeMs);
    if (!weekday || !map.has(weekday)) continue;
    const current = map.get(weekday);
    current.orders += 1;
    current.revenue += getOrderAmount(order);
  }
  return weekdayOrder
    .map((day) => map.get(day))
    .filter((item) => item.orders > 0 || item.revenue > 0)
    .map((item) => ({
      label: item.day,
      orders: item.orders,
      revenue: Number(item.revenue.toFixed(2))
    }));
}

export function DailyReportsPage() {
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [reportType, setReportType] = useState('daily');
  const [executive, setExecutive] = useState(null);
  const [sales, setSales] = useState(null);
  const [products, setProducts] = useState(null);
  const [categories, setCategories] = useState(null);
  const [time, setTime] = useState(null);
  const [financial, setFinancial] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadReports() {
    const [financialResult, ordersResult] = await Promise.allSettled([
      api.biFinancial({ from, to, period: reportType }),
      api.orders()
    ]);

    if (financialResult.status === 'fulfilled') {
      setFinancial(financialResult.value);
    } else {
      setFinancial(null);
    }

    if (ordersResult.status === 'fulfilled') {
      setOrders(Array.isArray(ordersResult.value) ? ordersResult.value : []);
    } else {
      setOrders([]);
    }

    return {
      financialOk: financialResult.status === 'fulfilled',
      ordersOk: ordersResult.status === 'fulfilled'
    };
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    loadReports()
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [from, to, reportType]);

  useWindowDataChanged(() => {
    setLoading(true);
    setError('');
    loadReports()
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  });

  const filteredOrders = useMemo(() => {
    const fromMs = new Date(`${from}T00:00:00`).getTime();
    const toMs = new Date(`${to}T23:59:59`).getTime();
    return orders.filter((order) => {
      const timeMs = getOrderTimestamp(order);
      return timeMs !== null ? timeMs >= fromMs && timeMs <= toMs : false;
    });
  }, [orders, from, to]);

  const paidOrders = useMemo(() => filteredOrders.filter((order) => !isCancelledOrder(order)), [filteredOrders]);
  const dailySeries = useMemo(() => groupSalesSeries(paidOrders, 'day'), [paidOrders]);
  const monthlySeries = useMemo(() => groupSalesSeries(paidOrders, 'month'), [paidOrders]);
  const dailyCountSeries = useMemo(() => groupCountSeries(paidOrders, 'day'), [paidOrders]);
  const monthlyCountSeries = useMemo(() => groupCountSeries(paidOrders, 'month'), [paidOrders]);
  const timeSeries = useMemo(() => groupHoursSeries(paidOrders), [paidOrders]);
  const hourlyTimeDetails = useMemo(() => groupHoursDetailed(paidOrders), [paidOrders]);
  const weekdayTimeDetails = useMemo(() => groupWeekdaysDetailed(paidOrders), [paidOrders]);
  const busiestHour = hourlyTimeDetails[0] ?? null;
  const busiestDay = weekdayTimeDetails[0] ?? null;
  const topTimeWindows = [...hourlyTimeDetails].slice(0, 3);
  const reportSummaryItems = reportType === 'monthly'
    ? monthlySeries.map((item) => ({ label: formatMonthlyLabel(item.label), value: item.value }))
    : dailySeries.map((item) => ({ label: formatDailyLabel(item.label), value: item.value }));
  const totalRevenue = paidOrders.reduce((sum, order) => sum + getOrderAmount(order), 0);
  const totalOrders = paidOrders.length;
  const periodCount = reportType === 'monthly' ? monthlyCountSeries.length : dailyCountSeries.length;
  const averageOrder = paidOrders.length ? totalRevenue / paidOrders.length : 0;
  const topProducts = useMemo(() => {
    const counts = new Map();
    for (const order of paidOrders) {
      for (const item of order.items ?? []) {
        const key = item.product?.id ?? item.productId;
        if (!key) continue;
        const current = counts.get(key) ?? {
          id: key,
          name_ar: item.product?.nameAr ?? item.product?.nameEn ?? 'Product',
          name_en: item.product?.nameEn ?? item.product?.nameAr ?? 'Product',
          quantity_sold: 0
        };
        current.quantity_sold += Number(item.quantity ?? 0);
        counts.set(key, current);
      }
    }
    return [...counts.values()]
      .sort((a, b) => Number(b.quantity_sold) - Number(a.quantity_sold))
      .slice(0, 5)
      .map((item, index) => ({
        label: item.name_ar || item.name_en || `Product ${index + 1}`,
        value: Number(item.quantity_sold ?? 0),
        color: ['#d7a439', '#ef4444', '#06b6d4', '#22c55e', '#a855f7'][index % 5]
      }));
  }, [paidOrders]);
  const topCategories = useMemo(() => {
    const counts = new Map();
    for (const order of paidOrders) {
      for (const item of order.items ?? []) {
        const categoryName = item.product?.category?.nameAr ?? item.product?.category?.nameEn ?? 'Category';
        const current = counts.get(categoryName) ?? { name: categoryName, quantity_sold: 0 };
        current.quantity_sold += Number(item.quantity ?? 0);
        counts.set(categoryName, current);
      }
    }
    return [...counts.values()]
      .sort((a, b) => Number(b.quantity_sold) - Number(a.quantity_sold))
      .slice(0, 6)
      .map((item, index) => ({
        label: item.name || `Category ${index + 1}`,
        value: Number(item.quantity_sold ?? 0),
        color: ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#a855f7', '#14b8a6'][index % 6]
      }));
  }, [paidOrders]);
  const ordersSectionTitle = reportType === 'monthly'
    ? 'التقرير الشهري'
    : reportType === 'daily'
      ? 'التقرير اليومي'
      : 'التقرير بالطلب الواحد';
  const expenses = Number(financial?.expenseReports?.expenses ?? financial?.profitAndLoss?.expenses ?? 0);
  const netProfit = totalRevenue - expenses;

  return (
    <AdminShell title="التقارير اليومية">
      <div className="space-y-6">
        <header className="glass-panel rounded-[32px] p-5 sm:p-6 shadow-glow">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">التقارير والتحليلات</p>
              <h1 className="site-heading mt-2 text-3xl font-bold text-cream">تقارير يومية مفصلة</h1>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[620px] xl:grid-cols-3">
              <label className="block space-y-2">
                <span className="text-xs text-white/55">من تاريخ</span>
                <input className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="block space-y-2">
                <span className="text-xs text-white/55">إلى تاريخ</span>
                <input className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
              <label className="block space-y-2">
                <span className="text-xs text-white/55">نوع التقرير</span>
                <div className="relative">
                  <select
                    className="w-full appearance-none rounded-2xl border border-white/10 bg-[#11131a] px-4 py-3 pr-12 text-white outline-none"
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                  >
                    <option className="bg-slate-900 text-white" value="single">تقرير بالطلب الواحد</option>
                    <option className="bg-slate-900 text-white" value="daily">تقرير باليوم</option>
                    <option className="bg-slate-900 text-white" value="monthly">تقرير بالشهر</option>
                  </select>
                  <svg
                    className="pointer-events-none absolute inset-y-0 right-4 my-auto h-4 w-4 text-white/65"
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </label>
            </div>
          </div>
        </header>

        {error ? <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}
        {loading ? <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">جارٍ تحميل البيانات...</div> : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="إجمالي الطلبات" value={totalOrders} />
          <StatCard label={reportType === 'single' ? 'إجمالي المبلغ' : 'إجمالي المبيعات'} value={formatCurrency(totalRevenue)} />
          <StatCard label={reportType === 'single' ? 'متوسط قيمة الطلب' : 'متوسط المبيعات'} value={formatCurrency(averageOrder)} />
          <StatCard
            label={reportType === 'single' ? 'الفترة المحددة' : reportType === 'monthly' ? 'عدد الشهور' : 'عدد الأيام'}
            value={reportType === 'single' ? `${from} → ${to}` : periodCount}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <SectionCard title={reportType === 'monthly' ? 'معدل المبيعات الشهري' : 'معدل المبيعات اليومي'}>
            {reportSummaryItems.length ? (
              <LineChart items={reportSummaryItems} color="#d7a439" />
            ) : (
              <EmptyState message="لا توجد بيانات كافية لعرض الرسم البياني." />
            )}
          </SectionCard>

          <SectionCard title="المنتجات الأكثر مبيعًا">
            {topProducts.length ? (
              <DonutChart items={topProducts} />
            ) : (
              <EmptyState message="لا توجد بيانات منتجات متاحة." />
            )}
          </SectionCard>
        </section>

        <SectionCard title="تحليلات الوقت">
          {hourlyTimeDetails.length || weekdayTimeDetails.length ? (
            <div className="space-y-6">
              <div className="grid gap-4 xl:grid-cols-3">
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.3em] text-white/45">أعلى ساعة</div>
                  <div className="mt-2 text-2xl font-bold text-cream">{busiestHour?.label ?? 'غير متاح'}</div>
                  <div className="mt-1 text-sm text-white/60">
                    {busiestHour ? `${busiestHour.orders} طلبات • ${formatCurrency(busiestHour.revenue)}` : 'لا توجد بيانات كافية'}
                  </div>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.3em] text-white/45">أعلى يوم</div>
                  <div className="mt-2 text-2xl font-bold text-cream">{busiestDay?.label ?? 'غير متاح'}</div>
                  <div className="mt-1 text-sm text-white/60">
                    {busiestDay ? `${busiestDay.orders} طلبات • ${formatCurrency(busiestDay.revenue)}` : 'لا توجد بيانات كافية'}
                  </div>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.3em] text-white/45">أفضل 3 فترات</div>
                  <div className="mt-2 space-y-2 text-sm text-white/75">
                    {topTimeWindows.length ? topTimeWindows.map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-3">
                        <span>{item.label}</span>
                        <span className="font-semibold text-gold">{item.orders} طلبات</span>
                      </div>
                    )) : <div className="text-white/55">لا توجد بيانات كافية</div>}
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-[28px] border border-white/10 bg-black/10 p-4">
                  <h3 className="mb-4 text-lg font-bold text-cream">توزيع الطلبات بالساعة</h3>
                  {timeSeries.length ? (
                    <LineChart items={timeSeries} color="#22c55e" />
                  ) : (
                    <EmptyState message="لا توجد بيانات وقت متاحة." />
                  )}
                </div>
                <div className="rounded-[28px] border border-white/10 bg-black/10 p-4">
                  <h3 className="mb-4 text-lg font-bold text-cream">الطلبات والمبيعات حسب اليوم</h3>
                  {weekdayTimeDetails.length ? (
                    <div className="space-y-3">
                      {weekdayTimeDetails.map((item) => (
                        <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="text-white/85">{item.label}</span>
                            <span className="font-semibold text-gold">{item.orders} طلبات</span>
                          </div>
                          <div className="mt-2 text-xs text-white/55">
                            إجمالي المبيعات: {formatCurrency(item.revenue)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState message="لا توجد بيانات أيام متاحة." />
                  )}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState message="لا توجد بيانات وقت متاحة." />
          )}
        </SectionCard>

        <SectionCard title="أهم الأقسام">
          {topCategories.length ? (
            <DonutChart items={topCategories} />
          ) : (
            <EmptyState message="لا توجد بيانات أقسام متاحة." />
          )}
        </SectionCard>

        {reportType === 'single' ? (
          <SectionCard title={ordersSectionTitle}>
            {paidOrders.length ? (
              <div className="space-y-3">
                {paidOrders.map((order) => {
                  const amount = Number(order.totalAmount ?? order.total ?? order.amount ?? order.finalTotal ?? 0);
                  const tableNumber = order.tableNumber ?? order.table?.tableNumber ?? '-';
                  const created = order.createdAt ?? order.created_at ?? order.createdOn ?? order.date ?? '';
                  return (
                    <div key={order.id ?? `${created}-${tableNumber}`} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-white">طلب رقم {order.id ?? '-'}</div>
                          <div className="mt-1 text-sm text-white/60">طاولة {tableNumber} • {created ? new Date(created).toLocaleString('ar-EG') : 'غير متاح'}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.2em] text-white/45">{ordersSectionTitle}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-white/55">الإجمالي</div>
                          <div className="text-lg font-bold text-[var(--site-button)]">{formatCurrency(amount)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState message="لا توجد طلبات داخل الفترة المحددة." />
            )}
          </SectionCard>
        ) : (
          <SectionCard title={ordersSectionTitle}>
            {reportSummaryItems.length ? (
              <div className="space-y-3">
                {reportSummaryItems.map((item) => (
                  <div key={item.label} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white">{item.label}</div>
                        <div className="mt-1 text-sm text-white/55">
                          {reportType === 'monthly' ? 'مبيعات هذا الشهر' : 'مبيعات هذا اليوم'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-white/55">الإجمالي</div>
                        <div className="text-lg font-bold text-[var(--site-button)]">{formatCurrency(item.value)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message={reportType === 'monthly' ? 'لا توجد مبيعات شهرية داخل الفترة المحددة.' : 'لا توجد مبيعات يومية داخل الفترة المحددة.'} />
            )}
          </SectionCard>
        )}

        <SectionCard title="الملخص المالي">
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="الإيراد" value={formatCurrency(totalRevenue)} />
            <StatCard label="المصروفات" value={formatCurrency(expenses)} />
            <StatCard label="صافي الربح" value={formatCurrency(netProfit)} />
          </div>
        </SectionCard>
      </div>
    </AdminShell>
  );
}
