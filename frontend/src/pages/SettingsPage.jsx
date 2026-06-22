import { useEffect, useMemo, useRef, useState } from 'react';
import { AdminShell } from '../components/AdminShell';
import { Toast } from '../components/Toast';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { resolveMediaUrl } from '../components/ProductMedia';
import { useWindowDataChanged } from '../hooks/useWindowDataChanged';

const emptySettings = {
  logoUrl: '',
  faviconUrl: '',
  restaurantName: '',
  restaurantNameAr: '',
  restaurantNameEn: '',
  phone: '',
  theme: 'light',
  buttonColor: '#d7a439',
  headingColor: '#10172a',
  headingFont: 'Tajawal',
  bodyFont: 'Tajawal',
  heroSlides: [],
  offerGroup: {
    titleAr: '',
    titleEn: '',
    productIds: [],
    price: '',
    isActive: false
  },
  vipCampaign: {
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
  },
  socialLinks: {
    facebook: '',
    instagram: '',
    snapchat: '',
    tiktok: '',
    youtube: ''
  }
};

async function fileToUploadPayload(file) {
  if (file.size > 1024 * 1024) {
    throw new Error('حجم الملف يجب ألا يتجاوز 1MB');
  }
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('تعذر قراءة الملف'));
    reader.readAsDataURL(file);
  });
  const uploaded = await api.upload({ fileData: String(dataUrl), fileName: file.name });
  return uploaded.url;
}

function Field({ label, hint, children }) {
  return (
    <label className="block space-y-2">
      <span className="block text-sm font-medium text-white">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-[var(--site-muted)]">{hint}</span> : null}
    </label>
  );
}

const inputClass = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--site-button)]';
const fontOptions = [
  { value: 'Tajawal', label: 'Tajawal' },
  { value: 'Cairo', label: 'Cairo' },
  { value: 'IBM Plex Sans Arabic', label: 'IBM Plex Sans Arabic' },
  { value: 'Readex Pro', label: 'Readex Pro' }
];

export function SettingsPage() {
  const { setLang } = useLanguage();
  const [settings, setSettings] = useState(emptySettings);
  const [toast, setToast] = useState(null);
  const settingsRef = useRef(emptySettings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  function syncSettings(nextSettings) {
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
  }

  function updateSettings(updater) {
    setSettings((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      settingsRef.current = next;
      return next;
    });
  }

  async function loadSettings() {
    try {
      const data = await api.publicSiteSettings();
      return data;
    } catch {
      return { ...emptySettings };
    }
  }

  useEffect(() => {
    setLang('ar');
    loadSettings()
      .then((data) => syncSettings({
        ...emptySettings,
        ...data,
        socialLinks: {
          ...emptySettings.socialLinks,
          ...(data.socialLinks ?? {})
        }
      }))
      .catch((error) => setToast({ type: 'error', title: 'خطأ', description: error.message }));
  }, [setLang]);

  useWindowDataChanged(() => {
    loadSettings()
      .then((data) => syncSettings({
        ...emptySettings,
        ...data,
        socialLinks: {
          ...emptySettings.socialLinks,
          ...(data.socialLinks ?? {})
        }
      }))
      .catch(() => {});
  });

  const heroPreviewName = useMemo(
    () => settings.restaurantNameAr?.trim() || settings.restaurantNameEn?.trim() || settings.restaurantName?.trim() || 'اسم المطعم',
    [settings.restaurantName, settings.restaurantNameAr, settings.restaurantNameEn]
  );

  async function saveSettings() {
    try {
      const next = {
        ...settingsRef.current,
        logoUrl: String(settingsRef.current.logoUrl ?? '').trim(),
        faviconUrl: String(settingsRef.current.faviconUrl ?? '').trim(),
        restaurantName: String(settingsRef.current.restaurantName ?? '').trim()
          || String(settingsRef.current.restaurantNameAr ?? '').trim()
          || String(settingsRef.current.restaurantNameEn ?? '').trim(),
        restaurantNameAr: String(settingsRef.current.restaurantNameAr ?? '').trim(),
        restaurantNameEn: String(settingsRef.current.restaurantNameEn ?? '').trim(),
        phone: String(settingsRef.current.phone ?? '').trim(),
        theme: settingsRef.current.theme === 'dark' ? 'dark' : 'light',
        buttonColor: String(settingsRef.current.buttonColor ?? '#d7a439').trim() || '#d7a439',
        headingColor: String(settingsRef.current.headingColor ?? '#10172a').trim() || '#10172a',
        headingFont: String(settingsRef.current.headingFont ?? 'Tajawal').trim() || 'Tajawal',
        bodyFont: String(settingsRef.current.bodyFont ?? 'Tajawal').trim() || 'Tajawal',
        heroSlides: Array.isArray(settingsRef.current.heroSlides) ? settingsRef.current.heroSlides.filter(Boolean) : [],
        vipCampaigns: Array.isArray(settingsRef.current.vipCampaigns) ? settingsRef.current.vipCampaigns : [],
        offerGroup: {
          titleAr: String(settingsRef.current.offerGroup?.titleAr ?? '').trim(),
          titleEn: String(settingsRef.current.offerGroup?.titleEn ?? '').trim(),
          productIds: Array.isArray(settingsRef.current.offerGroup?.productIds) ? settingsRef.current.offerGroup.productIds.map((value) => String(value)).filter(Boolean) : [],
          price: String(settingsRef.current.offerGroup?.price ?? '').trim(),
          isActive: Boolean(settingsRef.current.offerGroup?.isActive)
        },
        socialLinks: {
          facebook: String(settingsRef.current.socialLinks?.facebook ?? '').trim(),
          instagram: String(settingsRef.current.socialLinks?.instagram ?? '').trim(),
          snapchat: String(settingsRef.current.socialLinks?.snapchat ?? '').trim(),
          tiktok: String(settingsRef.current.socialLinks?.tiktok ?? '').trim(),
          youtube: String(settingsRef.current.socialLinks?.youtube ?? '').trim()
        }
      };
      const saved = await api.updateSiteSettings(next);
      syncSettings({
        ...emptySettings,
        ...saved,
        vipCampaigns: Array.isArray(saved.vipCampaigns) ? saved.vipCampaigns : [],
        socialLinks: {
          ...emptySettings.socialLinks,
          ...(saved.socialLinks ?? {})
        }
      });
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('crevo-site-settings-updated', String(Date.now()));
        }
      } catch {
        // Ignore storage failures.
      }
      window.dispatchEvent(new Event('crevo-site-settings-updated'));
      setToast({ type: 'success', title: 'تم الحفظ بنجاح' });
    } catch (error) {
      setToast({ type: 'error', title: 'خطأ', description: error.message });
    }
  }

  return (
    <AdminShell title="الإعدادات">
      <div className="space-y-6">
        <section className="glass-panel rounded-[32px] p-5 sm:p-6 shadow-glow">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">إعدادات الموقع</p>
              <h1 className="mt-2 text-3xl font-bold text-white">إدارة الهوية والمظهر العام</h1>
            </div>
            <button
              type="button"
              onClick={saveSettings}
              className="rounded-2xl bg-gold px-5 py-3 text-sm font-bold text-ink"
            >
              حفظ الإعدادات
            </button>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="glass-panel rounded-[32px] p-5">
              <h2 className="text-xl font-bold text-white">الهوية الأساسية</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="اسم المطعم بالعربي">
                  <input
                    className={inputClass}
                    value={settings.restaurantNameAr}
                    onChange={(e) => setSettings((current) => ({ ...current, restaurantNameAr: e.target.value }))}
                    placeholder="مثال: مطعم بيتزا جن"
                  />
                </Field>
                <Field label="اسم المطعم بالإنجليزي">
                  <input
                    className={inputClass}
                    value={settings.restaurantNameEn}
                    onChange={(e) => setSettings((current) => ({ ...current, restaurantNameEn: e.target.value }))}
                    placeholder="Example: Pizza Gen"
                  />
                </Field>
                <Field label="رقم الهاتف">
                  <input
                    className={inputClass}
                    value={settings.phone}
                    onChange={(e) => setSettings((current) => ({ ...current, phone: e.target.value }))}
                    placeholder="01xxxxxxxxx"
                  />
                </Field>
                <Field label="وضع الموقع">
                  <select
                    className={inputClass}
                    value={settings.theme}
                    onChange={(e) => setSettings((current) => ({ ...current, theme: e.target.value }))}
                  >
                    <option value="light">Light Mode</option>
                    <option value="dark">Dark Mode</option>
                  </select>
                </Field>
                <Field label="لون الأزرار">
                  <input
                    type="color"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white p-1"
                    value={settings.buttonColor}
                    onChange={(e) => setSettings((current) => ({ ...current, buttonColor: e.target.value }))}
                  />
                </Field>
                <Field label="لون العناوين الرئيسية">
                  <input
                    type="color"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white p-1"
                    value={settings.headingColor}
                    onChange={(e) => setSettings((current) => ({ ...current, headingColor: e.target.value }))}
                  />
                </Field>
                <Field label="خط العناوين الرئيسية">
                  <select
                    className={inputClass}
                    value={settings.headingFont}
                    onChange={(e) => setSettings((current) => ({ ...current, headingFont: e.target.value }))}
                  >
                    {fontOptions.map((font) => (
                      <option key={font.value} value={font.value}>{font.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="خط باقي الكلام">
                  <select
                    className={inputClass}
                    value={settings.bodyFont}
                    onChange={(e) => setSettings((current) => ({ ...current, bodyFont: e.target.value }))}
                  >
                    {fontOptions.map((font) => (
                      <option key={font.value} value={font.value}>{font.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>

            <div className="glass-panel rounded-[32px] p-5">
              <h2 className="text-xl font-bold text-white">الشعار والفايفكون</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="رابط اللوجو">
                  <input
                    className={inputClass}
                    value={settings.logoUrl}
                    onChange={(e) => setSettings((current) => ({ ...current, logoUrl: e.target.value }))}
                    placeholder="https://..."
                  />
                </Field>
                <Field label="رفع لوجو">
                  <input
                    type="file"
                    accept="image/png,image/webp,image/jpeg"
                    className={inputClass}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const url = await fileToUploadPayload(file);
                      updateSettings((current) => ({ ...current, logoUrl: url }));
                      e.target.value = '';
                    }}
                  />
                </Field>
                <Field label="رابط الفايفكون">
                  <input
                    className={inputClass}
                    value={settings.faviconUrl}
                    onChange={(e) => setSettings((current) => ({ ...current, faviconUrl: e.target.value }))}
                    placeholder="512x512 PNG"
                  />
                </Field>
                <Field label="رفع فايفكون">
                  <input
                    type="file"
                    accept="image/png,image/webp,image/jpeg"
                    className={inputClass}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const url = await fileToUploadPayload(file);
                      updateSettings((current) => ({ ...current, faviconUrl: url }));
                      e.target.value = '';
                    }}
                  />
                </Field>
              </div>
            </div>

            <div className="glass-panel rounded-[32px] p-5">
              <h2 className="text-xl font-bold text-white">السلايدر الرئيسي</h2>
              <div className="mt-4 space-y-4">
                <Field label="إضافة صورة أو فيديو للسلايدر" hint="يمكن رفع أكثر من ملف، وحجم كل ملف لا يتجاوز 1MB">
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className={inputClass}
                    onChange={async (e) => {
                      const files = Array.from(e.target.files ?? []);
                      if (!files.length) return;
                      const urls = [];
                      for (const file of files) {
                        urls.push(await fileToUploadPayload(file));
                      }
                      updateSettings((current) => ({ ...current, heroSlides: [...current.heroSlides, ...urls] }));
                      e.target.value = '';
                    }}
                  />
                </Field>

                <div className="grid gap-3 md:grid-cols-2">
                  {settings.heroSlides.length ? settings.heroSlides.map((slide, index) => (
                    <div key={`${slide}-${index}`} className="overflow-hidden rounded-[24px] border border-white/10 bg-white/5">
                      <div className="relative aspect-[16/9]">
                        {String(slide).toLowerCase().match(/\.(mp4|webm|mov|m4v)$/) || String(slide).startsWith('data:video') ? (
                          <video src={resolveMediaUrl(slide)} className="h-full w-full object-cover" muted loop playsInline />
                        ) : (
                          <img src={resolveMediaUrl(slide)} alt={`slide-${index + 1}`} className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 p-3">
                        <span className="text-xs text-white/55">Slide #{index + 1}</span>
                        <button
                          type="button"
                          onClick={() => updateSettings((current) => ({ ...current, heroSlides: current.heroSlides.filter((_, slideIndex) => slideIndex !== index) }))}
                          className="rounded-full bg-rose-500 px-3 py-1 text-xs font-bold text-white"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-[24px] border border-dashed border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-white/55 md:col-span-2">
                      لم يتم رفع أي صور أو فيديوهات بعد
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-panel rounded-[32px] p-5">
              <h2 className="text-xl font-bold text-white">السوشيال ميديا</h2>
              <div className="mt-4 grid gap-4">
                <Field label="Facebook">
                  <input
                    className={inputClass}
                    value={settings.socialLinks.facebook}
                    onChange={(e) => setSettings((current) => ({
                      ...current,
                      socialLinks: { ...current.socialLinks, facebook: e.target.value }
                    }))}
                    placeholder="https://facebook.com/..."
                  />
                </Field>
                <Field label="Instagram">
                  <input
                    className={inputClass}
                    value={settings.socialLinks.instagram}
                    onChange={(e) => setSettings((current) => ({
                      ...current,
                      socialLinks: { ...current.socialLinks, instagram: e.target.value }
                    }))}
                    placeholder="https://instagram.com/..."
                  />
                </Field>
                <Field label="Snapchat">
                  <input
                    className={inputClass}
                    value={settings.socialLinks.snapchat}
                    onChange={(e) => setSettings((current) => ({
                      ...current,
                      socialLinks: { ...current.socialLinks, snapchat: e.target.value }
                    }))}
                    placeholder="https://snapchat.com/..."
                  />
                </Field>
                <Field label="TikTok">
                  <input
                    className={inputClass}
                    value={settings.socialLinks.tiktok}
                    onChange={(e) => setSettings((current) => ({
                      ...current,
                      socialLinks: { ...current.socialLinks, tiktok: e.target.value }
                    }))}
                    placeholder="https://tiktok.com/..."
                  />
                </Field>
                <Field label="YouTube">
                  <input
                    className={inputClass}
                    value={settings.socialLinks.youtube}
                    onChange={(e) => setSettings((current) => ({
                      ...current,
                      socialLinks: { ...current.socialLinks, youtube: e.target.value }
                    }))}
                    placeholder="https://youtube.com/..."
                  />
                </Field>
              </div>
            </div>

            <div className="glass-panel rounded-[32px] p-5">
              <h2 className="text-xl font-bold text-white">معاينة سريعة</h2>
              <div className="mt-4 rounded-[28px] bg-white p-4 text-slate-900 shadow-[0_18px_50px_rgba(0,0,0,0.14)]">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm">
                    {settings.logoUrl ? (
                      <img src={resolveMediaUrl(settings.logoUrl)} alt="logo" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-black text-slate-500">LOGO</span>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Preview</p>
                    <h3 className="site-heading mt-1 text-2xl font-black">{heroPreviewName}</h3>
                    <p className="text-sm text-slate-500">{settings.theme === 'dark' ? 'Dark mode' : 'Light mode'}</p>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={saveSettings}
              className="w-full rounded-2xl bg-gold px-5 py-4 text-sm font-bold text-ink"
            >
              حفظ الإعدادات
            </button>
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

