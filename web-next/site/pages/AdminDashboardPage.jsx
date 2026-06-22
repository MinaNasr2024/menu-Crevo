import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { StatCard } from '../components/StatCard';
import { LineBars } from '../components/LineBars';
import { WaiterLiveMonitor } from '../components/WaiterLiveMonitor';
import { AdminShell } from '../components/AdminShell';
import { useLanguage } from '../context/LanguageContext';
import { Toast } from '../components/Toast';
import { resolveMediaUrl } from '../components/ProductMedia';
import { applySiteTheme } from '../lib/siteTheme';

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

const inputClass = 'w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition placeholder:text-white/25 focus:border-gold';

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const { setLang } = useLanguage();
  const [summary, setSummary] = useState(null);
  const [calls, setCalls] = useState([]);
  const [tables, setTables] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [peakHours, setPeakHours] = useState([]);
  const [revenue, setRevenue] = useState([]);
  const [activeTable, setActiveTable] = useState(null);
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
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setLang('ar');
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'ar';
  }, [setLang]);

  async function refresh() {
    const [summaryData, tableData, callData, top, peak, rev, settings] = await Promise.all([
      api.adminSummary(),
      api.tables(),
      api.waiterCalls(),
      api.topProducts({ bucket: 'day' }),
      api.peakHours({ bucket: 'day' }),
      api.revenue({ bucket: 'day' }),
      api.publicSiteSettings()
    ]);
    setSummary(summaryData);
    setTables(tableData);
    setCalls(callData.filter((call) => call.status !== 'completed'));
    setTopProducts(top);
    setPeakHours(peak);
    setRevenue(rev);
    setActiveTable(tableData[0] ?? null);
    setSiteSettings(settings);
  }

  useEffect(() => {
    refresh().catch((error) => setToast({ type: 'error', title: 'خطأ', description: error.message }));
  }, []);

  const selectedTable = useMemo(() => activeTable ?? tables[0] ?? null, [activeTable, tables]);
  const openTables = useMemo(() => tables.filter((table) => table.currentPhone), [tables]);

  async function saveBranding() {
    try {
      const savedSettings = await api.updateSiteSettings({
        ...siteSettings,
        restaurantName: String(siteSettings.restaurantName ?? '').trim(),
        restaurantNameAr: String(siteSettings.restaurantNameAr ?? '').trim(),
        restaurantNameEn: String(siteSettings.restaurantNameEn ?? '').trim(),
        logoUrl: String(siteSettings.logoUrl ?? '').trim(),
        faviconUrl: String(siteSettings.faviconUrl ?? '').trim(),
        phone: String(siteSettings.phone ?? '').trim(),
        theme: siteSettings.theme === 'dark' ? 'dark' : 'light',
        buttonColor: String(siteSettings.buttonColor ?? '#d7a439').trim() || '#d7a439',
        headingColor: String(siteSettings.headingColor ?? '#10172a').trim() || '#10172a',
        headingFont: String(siteSettings.headingFont ?? 'Tajawal').trim() || 'Tajawal',
        bodyFont: String(siteSettings.bodyFont ?? 'Tajawal').trim() || 'Tajawal',
        heroSlides: Array.isArray(siteSettings.heroSlides) ? siteSettings.heroSlides.filter(Boolean) : [],
        socialLinks: {
          facebook: String(siteSettings.socialLinks?.facebook ?? '').trim(),
          instagram: String(siteSettings.socialLinks?.instagram ?? '').trim(),
          snapchat: String(siteSettings.socialLinks?.snapchat ?? '').trim(),
          tiktok: String(siteSettings.socialLinks?.tiktok ?? '').trim(),
          youtube: String(siteSettings.socialLinks?.youtube ?? '').trim()
        }
      });
      setSiteSettings(savedSettings);
      applySiteTheme(savedSettings);
      localStorage.setItem('crevo-site-settings-updated', String(Date.now()));
      window.dispatchEvent(new Event('crevo-site-settings-updated'));
      setToast({ type: 'success', title: 'تم الحفظ بنجاح' });
    } catch (error) {
      setToast({ type: 'error', title: 'خطأ', description: error.message });
    }
  }

  return (
    <AdminShell title="لوحة التحكم">
      <div className="space-y-6">
        <section className="glass-panel rounded-[32px] p-6 shadow-glow">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">إدارة كريڤو</p>
              <h1 className="mt-2 text-3xl font-bold text-cream">لوحة تحكم عربية</h1>
            </div>
            <div className="flex flex-wrap gap-2">
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
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard label="الأقسام" value={summary.categories} />
            <StatCard label="المنتجات" value={summary.products} />
            <StatCard label="الطاولات" value={summary.tables} />
            <StatCard label="طلبات النادل" value={summary.pendingCalls} />
            <StatCard label="الطلبات" value={summary.orders} />
          </section>
        ) : null}

        <section className="glass-panel rounded-[32px] p-5">
          <div className="flex items-center justify-between gap-4">
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
                  <div className="mt-3 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-center text-xs font-semibold text-emerald-100">
                    مفتوحة
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
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-cream">متابعة النادل</h2>
            {selectedTable ? <span className="text-xs text-white/50">Table {selectedTable.tableNumber}</span> : null}
          </div>
            <div className="mt-4 max-h-[420px] overflow-auto pr-1">
              <WaiterLiveMonitor
                calls={calls}
                onNewCall={(payload) => {
                  setCalls((current) => [payload, ...current]);
                }}
                onCompleteCall={(callId) => {
                  setCalls((current) => current.filter((call) => call.id !== callId));
                }}
              />
            </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <div className="glass-panel rounded-[32px] p-5">
            <h2 className="text-xl font-bold text-cream">أكثر المنتجات بيعًا</h2>
            <div className="mt-4">
              <LineBars items={topProducts} labelKey="name_ar" valueKey="total_quantity" />
            </div>
          </div>
          <div className="glass-panel rounded-[32px] p-5">
            <h2 className="text-xl font-bold text-cream">أكثر الساعات طلبًا</h2>
            <div className="mt-4">
              <LineBars items={peakHours.map((item) => ({ ...item, label: `${item.hour_of_day}:00` }))} labelKey="label" valueKey="order_count" />
            </div>
          </div>
          <div className="glass-panel rounded-[32px] p-5">
            <h2 className="text-xl font-bold text-cream">إيرادات المبيعات</h2>
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
          </div>
        </section>
      </div>

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

