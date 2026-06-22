import { useEffect, useMemo, useState } from 'react';
import { AdminShell } from '../components/AdminShell';
import { Toast } from '../components/Toast';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { resolveMediaUrl } from '../components/ProductMedia';
import { useWindowDataChanged } from '../hooks/useWindowDataChanged';

const emptyCampaign = {
  id: '',
  isActive: false,
  targetTrigger: 10,
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
};

const emptyStats = {
  totalCustomers: 0,
  eligibleCustomers: 0,
  rewardedCustomers: 0
};

function createBlankCampaignForm() {
  return {
    id: '',
    isActive: '',
    targetMode: 'visits',
    targetTrigger: '',
    targetAmount: '',
    rewardType: '',
    productRewardId: '',
    productRewardTitleAr: '',
    productRewardTitleEn: '',
    financialDiscountType: '',
    percentage: '',
    fixedAmount: '',
    popupTitleAr: '',
    popupTitleEn: '',
    popupBodyAr: '',
    popupBodyEn: ''
  };
}

function Field({ label, hint, children }) {
  return (
    <label className="block space-y-2">
      <span className="block text-sm font-medium text-white">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-white/45">{hint}</span> : null}
    </label>
  );
}

const inputClass = 'w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition placeholder:text-white/25 focus:border-gold';

function normalizeCampaign(campaign = {}) {
  return {
    ...emptyCampaign,
    ...campaign,
    id: String(campaign.id ?? ''),
    isActive: Boolean(campaign.isActive),
    targetMode: 'visits',
    targetTrigger: Math.max(1, Number(campaign.targetTrigger ?? emptyCampaign.targetTrigger)),
    targetAmount: 0,
    rewardType: campaign.rewardType === 'financial' ? 'financial' : 'product',
    productRewardId: String(campaign.productRewardId ?? ''),
    productRewardTitleAr: String(campaign.productRewardTitleAr ?? ''),
    productRewardTitleEn: String(campaign.productRewardTitleEn ?? ''),
    financialDiscountType: campaign.financialDiscountType === 'fixed' ? 'fixed' : 'percent',
    percentage: Math.max(0, Number(campaign.percentage ?? emptyCampaign.percentage)),
    fixedAmount: Math.max(0, Number(campaign.fixedAmount ?? emptyCampaign.fixedAmount))
  };
}

export function VIPCustomersPage() {
  const { setLang } = useLanguage();
  const [campaign, setCampaign] = useState(emptyCampaign);
  const [editingCampaignId, setEditingCampaignId] = useState('');
  const [campaigns, setCampaigns] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState(emptyStats);
  const [products, setProducts] = useState([]);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setLang('ar');
    async function load() {
      try {
        const [settingsResult, vipResult, productResult] = await Promise.allSettled([
          api.siteSettings(),
          api.vipCustomers(),
          api.products('menu')
        ]);
        const settings = settingsResult.status === 'fulfilled' ? settingsResult.value : {};
        const vip = vipResult.status === 'fulfilled' ? vipResult.value : null;
        const productList = productResult.status === 'fulfilled' ? productResult.value : [];
        const storedCampaigns = Array.isArray(settings?.vipCampaigns) ? settings.vipCampaigns : [];
        const normalizedCampaigns = storedCampaigns.map((entry, index) => normalizeCampaign({
          id: String(entry?.id || `saved-${index + 1}`),
          ...entry
        }));
        const activeCampaign = normalizeCampaign({
          id: 'current',
          ...(settings?.vipCampaign ?? {})
        });
        setCampaign(activeCampaign);
        setCampaigns(normalizedCampaigns.length ? normalizedCampaigns : (activeCampaign.isActive ? [activeCampaign] : []));
        setStats(vip?.stats ?? emptyStats);
        setCustomers(Array.isArray(vip?.customers) ? vip.customers : []);
        setProducts(Array.isArray(productList) ? productList : []);
      } catch (error) {
        setToast({ type: 'error', title: 'خطأ', description: error.message });
      }
    }
    load();
  }, [setLang]);

  useWindowDataChanged(() => {
    api.vipCustomers()
      .then((vip) => {
        setStats(vip?.stats ?? emptyStats);
        setCustomers(Array.isArray(vip?.customers) ? vip.customers : []);
      })
      .catch(() => {});
  });

  const selectedRewardProduct = useMemo(
    () => products.find((product) => String(product.id) === String(campaign.productRewardId)) ?? null,
    [campaign.productRewardId, products]
  );

  function buildSavedCampaign() {
    const rewardProduct = products.find((product) => String(product.id) === String(campaign.productRewardId)) ?? null;
    return normalizeCampaign({
      id: editingCampaignId || campaign.id || `vip-${Date.now()}`,
      ...campaign,
      targetMode: 'visits',
      targetTrigger: Math.max(1, Number(campaign.targetTrigger ?? 10)),
      targetAmount: 0,
      rewardType: campaign.rewardType === 'financial' ? 'financial' : 'product',
      productRewardId: String(campaign.productRewardId ?? ''),
      productRewardTitleAr: rewardProduct?.nameAr ?? '',
      productRewardTitleEn: rewardProduct?.nameEn ?? '',
      financialDiscountType: campaign.financialDiscountType === 'fixed' ? 'fixed' : 'percent',
      percentage: Math.max(0, Number(campaign.percentage ?? 0)),
      fixedAmount: Math.max(0, Number(campaign.fixedAmount ?? 0))
    });
  }

  async function saveCampaign() {
    try {
      const savedCampaign = buildSavedCampaign();
      const nextCampaigns = [
        ...campaigns.filter((entry) => String(entry.id) !== String(savedCampaign.id)),
        savedCampaign
      ];
      const activeCampaign = savedCampaign.isActive ? savedCampaign : campaigns.find((entry) => entry.isActive) ?? savedCampaign;
      const saved = await api.updateSiteSettings({
        vipCampaign: activeCampaign,
        vipCampaigns: nextCampaigns
      });
      const normalizedSavedCampaigns = Array.isArray(saved?.vipCampaigns) ? saved.vipCampaigns.map(normalizeCampaign) : nextCampaigns;
      setCampaign(createBlankCampaignForm());
      setCampaigns(normalizedSavedCampaigns);
      setEditingCampaignId('');
      setToast({ type: 'success', title: 'تم حفظ الحملة بنجاح' });
      window.dispatchEvent(new Event('crevo-site-settings-updated'));
    } catch (error) {
      setToast({ type: 'error', title: 'خطأ', description: error.message });
    }
  }

  function startEdit(savedCampaign) {
    const normalized = normalizeCampaign(savedCampaign);
    setCampaign(normalized);
    setEditingCampaignId(String(savedCampaign.id ?? ''));
  }

  async function deleteCampaign(id) {
    try {
      const nextCampaigns = campaigns.filter((entry) => String(entry.id) !== String(id));
      const nextActive = nextCampaigns.find((entry) => entry.isActive) ?? emptyCampaign;
      const saved = await api.updateSiteSettings({
        vipCampaign: nextActive,
        vipCampaigns: nextCampaigns
      });
      setCampaign(normalizeCampaign(saved?.vipCampaign ?? nextActive));
      setCampaigns(Array.isArray(saved?.vipCampaigns) ? saved.vipCampaigns.map(normalizeCampaign) : nextCampaigns);
      if (String(editingCampaignId) === String(id)) setEditingCampaignId('');
      setToast({ type: 'success', title: 'تم حذف الحملة بنجاح' });
      window.dispatchEvent(new Event('crevo-site-settings-updated'));
    } catch (error) {
      setToast({ type: 'error', title: 'خطأ', description: error.message });
    }
  }

  async function resetVipScreen() {
    const confirmed = window.confirm('هل تريد تصفير شاشة العملاء المميزين؟ سيتم تصفير الزيارات وإخفاء العملاء الحاليين.');
    if (!confirmed) return;
    try {
      const vip = await api.resetVipCustomers();
      setStats(vip?.stats ?? emptyStats);
      setCustomers(Array.isArray(vip?.customers) ? vip.customers : []);
      setToast({ type: 'success', title: 'تم التصفير بنجاح' });
      window.dispatchEvent(new Event('crevo-site-settings-updated'));
    } catch (error) {
      setToast({ type: 'error', title: 'خطأ', description: error.message });
    }
  }

  return (
    <AdminShell title="العملاء المميزون">
      <div className="space-y-6">
        <section className="glass-panel rounded-[32px] p-5 sm:p-6 shadow-glow">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">إعدادات الحملة</p>
              <h1 className="mt-2 text-3xl font-bold text-cream">ولاء الطاولات للعملاء المميزين</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={resetVipScreen}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                تصفير الشاشة
              </button>
              <button
                type="button"
                onClick={saveCampaign}
                className="rounded-2xl bg-gold px-5 py-3 text-sm font-bold text-ink"
              >
                حفظ الحملة
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="glass-panel rounded-[28px] p-5">
            <div className="text-sm text-white/55">إجمالي العملاء في القائمة</div>
            <div className="mt-2 text-3xl font-black text-cream">{stats.totalCustomers}</div>
          </div>
          <div className="glass-panel rounded-[28px] p-5">
            <div className="text-sm text-white/55">العملاء المؤهلون الآن</div>
            <div className="mt-2 text-3xl font-black text-cream">{stats.eligibleCustomers}</div>
          </div>
          <div className="glass-panel rounded-[28px] p-5">
            <div className="text-sm text-white/55">من استحقوا العرض حالياً</div>
            <div className="mt-2 text-3xl font-black text-cream">{stats.rewardedCustomers}</div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="glass-panel rounded-[32px] p-5">
            <h2 className="text-xl font-bold text-cream">إعدادات الحملة</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="محدد الهدف" hint="عدد مرات فتح الطاولة المطلوبة للوصول للمكافأة">
                <input
                  className={inputClass}
                  type="number"
                  min="1"
                  value={campaign.targetTrigger}
                  onChange={(e) => setCampaign((current) => ({ ...current, targetTrigger: e.target.value }))}
                />
              </Field>

              <Field label="تفعيل الحملة">
                <select
                  className={inputClass}
                  value={campaign.isActive === true ? 'yes' : campaign.isActive === false ? 'no' : ''}
                  onChange={(e) => setCampaign((current) => ({ ...current, isActive: e.target.value === '' ? '' : e.target.value === 'yes' }))}
                >
                  <option value="">اختر الحالة</option>
                  <option value="no">غير مفعلة</option>
                  <option value="yes">مفعلة</option>
                </select>
              </Field>

              <Field label="نوع المكافأة">
                <select
                  className={inputClass}
                  value={campaign.rewardType}
                  onChange={(e) => setCampaign((current) => ({ ...current, rewardType: e.target.value }))}
                >
                  <option value="">اختر نوع المكافأة</option>
                  <option value="product">مكافأة بالمنتج</option>
                  <option value="financial">مكافأة مالية</option>
                </select>
              </Field>

              <Field label="العنوان المنبثق">
                <input
                  className={inputClass}
                  value={campaign.popupTitleAr}
                  onChange={(e) => setCampaign((current) => ({ ...current, popupTitleAr: e.target.value }))}
                  placeholder="شكراً لزيارتك المتكررة!"
                />
              </Field>

              <Field label="نص التنبيه">
                <textarea
                  className={`${inputClass} min-h-28`}
                  value={campaign.popupBodyAr}
                  onChange={(e) => setCampaign((current) => ({ ...current, popupBodyAr: e.target.value }))}
                />
              </Field>

              {campaign.rewardType === 'product' ? (
                <Field label="مكافأة المنتج" hint="اختر المنتج الذي سيظهر كهدية">
                  <select
                    className={inputClass}
                    value={campaign.productRewardId}
                    onChange={(e) => setCampaign((current) => ({ ...current, productRewardId: e.target.value }))}
                  >
                    <option value="">اختر المنتج</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.nameAr || product.nameEn} - EGP {Number(product.price ?? 0).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : campaign.rewardType === 'financial' ? (
                <>
                  <Field label="نوع الخصم">
                    <select
                      className={inputClass}
                      value={campaign.financialDiscountType}
                      onChange={(e) => setCampaign((current) => ({ ...current, financialDiscountType: e.target.value }))}
                    >
                      <option value="">اختر نوع الخصم</option>
                      <option value="percent">نسبة مئوية (%)</option>
                      <option value="fixed">قيمة ثابتة</option>
                    </select>
                  </Field>
                  {campaign.financialDiscountType === 'percent' ? (
                    <Field label="نسبة الخصم">
                      <input
                        className={inputClass}
                        type="number"
                        min="0"
                        value={campaign.percentage}
                        onChange={(e) => setCampaign((current) => ({ ...current, percentage: e.target.value }))}
                      />
                    </Field>
                  ) : (
                    <Field label="قيمة الخصم">
                      <input
                        className={inputClass}
                        type="number"
                        min="0"
                        value={campaign.fixedAmount}
                        onChange={(e) => setCampaign((current) => ({ ...current, fixedAmount: e.target.value }))}
                      />
                    </Field>
                  )}
                </>
              ) : null}
            </div>

            {selectedRewardProduct ? (
              <div className="mt-4 rounded-[24px] border border-gold/30 bg-gold/10 p-4">
                <div className="text-xs uppercase tracking-[0.3em] text-gold/80">المنتج المختار</div>
                <div className="mt-3 flex items-center gap-4">
                  <div className="h-20 w-20 overflow-hidden rounded-2xl border border-gold/20 bg-white">
                    <img
                      src={resolveMediaUrl(selectedRewardProduct.coverMediaUrl)}
                      alt={selectedRewardProduct.nameAr}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-cream">{selectedRewardProduct.nameAr || selectedRewardProduct.nameEn}</div>
                    <div className="text-sm text-white/65">EGP {Number(selectedRewardProduct.price ?? 0).toFixed(2)}</div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="glass-panel rounded-[32px] p-5">
            <h2 className="text-xl font-bold text-cream">الحملات المفعلة</h2>
            <div className="mt-4 space-y-3">
              {campaigns.length ? campaigns.map((item) => (
                <div key={item.id} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <div className="text-lg font-bold text-cream">
                        {item.rewardType === 'product'
                          ? (item.productRewardTitleAr || 'مكافأة بالمنتج')
                          : 'مكافأة مالية'}
                      </div>
                      <div className="text-sm text-white/60">
                        {item.targetMode === 'amount'
                          ? `الهدف: EGP ${Number(item.targetAmount ?? 0).toFixed(2)}`
                          : `الهدف: ${item.targetTrigger} فتحات طاولة`}
                      </div>
                      <div className="text-xs text-white/45">
                        {item.rewardType === 'product'
                          ? `المنتج: ${item.productRewardTitleAr || 'غير محدد'}`
                          : item.financialDiscountType === 'fixed'
                            ? `قيمة ثابتة: EGP ${Number(item.fixedAmount ?? 0).toFixed(2)}`
                            : `نسبة: ${Number(item.percentage ?? 0)}%`}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCampaign(item.id)}
                        className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/20"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="rounded-[24px] border border-dashed border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-white/55">
                  لا توجد حملات محفوظة بعد
                </div>
              )}
            </div>

            <h2 className="mt-6 text-xl font-bold text-cream">شاشة إدارة العملاء المميزين</h2>
            <div className="mt-4 space-y-3">
              {customers.length ? customers.map((customer) => (
                <details key={customer.id} className="group rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                    <div className="text-right">
                      <div className="text-sm font-semibold text-cream">{customer.customerName || 'اسم غير محدد'}</div>
                      <div className="mt-1 text-xs text-white/50">{customer.phone}</div>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-white/70">
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">الزيارات: {customer.visitCount}</span>
                      <span className={`rounded-full px-3 py-1 ${customer.rewardStage === 'reward' ? 'bg-emerald-500/20 text-emerald-200' : customer.rewardStage === 'notice' ? 'bg-amber-500/20 text-amber-100' : 'bg-white/10 text-white/70'}`}>
                        {customer.rewardStage === 'reward' ? 'مستحق' : customer.rewardStage === 'notice' ? 'تنبيه' : 'قريب'}
                      </span>
                    </div>
                  </summary>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="text-xs text-white/45">رقم الهاتف</div>
                      <div className="mt-1 font-semibold text-cream">{customer.phone}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="text-xs text-white/45">
                        {campaign.targetMode === 'amount' ? 'يعتمد على إجمالي الفاتورة' : 'الزيارات الفعلية'}
                      </div>
                      <div className="mt-1 font-semibold text-cream">
                        {campaign.targetMode === 'amount'
                          ? `EGP ${Number(customer.amountTotal ?? 0).toFixed(2)} من EGP ${Number(campaign.targetAmount ?? 0).toFixed(2)}`
                          : `${customer.visitCount} من ${campaign.targetTrigger}`}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3 md:col-span-2">
                      <div className="text-xs text-white/45">ملاحظات</div>
                      <div className="mt-1 text-sm text-white/80">
                        {customer.lastTableNumber ? `آخر طاولة: ${customer.lastTableNumber}` : 'لا توجد طاولة أخيرة مسجلة'}
                      </div>
                    </div>
                  </div>
                </details>
              )) : (
                <div className="rounded-[24px] border border-dashed border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-white/55">
                  لا توجد بيانات بعد
                </div>
              )}
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
