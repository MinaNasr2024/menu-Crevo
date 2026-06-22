import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { StatCard } from '../components/StatCard';
import { LineBars } from '../components/LineBars';
import { AdminShell } from '../components/AdminShell';

const defaultRange = {
  from: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
  to: new Date().toISOString()
};

function ExportLink({ report, format = 'csv', label }) {
  return (
    <a
      href={api.biExport(report, format)}
      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10"
      target="_blank"
      rel="noreferrer"
    >
      {label}
    </a>
  );
}

export function InsightsPage() {
  const [executive, setExecutive] = useState(null);
  const [sales, setSales] = useState(null);
  const [products, setProducts] = useState(null);
  const [categories, setCategories] = useState(null);
  const [branches, setBranches] = useState(null);
  const [customers, setCustomers] = useState(null);
  const [time, setTime] = useState(null);
  const [financial, setFinancial] = useState(null);
  const [refreshMessage, setRefreshMessage] = useState('');
  const [range] = useState(defaultRange);

  useEffect(() => {
    Promise.all([
      api.biExecutive(range),
      api.biSales({ ...range, period: 'daily' }),
      api.biProducts(range),
      api.biCategories(range),
      api.biBranches(range),
      api.biCustomers(range),
      api.biTime(range),
      api.biFinancial(range)
    ])
      .then(([executiveData, salesData, productData, categoryData, branchData, customerData, timeData, financialData]) => {
        setExecutive(executiveData);
        setSales(salesData);
        setProducts(productData);
        setCategories(categoryData);
        setBranches(branchData);
        setCustomers(customerData);
        setTime(timeData);
        setFinancial(financialData);
      })
      .catch((error) => {
        setExecutive({ error: error.message });
      });
  }, [range]);

  const kpis = executive?.kpis ?? {};
  const scores = executive?.healthScores ?? {};
  const revenueChart = useMemo(() => sales?.series ?? [], [sales]);

  return (
    <AdminShell title="التقارير">
      <div className="space-y-6">
        <header className="glass-panel rounded-[32px] p-6 shadow-glow">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">الرؤى الذكية</p>
              <h1 className="mt-2 text-3xl font-bold text-cream">لوحة التقارير والتحليلات</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await api.refreshReports();
                    setRefreshMessage('تم تحديث التقارير بنجاح');
                    window.setTimeout(() => window.location.reload(), 500);
                  } catch (error) {
                    setRefreshMessage(error.message);
                  }
                }}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10"
              >
                تحديث التقارير
              </button>
              <ExportLink report="executive" format="csv" label="تصدير CSV" />
              <ExportLink report="executive" format="xlsx" label="تصدير Excel" />
              <ExportLink report="executive" format="print" label="عرض الطباعة" />
            </div>
          </div>
        </header>

        {refreshMessage ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
            {refreshMessage}
          </div>
        ) : null}

        {executive?.error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {executive.error}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="إجمالي الإيرادات" value={`EGP ${Number(kpis.totalRevenue ?? 0).toFixed(2)}`} />
          <StatCard label="إيرادات اليوم" value={`EGP ${Number(kpis.todayRevenue ?? 0).toFixed(2)}`} />
          <StatCard label="إجمالي الطلبات" value={kpis.totalOrders ?? 0} />
          <StatCard label="معدل التحويل" value={`${Number(kpis.conversionRate ?? 0).toFixed(2)}%`} />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="إيراد أسبوعي" value={`EGP ${Number(kpis.weeklyRevenue ?? 0).toFixed(2)}`} />
          <StatCard label="إيراد شهري" value={`EGP ${Number(kpis.monthlyRevenue ?? 0).toFixed(2)}`} />
          <StatCard label="إيراد سنوي" value={`EGP ${Number(kpis.yearlyRevenue ?? 0).toFixed(2)}`} />
          <StatCard label="العملاء العائدون" value={kpis.returningCustomers ?? 0} />
          <StatCard label="مسح QR" value={kpis.qrScans ?? 0} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="glass-panel rounded-[32px] p-5">
            <h2 className="text-xl font-bold text-cream">اتجاه المبيعات</h2>
            <div className="mt-4">
              <LineBars
                items={revenueChart.map((item) => ({
                  label: String(item.period).slice(0, 10),
                  value: Number(item.gross_sales ?? 0).toFixed(0)
                }))}
                labelKey="label"
                valueKey="value"
              />
            </div>
          </div>

          <div className="glass-panel rounded-[32px] p-5">
            <h2 className="text-xl font-bold text-cream">مؤشرات الأداء</h2>
            <div className="mt-4 grid gap-3">
              <StatCard label="صحة الأعمال" value={`${scores.businessHealthScore ?? 0}/100`} />
              <StatCard label="نمو الأداء" value={`${scores.growthScore ?? 0}/100`} />
              <StatCard label="إيراد الأداء" value={`${scores.revenueScore ?? 0}/100`} />
              <StatCard label="رضا العملاء" value={`${scores.customerSatisfactionScore ?? 0}/100`} />
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="glass-panel rounded-[32px] p-5">
            <h2 className="text-xl font-bold text-cream">أهم المنتجات</h2>
            <div className="mt-4">
              <LineBars items={products?.topSelling ?? []} labelKey="name_ar" valueKey="quantity_sold" />
            </div>
          </div>

          <div className="glass-panel rounded-[32px] p-5">
            <h2 className="text-xl font-bold text-cream">أهم الأقسام</h2>
            <div className="mt-4">
              <LineBars items={categories?.topCategories ?? []} labelKey="name_ar" valueKey="quantity_sold" />
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="glass-panel rounded-[32px] p-5">
            <h2 className="text-xl font-bold text-cream">أداء الفروع</h2>
            <div className="mt-4">
              <LineBars items={branches?.branchRevenue ?? []} labelKey="branch_name" valueKey="branch_orders" />
            </div>
          </div>

          <div className="glass-panel rounded-[32px] p-5">
            <h2 className="text-xl font-bold text-cream">تقارير العملاء</h2>
            <div className="mt-4">
              <LineBars items={customers?.topSpendingCustomers ?? []} labelKey="customer_name" valueKey="lifetime_value" />
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="glass-panel rounded-[32px] p-5">
            <h2 className="text-xl font-bold text-cream">تحليلات الوقت</h2>
            <div className="mt-4">
              <LineBars items={time?.orderVolume ?? []} labelKey="hour" valueKey="orders" />
            </div>
          </div>

          <div className="glass-panel rounded-[32px] p-5">
            <h2 className="text-xl font-bold text-cream">الملخص المالي</h2>
            <div className="mt-4 grid gap-3">
              <StatCard label="الإيراد" value={`EGP ${Number(financial?.profitAndLoss?.revenue ?? 0).toFixed(2)}`} />
              <StatCard label="المصروفات" value={`EGP ${Number(financial?.profitAndLoss?.expenses ?? 0).toFixed(2)}`} />
              <StatCard label="صافي الربح" value={`EGP ${Number(financial?.profitAndLoss?.net ?? 0).toFixed(2)}`} />
            </div>
          </div>
        </section>

      </div>
    </AdminShell>
  );
}
