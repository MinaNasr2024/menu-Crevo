import { useEffect, useMemo, useRef, useState } from 'react';
import { AdminShell } from '../components/AdminShell';
import { CategoryForm } from '../components/CrudForms';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Toast } from '../components/Toast';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { useWindowDataChanged } from '../hooks/useWindowDataChanged';

const emptyCategory = { nameAr: '', nameEn: '', sortOrder: 0, isActive: true };

function parseValidationDetails(error) {
  const details = error?.details;
  if (details && typeof details === 'object') return details;
  const match = String(error?.message ?? '').match(/\{.*\}$/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function firstFieldMessage(details, field) {
  const value = details?.fieldErrors?.[field];
  if (Array.isArray(value)) return value[0] ?? '';
  if (typeof value === 'string') return value;
  return '';
}

export function CategoriesPage() {
  const { setLang } = useLanguage();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyCategory);
  const [selectedId, setSelectedId] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [confirmId, setConfirmId] = useState(null);
  const [transferState, setTransferState] = useState(null);
  const [toast, setToast] = useState(null);
  const formRef = useRef(null);

  useEffect(() => {
    setLang('ar');
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'ar';
  }, [setLang]);

  async function refresh() {
    const [categoryData, productData] = await Promise.all([
      api.categories('menu'),
      api.products('menu')
    ]);
    setCategories(Array.isArray(categoryData) ? categoryData.filter(Boolean) : []);
    setProducts(Array.isArray(productData) ? productData.filter(Boolean) : []);
  }

  useEffect(() => {
    refresh().catch((error) => setToast({ type: 'error', title: 'خطأ', description: error.message }));
  }, []);

  useWindowDataChanged(() => {
    refresh().catch(() => {});
  });

  const productCounts = useMemo(() => {
    const counts = new Map();
    for (const product of products) {
      if (!product) continue;
      counts.set(product.categoryId, (counts.get(product.categoryId) ?? 0) + 1);
    }
    return counts;
  }, [products]);

  const safeCategories = useMemo(() => (Array.isArray(categories) ? categories.filter(Boolean) : []), [categories]);

  function resetForm() {
    setForm(emptyCategory);
    setSelectedId(null);
    setFieldErrors({});
  }

  function scrollToForm() {
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  }

  function startEdit(category) {
    setSelectedId(category.id);
    setForm({
      nameAr: category.nameAr ?? '',
      nameEn: category.nameEn ?? '',
      sortOrder: category.sortOrder ?? 0,
      isActive: Boolean(category.isActive)
    });
    setFieldErrors({});
    scrollToForm();
  }

  function requestDelete(category) {
    const linkedProducts = productCounts.get(category.id) ?? 0;
    if (linkedProducts > 0) {
      setTransferState({
        sourceId: category.id,
        sourceName: category?.nameAr ?? category?.nameEn ?? '',
        targetId: ''
      });
      setConfirmId(null);
      return;
    }

    setConfirmId(category.id);
  }

  async function saveCategory() {
    try {
      setFieldErrors({});
      const nameAr = String(form.nameAr ?? '').trim();
      if (!nameAr) {
        setFieldErrors({ nameAr: 'مطلوب' });
        return;
      }

      const payload = {
        nameAr,
        nameEn: String(form.nameEn ?? '').trim() || nameAr,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: Boolean(form.isActive),
        scope: 'menu'
      };

      if (selectedId) {
        await api.updateCategory(selectedId, payload);
        setToast({ type: 'success', title: 'تم التعديل بنجاح' });
      } else {
        await api.createCategory(payload);
        setToast({ type: 'success', title: 'تم الحفظ بنجاح' });
      }

      resetForm();
      await refresh();
    } catch (error) {
      const details = parseValidationDetails(error);
      if (details) {
        setFieldErrors({
          nameAr: firstFieldMessage(details, 'nameAr') || 'مطلوب'
        });
        return;
      }
      setToast({ type: 'error', title: 'خطأ', description: error.message });
    }
  }

  async function deleteCategory() {
    if (!confirmId) return;
    try {
      await api.deleteCategory(confirmId);
      setToast({ type: 'success', title: 'تم الحذف بنجاح' });
      setConfirmId(null);
      if (selectedId === confirmId) resetForm();
      await refresh();
    } catch (error) {
      setConfirmId(null);
      setToast({ type: 'error', title: 'خطأ', description: error.message });
    }
  }

  async function transferAndDeleteCategory() {
    if (!transferState?.sourceId || !transferState.targetId) return;
    try {
      await api.transferCategoryProducts(transferState.sourceId, transferState.targetId);
      setToast({ type: 'success', title: 'تم نقل المنتجات ثم حذف القسم بنجاح' });
      if (selectedId === transferState.sourceId) resetForm();
      setTransferState(null);
      await refresh();
    } catch (error) {
      setToast({ type: 'error', title: 'خطأ', description: error.message });
    }
  }

  const targetCategories = categories.filter((category) => category.id !== transferState?.sourceId);

  return (
    <AdminShell title="الأقسام">
      <div className="space-y-6">
        <section className="glass-panel rounded-[32px] p-5 sm:p-6 shadow-glow">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">إدارة الأقسام</p>
              <h1 className="mt-2 text-3xl font-bold text-cream">الأقسام</h1>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-2xl bg-gold px-4 py-3 text-sm font-bold text-ink"
            >
              قسم جديد
            </button>
          </div>
        </section>

        <section className="space-y-6">
          <div className="glass-panel rounded-[32px] p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-cream">
                  {selectedId ? 'تعديل القسم' : 'إضافة قسم'}
                </h2>
                <p className="mt-1 text-xs text-white/45">
                  {selectedId ? 'يتم تعديل القسم المحدد فقط.' : 'أضف قسم جديد ثم احفظه.'}
                </p>
              </div>
              {selectedId ? <span className="text-xs uppercase tracking-[0.3em] text-gold">ON</span> : null}
            </div>
            <div className="mt-4" ref={formRef}>
              <CategoryForm
                value={form}
                errors={fieldErrors}
                onChange={setForm}
                onSubmit={saveCategory}
                onCancel={resetForm}
              />
            </div>
          </div>

          <div className="glass-panel rounded-[32px] p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-bold text-cream">قائمة الأقسام</h2>
              <span className="text-xs text-white/50">{categories.length} قسم</span>
            </div>

            <div className="mt-4 space-y-3 md:hidden">
              {safeCategories.map((category, index) => (
                <div key={category.id} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-white/45">#{index + 1}</div>
                      <div className="mt-1 font-semibold text-white">{category?.nameAr ?? category?.nameEn ?? ''}</div>
                      <div className="text-xs text-white/45">{category?.nameEn ?? category?.nameAr ?? ''}</div>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/60">
                      {category?.isActive ? 'مفعل' : 'غير مفعل'}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-white/75">
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="text-[11px] text-white/45">الترتيب</div>
                      <div className="mt-1 font-semibold text-white">{category?.sortOrder ?? 0}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="text-[11px] text-white/45">المنتجات</div>
                      <div className="mt-1 font-semibold text-white">{productCounts.get(category?.id) ?? 0}</div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(category)}
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/5"
                    >
                      تعديل
                    </button>
                    <button
                      type="button"
                      onClick={() => requestDelete(category)}
                      className="rounded-xl border border-red-400/20 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-400/10"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="min-w-full border-separate border-spacing-y-3 text-right">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.25em] text-white/40">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">اسم القسم</th>
                    <th className="px-3 py-2">الترتيب</th>
                    <th className="px-3 py-2">عدد المنتجات</th>
                    <th className="px-3 py-2">الحالة</th>
                    <th className="px-3 py-2">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
              {safeCategories.map((category, index) => (
                <tr key={category.id} className="rounded-2xl bg-white/5 text-sm text-white/80">
                  <td className="rounded-r-2xl px-3 py-4 font-semibold text-white">{index + 1}</td>
                  <td className="px-3 py-4">
                        <div className="font-semibold text-white">{category?.nameAr ?? category?.nameEn ?? ''}</div>
                        <div className="mt-1 text-xs text-white/45">{category?.nameEn ?? category?.nameAr ?? ''}</div>
                  </td>
                      <td className="px-3 py-4">{category?.sortOrder ?? 0}</td>
                      <td className="px-3 py-4">{productCounts.get(category?.id) ?? 0}</td>
                      <td className="px-3 py-4">{category?.isActive ? 'مفعل' : 'غير مفعل'}</td>
                      <td className="rounded-l-2xl px-3 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(category)}
                            className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/5"
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDelete(category)}
                            className="rounded-xl border border-red-400/20 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-400/10"
                          >
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(confirmId)}
        title="هل أنت متأكد أنك تريد حذف القسم؟"
        description="سيتم حذف القسم نهائيًا."
        confirmLabel="نعم"
        cancelLabel="لا"
        onConfirm={deleteCategory}
        onCancel={() => setConfirmId(null)}
      />

      <ConfirmDialog
        open={Boolean(transferState)}
        title="هناك منتجات مرتبطة بهذا القسم"
        description="اختر قسمًا آخر لنقل المنتجات إليه ثم أكد النقل وبعدها سيتم حذف القسم الحالي."
        confirmLabel="تأكيد النقل"
        cancelLabel="إلغاء النقل"
        confirmDisabled={!transferState?.targetId}
        onConfirm={transferAndDeleteCategory}
        onCancel={() => setTransferState(null)}
      >
        <div className="space-y-3 text-right">
          <label className="block text-sm font-semibold text-slate-700">اختر القسم الجديد</label>
          <select
            value={transferState?.targetId ?? ''}
            onChange={(event) =>
              setTransferState((current) =>
                current ? { ...current, targetId: event.target.value } : current
              )
            }
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right text-sm text-slate-900 outline-none transition focus:border-[var(--site-button)]"
          >
            <option value="">اختر القسم المراد النقل إليه</option>
            {targetCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category?.nameAr ?? category?.nameEn ?? ''}
              </option>
            ))}
          </select>
          <p className="text-xs leading-6 text-slate-500">
            سيتم نقل كل المنتجات المرتبطة بـ {transferState?.sourceName ?? 'هذا القسم'} إلى القسم المختار.
          </p>
        </div>
      </ConfirmDialog>

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
