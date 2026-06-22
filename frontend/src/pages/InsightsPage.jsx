import { useEffect, useMemo, useState } from 'react';
import { api, downloadBiExport } from '../lib/api';
import { StatCard } from '../components/StatCard';
import { LineBars } from '../components/LineBars';
import { AdminShell } from '../components/AdminShell';
import { useWindowDataChanged } from '../hooks/useWindowDataChanged';

const defaultRange = {
  from: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
  to: new Date().toISOString()
};

function ExportLink({ report, format = 'csv', label }) {
  return (
    <button
      type="button"
      onClick={async () => {
        await downloadBiExport(report, format);
      }}
      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10"
    >
      {label}
    </button>
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
  const [reviews, setReviews] = useState([]);
  const [refreshMessage, setRefreshMessage] = useState('');
  const [range] = useState(defaultRange);

  async function loadInsights() {
    const requests = [
      api.biExecutive(range),
      api.biSales({ ...range, period: 'daily' }),
      api.biProducts(range),
      api.biCategories(range),
      api.biBranches(range),
      api.biCustomers(range),
      api.biTime(range),
      api.biFinancial(range),
      api.customerReviews()
    ];

    const results = await Promise.allSettled(requests);
    const [
      executiveResult,
      salesResult,
      productsResult,
      categoriesResult,
      branchesResult,
      customersResult,
      timeResult,
      financialResult,
      reviewsResult
    ] = results;

    const executiveData = executiveResult.status === 'fulfilled' ? executiveResult.value : { error: executiveResult.reason?.message ?? 'Request failed' };
    setExecutive(executiveData);
    setSales(salesResult.status === 'fulfilled' ? salesResult.value : null);
    setProducts(productsResult.status === 'fulfilled' ? productsResult.value : null);
    setCategories(categoriesResult.status === 'fulfilled' ? categoriesResult.value : null);
    setBranches(branchesResult.status === 'fulfilled' ? branchesResult.value : null);
    setCustomers(customersResult.status === 'fulfilled' ? customersResult.value : null);
    setTime(timeResult.status === 'fulfilled' ? timeResult.value : null);
    setFinancial(financialResult.status === 'fulfilled' ? financialResult.value : null);
    setReviews(reviewsResult.status === 'fulfilled' && Array.isArray(reviewsResult.value) ? reviewsResult.value : []);
  }

  useEffect(() => {
    loadInsights().catch((error) => {
      setExecutive({ error: error.message });
    });
  }, [range]);

  useWindowDataChanged(() => {
    loadInsights().catch((error) => {
      setExecutive({ error: error.message });
    });
  });

  const kpis = executive?.kpis ?? {};
  const scores = executive?.healthScores ?? {};
  const revenueChart = useMemo(() => sales?.series ?? [], [sales]);
  const filteredReviews = useMemo(() => {
    const fromTime = new Date(range.from).getTime();
    const toTime = new Date(`${range.to.slice(0, 10)}T23:59:59.999`).getTime();
    return reviews.filter((review) => {
      const reviewTime = new Date(review.createdAt ?? review.created_at ?? 0).getTime();
      return Number.isFinite(reviewTime) && reviewTime >= fromTime && reviewTime <= toTime;
    });
  }, [reviews, range.from, range.to]);
  const customerReviewsInRange = useMemo(
    () => filteredReviews.filter((review) => Number(review.ratingValue ?? 0) >= 2 && Number(review.ratingValue ?? 0) <= 3),
    [filteredReviews]
  );
  const customerReviewAverage = useMemo(() => {
    if (!filteredReviews.length) return 0;
    const average = filteredReviews.reduce((sum, review) => sum + Number(review.ratingValue ?? 0), 0) / filteredReviews.length;
    return Number(average.toFixed(2));
  }, [filteredReviews]);
  const customerSatisfactionFromReviews = useMemo(() => {
    const reportScore = Number(scores.customerSatisfactionScore ?? 0);
    const reviewScore = customerReviewAverage ? Number(((customerReviewAverage / 5) * 100).toFixed(1)) : 0;
    if (!reportScore && !reviewScore) return 0;
    if (!reportScore) return reviewScore;
    if (!reviewScore) return reportScore;
    return Number((((reportScore + reviewScore) / 2).toFixed(1)));
  }, [customerReviewAverage, scores.customerSatisfactionScore]);

  return (
    <AdminShell title="التقارير">
      <div className="space-y-6">
        <header className="glass-panel rounded-[32px] p-5 sm:p-6 shadow-glow">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
              <StatCard label="رضا العملاء" value={`${customerSatisfactionFromReviews ?? 0}/100`} />
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="glass-panel rounded-[32px] p-5">
            <h2 className="text-xl font-bold text-cream">أهم المنتجات</h2>
            <div className="mt-4">
              <LineBars items={products?.topSelling ?? []} labelKey="name_en" valueKey="quantity_sold" />
            </div>
          </div>

          <div className="glass-panel rounded-[32px] p-5">
            <h2 className="text-xl font-bold text-cream">أهم الأقسام</h2>
            <div className="mt-4">
              <LineBars items={categories?.topCategories ?? []} labelKey="name_en" valueKey="quantity_sold" />
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="glass-panel rounded-[32px] p-5">
            <h2 className="text-xl font-bold text-cream">أداء الفروع</h2>
            <div className="mt-4">
              <LineBars items={branches?.branchRevenue ?? []} labelKey="branch_name" valueKey="branch_revenue" />
            </div>
          </div>

          <div className="glass-panel rounded-[32px] p-5">
            <h2 className="text-xl font-bold text-cream">تقارير العملاء</h2>
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <StatCard label="إجمالي التقييمات" value={filteredReviews.length} />
                <StatCard label="متوسط التقييم" value={`${customerReviewAverage ? customerReviewAverage.toFixed(2) : '0.00'}/5`} />
                <StatCard label="تقييمات 2 إلى 3 نجوم" value={customerReviewsInRange.length} />
              </div>
              {customerReviewsInRange.length ? (
                <div className="space-y-3">
                  {customerReviewsInRange.map((review) => (
                    <div key={review.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-white">{review.customerName} - طاولة {review.tableNumber}</div>
                        <div className="font-bold text-gold">{review.ratingValue}/5</div>
                      </div>
                      <div className="mt-1 text-xs text-white/50">{review.comment || 'لا يوجد تعليق'}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[24px] border border-dashed border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-white/55">
                  لا توجد تقييمات بين 2 و3 نجوم داخل الفلتر الحالي.
                </div>
              )}
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
