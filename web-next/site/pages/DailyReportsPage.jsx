import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { AdminShell } from '../components/AdminShell';
import { StatCard } from '../components/StatCard';
import { formatCurrency } from '../lib/format';

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

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([
      api.biExecutive({ from, to }),
      api.biSales({ from, to, period: reportType === 'monthly' ? 'monthly' : 'daily' }),
      api.biProducts({ from, to }),
      api.biCategories({ from, to }),
      api.biTime({ from, to }),
      api.biFinancial({ from, to }),
      api.orders()
    ])
      .then(([executiveData, salesData, productData, categoryData, timeData, financialData, ordersData]) => {
        if (!active) return;
        setExecutive(executiveData);
        setSales(salesData);
        setProducts(productData);
        setCategories(categoryData);
        setTime(timeData);
        setFinancial(financialData);
        setOrders(Array.isArray(ordersData) ? ordersData : []);
      })
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

  const totalOrders = Number(executive?.kpis?.totalOrders ?? 0);
  const totalRevenue = Number(executive?.kpis?.totalRevenue ?? 0);
  const dailySeries = useMemo(() => (sales?.series ?? []).map((item) => ({
    label: String(item.period).slice(0, 10),
    value: Number(item.gross_sales ?? 0)
  })), [sales]);
  const monthlySeries = useMemo(() => (sales?.series ?? []).map((item) => ({
    label: String(item.period).slice(0, 7),
    value: Number(item.gross_sales ?? 0)
  })), [sales]);
  const topProducts = useMemo(() => (products?.topSelling ?? []).slice(0, 5).map((item, index) => ({
    label: item.name_ar || item.name_en || `Product ${index + 1}`,
    value: Number(item.quantity_sold ?? 0),
    color: ['#d7a439', '#ef4444', '#06b6d4', '#22c55e', '#a855f7'][index % 5]
  })), [products]);
  const topCategories = useMemo(() => (categories?.topCategories ?? []).slice(0, 6).map((item, index) => ({
    label: item.name_ar || item.name_en || `Category ${index + 1}`,
    value: Number(item.quantity_sold ?? 0),
    color: ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#a855f7', '#14b8a6'][index % 6]
  })), [categories]);
  const timeSeries = useMemo(() => (time?.orderVolume ?? []).map((item) => ({
    label: `${String(item.hour).padStart(2, '0')}:00`,
    value: Number(item.orders ?? 0)
  })), [time]);

  const filteredOrders = useMemo(() => {
    const fromMs = new Date(`${from}T00:00:00`).getTime();
    const toMs = new Date(`${to}T23:59:59`).getTime();
    return orders.filter((order) => {
      const raw = order.createdAt ?? order.created_at ?? order.createdOn ?? order.date ?? order.orderDate;
      const timeMs = raw ? new Date(raw).getTime() : NaN;
      return Number.isFinite(timeMs) ? timeMs >= fromMs && timeMs <= toMs : true;
    });
  }, [orders, from, to]);

  const totalFilteredAmount = useMemo(() => filteredOrders.reduce((sum, order) => {
    const amount = Number(order.totalAmount ?? order.total ?? order.amount ?? order.finalTotal ?? 0);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0), [filteredOrders]);

  const reportItems = reportType === 'monthly' ? monthlySeries : dailySeries;
  const averageOrder = totalOrders ? totalRevenue / totalOrders : 0;

  return (
    <AdminShell title="التقارير اليومية">
      <div className="space-y-6">
        <header className="glass-panel rounded-[32px] p-6 shadow-glow">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">التقارير والتحليلات</p>
              <h1 className="site-heading mt-2 text-3xl font-bold text-cream">تقارير يومية مفصلة</h1>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[620px]">
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
                <select className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" value={reportType} onChange={(e) => setReportType(e.target.value)}>
                  <option value="single">تقرير بالطلب الواحد</option>
                  <option value="daily">تقرير باليوم</option>
                  <option value="monthly">تقرير بالشهر</option>
                </select>
              </label>
            </div>
          </div>
        </header>

        {error ? <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}
        {loading ? <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">جارٍ تحميل البيانات...</div> : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="إجمالي الطلبات" value={totalOrders} />
          <StatCard label="إجمالي المبلغ" value={formatCurrency(totalRevenue)} />
          <StatCard label="متوسط قيمة الطلب" value={formatCurrency(averageOrder)} />
          <StatCard label="الطلبات داخل المدة" value={filteredOrders.length} />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <SectionCard title={reportType === 'monthly' ? 'معدل المبيعات الشهري' : 'معدل المبيعات اليومي'}>
            {reportItems.length ? (
              <LineChart items={reportItems} color="var(--site-button)" />
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

        <section className="grid gap-6 xl:grid-cols-2">
          <SectionCard title="تحليلات الوقت">
            {timeSeries.length ? (
              <LineChart items={timeSeries} color="#22c55e" />
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
        </section>

        {reportType === 'single' ? (
          <SectionCard title="التقرير بالطلب الواحد">
            {filteredOrders.length ? (
              <div className="space-y-3">
                {filteredOrders.map((order) => {
                  const amount = Number(order.totalAmount ?? order.total ?? order.amount ?? order.finalTotal ?? 0);
                  const tableNumber = order.tableNumber ?? order.table?.tableNumber ?? '-';
                  const created = order.createdAt ?? order.created_at ?? order.createdOn ?? order.date ?? '';
                  return (
                    <div key={order.id ?? `${created}-${tableNumber}`} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-white">طلب رقم {order.id ?? '-'}</div>
                          <div className="mt-1 text-sm text-white/60">طاولة {tableNumber} • {created ? new Date(created).toLocaleString('ar-EG') : 'غير متاح'}</div>
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
        ) : null}

        <SectionCard title="الملخص المالي">
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="الإيراد" value={formatCurrency(Number(financial?.profitAndLoss?.revenue ?? 0))} />
            <StatCard label="المصروفات" value={formatCurrency(Number(financial?.profitAndLoss?.expenses ?? 0))} />
            <StatCard label="صافي الربح" value={formatCurrency(Number(financial?.profitAndLoss?.net ?? 0))} />
          </div>
        </SectionCard>
      </div>
    </AdminShell>
  );
}
