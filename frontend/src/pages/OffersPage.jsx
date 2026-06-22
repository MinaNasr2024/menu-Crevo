import { useEffect, useMemo, useRef, useState } from 'react';
import { AdminShell } from '../components/AdminShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Toast } from '../components/Toast';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { useWindowDataChanged } from '../hooks/useWindowDataChanged';
import { OfferBuilderForm } from '../components/OfferBuilderForm';
import { resolveMediaUrl } from '../components/ProductMedia';

function emptyGroup(index = 0) {
  return {
    titleAr: '',
    selectionMode: '',
    minSelect: 0,
    maxSelect: 1,
    sortOrder: index,
    required: false,
    items: []
  };
}

function emptyOffer() {
  return {
    nameAr: '',
    nameEn: '',
    noteEn: '',
    totalPrice: '',
    imageUrl: '',
    isActive: true,
    groups: [emptyGroup(0)]
  };
}

function offerToForm(offer) {
  return {
    nameAr: offer.nameAr ?? '',
    nameEn: offer.nameEn ?? '',
    noteAr: offer.noteAr ?? '',
    noteEn: offer.noteEn ?? '',
    totalPrice: String(offer.totalPrice ?? ''),
    imageUrl: offer.imageUrl ?? '',
    isActive: Boolean(offer.isActive),
    groups: Array.isArray(offer.groups)
        ? offer.groups.map((group, index) => ({
        titleAr: group.titleAr ?? '',
        titleEn: group.titleEn ?? '',
        selectionMode: group.selectionMode ?? '',
        minSelect: String(group.minSelect ?? 1),
        maxSelect: String(group.maxSelect ?? 1),
        sortOrder: String(group.sortOrder ?? index),
        required: Boolean(group.required),
        items: Array.isArray(group.items)
          ? group.items.map((item, itemIndex) => ({
            productId: item.productId,
            extraPrice: String(item.extraPrice ?? 0),
            includeProductOptions: Boolean(item.includeProductOptions),
            sortOrder: String(item.sortOrder ?? itemIndex)
          }))
          : []
      }))
      : [emptyGroup(0)]
  };
}

function formatGroupSummary(group = {}, lang = 'ar') {
  const title = group.titleAr || group.titleEn || '';
  const mode = String(group.selectionMode ?? '') === 'radio'
    ? (lang === 'ar' ? 'اختيار واحد' : 'Radio')
    : String(group.selectionMode ?? '') === 'checkbox'
      ? (lang === 'ar' ? 'مربعات اختيار' : 'Checkbox')
      : (lang === 'ar' ? 'غير محدد' : 'Unset');
  return `${title} (${mode} ${group.minSelect}-${group.maxSelect})`;
}

export function OffersPage() {
  const { setLang, lang } = useLanguage();
  const [offers, setOffers] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyOffer());
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [toast, setToast] = useState(null);
  const formRef = useRef(null);

  async function refresh() {
    const offerData = await api.offers().catch(async (error) => {
      if (Number(error?.status) === 404) {
        return api.publicOffers();
      }
      throw error;
    });
    const productData = await api.products('menu');
    setOffers(Array.isArray(offerData) ? offerData.filter(Boolean) : []);
    setProducts(Array.isArray(productData) ? productData.filter(Boolean) : []);
  }

  useEffect(() => {
    setLang('ar');
    refresh().catch((error) => setToast({ type: 'error', title: 'خطأ', description: error.message }));
  }, [setLang]);

  useWindowDataChanged(() => {
    refresh().catch(() => {});
  });

  function scrollToForm() {
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 30);
  }

  function startCreate() {
    setForm(emptyOffer());
    setEditingId(null);
    scrollToForm();
  }

  function startEdit(offer) {
    setEditingId(offer.id);
    setForm(offerToForm(offer));
    scrollToForm();
  }

  async function uploadImage(file) {
    if (!file) return;
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('تعذر قراءة الملف'));
      reader.readAsDataURL(file);
    });
    const uploaded = await api.upload({ fileData: dataUrl, fileName: file.name });
    setForm((current) => ({ ...current, imageUrl: uploaded.url }));
  }

  async function saveOffer() {
    try {
      const payload = {
        ...form,
        nameAr: String(form.nameAr ?? '').trim(),
        nameEn: String(form.nameEn ?? '').trim() || String(form.nameAr ?? '').trim(),
        noteEn: String(form.noteEn ?? '').trim(),
        totalPrice: String(form.totalPrice ?? '').trim(),
        imageUrl: String(form.imageUrl ?? '').trim(),
        isActive: Boolean(form.isActive),
        groups: (form.groups ?? []).map((group, index) => ({
          titleAr: String(group.titleAr ?? '').trim() || `مجموعة ${index + 1}`,
          selectionMode: String(group.selectionMode ?? '').trim(),
          minSelect: Number(group.minSelect ?? 1),
          maxSelect: Number(group.maxSelect ?? 1),
          sortOrder: Number(group.sortOrder ?? index),
          required: Boolean(group.required),
          items: (group.items ?? []).map((item, itemIndex) => ({
            productId: Number(item.productId),
            extraPrice: Number(item.extraPrice ?? 0),
            includeProductOptions: Boolean(item.includeProductOptions),
            sortOrder: Number(item.sortOrder ?? itemIndex)
          }))
        }))
      };

      if (!payload.nameAr || !payload.nameEn) throw new Error('اسم العرض مطلوب');
      if (!payload.totalPrice && payload.totalPrice !== 0) throw new Error('سعر العرض مطلوب');

      if (editingId) {
        const updatedOffer = await api.updateOffer(editingId, payload);
        setToast({ type: 'success', title: 'تم التعديل بنجاح' });
        setForm(offerToForm(updatedOffer));
        setEditingId(updatedOffer.id ?? editingId);
      } else {
        const createdOffer = await api.createOffer(payload);
        setToast({ type: 'success', title: 'تم الحفظ بنجاح' });
        setForm(offerToForm(createdOffer));
        setEditingId(createdOffer.id ?? null);
      }
      await refresh();
    } catch (error) {
      setToast({ type: 'error', title: 'خطأ', description: error.message });
    }
  }

  async function deleteOffer() {
    if (!deleteId) return;
    try {
      await api.deleteOffer(deleteId);
      setToast({ type: 'success', title: 'تم الحذف بنجاح' });
      setDeleteId(null);
      await refresh();
    } catch (error) {
      setToast({ type: 'error', title: 'خطأ', description: error.message });
    }
  }

  const selectedProductCount = useMemo(() => {
    return (form.groups ?? []).reduce((sum, group) => sum + (group.items?.length ?? 0), 0);
  }, [form.groups]);

  const safeOffers = useMemo(() => (Array.isArray(offers) ? offers.filter(Boolean) : []), [offers]);

  return (
    <AdminShell title="العروض">
      <div className="space-y-6">
        <section className="glass-panel rounded-[32px] p-5 sm:p-6 shadow-glow">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">إدارة العروض</p>
              <h1 className="mt-2 text-3xl font-bold text-white">العروض الديناميكية</h1>
              <p className="mt-2 text-sm text-white/55">كل عرض له سعر مستقل ومجموعات اختيار وحدود واضحة.</p>
            </div>
            <button type="button" onClick={startCreate} className="rounded-2xl bg-gold px-4 py-3 text-sm font-bold text-ink">
              إضافة عرض جديد
            </button>
          </div>
        </section>

        <section ref={formRef} className="space-y-4">
          <OfferBuilderForm
            value={form}
            products={products}
            onChange={setForm}
            onSubmit={saveOffer}
            onImageFile={uploadImage}
            lang={lang}
          />
          <div className="text-sm text-white/55">
            إجمالي المنتجات المختارة في النموذج: {selectedProductCount}
          </div>
        </section>

        <section className="glass-panel rounded-[32px] p-5 sm:p-6 shadow-glow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">العروض الحالية</h2>
            <span className="text-sm text-white/55">{safeOffers.length} عرض</span>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {safeOffers.map((offer) => {
              const offerNameAr = offer?.nameAr ?? offer?.nameEn ?? '';
              const offerNameEn = offer?.nameEn ?? offer?.nameAr ?? '';
              const offerGroups = Array.isArray(offer?.groups) ? offer.groups.filter(Boolean) : [];
              return (
              <article key={offer.id} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div className="flex gap-4">
                  <div className="h-28 w-28 overflow-hidden rounded-2xl border border-white/10 bg-white/10">
                    {offer?.imageUrl ? <img src={resolveMediaUrl(offer.imageUrl)} alt={offerNameAr || offerNameEn} className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xl font-bold text-white">{offerNameAr}</div>
                    <div className="text-sm text-white/55">{offerNameEn}</div>
                    {(offer?.noteAr || offer?.noteEn) ? (
                      <div className="mt-1 text-sm leading-6 text-white/70 line-clamp-2">
                        {offer.noteAr || offer.noteEn}
                      </div>
                    ) : null}
                    <div className="mt-2 text-lg font-black text-gold">EGP {Number(offer?.totalPrice ?? 0).toFixed(2)}</div>
                    <div className="mt-2 text-xs text-white/45">
                      {offerGroups.length} مجموعة • {offerGroups.reduce((sum, group) => sum + (Array.isArray(group?.items) ? group.items.filter(Boolean).length : 0), 0)} منتج
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {offerGroups.map((group) => (
                    <div key={group.id} className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-sm text-white/70">
                      <div className="flex items-center gap-2 font-semibold text-white">
                        <span>{group?.titleAr || group?.titleEn || ''}</span>
                        {group?.required ? (
                          <span className="rounded-full bg-rose-500/15 px-2 py-1 text-[10px] font-bold text-rose-300">
                            {lang === 'ar' ? 'مطلوب' : 'Required'}
                          </span>
                        ) : null}
                        <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-white/70">
                          {String(group?.selectionMode ?? '') === 'radio'
                            ? (lang === 'ar' ? 'اختيار واحد' : 'Radio')
                            : String(group?.selectionMode ?? '') === 'checkbox'
                              ? (lang === 'ar' ? 'مربعات اختيار' : 'Checkbox')
                              : (lang === 'ar' ? 'غير محدد' : 'Unset')}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-white/50">
                        {(Array.isArray(group?.items) ? group.items.filter(Boolean) : [])
                          .map((item) => (lang === 'ar' ? item?.product?.nameAr : item?.product?.nameEn))
                          .filter(Boolean)
                          .join('، ')}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(offer)}
                    className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/5"
                  >
                    تعديل
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteId(offer.id)}
                    className="rounded-xl border border-red-400/20 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-400/10"
                  >
                    حذف
                  </button>
                  <span className={`rounded-full px-3 py-2 text-xs font-semibold ${offer.isActive ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/5 text-white/50'}`}>
                    {offer.isActive ? 'فعال' : 'غير فعال'}
                  </span>
                </div>
              </article>
              );
            })}
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="هل أنت متأكد أنك تريد حذف العرض؟"
        description="سيتم حذف العرض ومجموعاته نهائيًا."
        confirmLabel="نعم"
        cancelLabel="لا"
        onConfirm={deleteOffer}
        onCancel={() => setDeleteId(null)}
      />

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




