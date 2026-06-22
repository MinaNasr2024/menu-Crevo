import { useEffect, useMemo, useState } from 'react';
import { AdminShell } from '../components/AdminShell';
import { CategoryForm } from '../components/CrudForms';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Toast } from '../components/Toast';
import { api } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { useRef } from 'react';

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
  const [toast, setToast] = useState(null);
  const formRef = useRef(null);

  useEffect(() => {
    setLang('ar');
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'ar';
  }, [setLang]);

  async function refresh() {
    const [categoryData, productData] = await Promise.all([api.categories(), api.products()]);
    setCategories(categoryData);
    setProducts(productData);
  }

  useEffect(() => {
    refresh().catch((error) => setToast({ type: 'error', title: 'خطأ', description: error.message }));
  }, []);

  const productCounts = useMemo(() => {
    const counts = new Map();
    for (const product of products) {
      counts.set(product.categoryId, (counts.get(product.categoryId) ?? 0) + 1);
    }
    return counts;
  }, [products]);

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
        isActive: Boolean(form.isActive)
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

  return (
    <AdminShell title="الأقسام">
      <div className="space-y-6">
        <section className="glass-panel rounded-[32px] p-6 shadow-glow">
          <div className="flex flex-wrap items-start justify-between gap-4">
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

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="glass-panel rounded-[32px] p-5" ref={formRef}>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-cream">قائمة الأقسام</h2>
              <span className="text-xs text-white/50">{categories.length} قسم</span>
            </div>

            <div className="mt-4 overflow-x-auto">
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
                  {categories.map((category, index) => (
                    <tr key={category.id} className="rounded-2xl bg-white/5 text-sm text-white/80">
                      <td className="rounded-r-2xl px-3 py-4 font-semibold text-white">{index + 1}</td>
                      <td className="px-3 py-4">
                        <div className="font-semibold text-white">{category.nameAr}</div>
                        <div className="mt-1 text-xs text-white/45">{category.nameEn}</div>
                      </td>
                      <td className="px-3 py-4">{category.sortOrder ?? 0}</td>
                      <td className="px-3 py-4">{productCounts.get(category.id) ?? 0}</td>
                      <td className="px-3 py-4">{category.isActive ? 'مفعل' : 'غير مفعل'}</td>
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
                            onClick={() => setConfirmId(category.id)}
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

          <div className="glass-panel rounded-[32px] p-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-cream">
                {selectedId ? 'تعديل القسم' : 'إضافة قسم'}
              </h2>
              {selectedId ? <span className="text-xs uppercase tracking-[0.3em] text-gold">ON</span> : null}
            </div>
            <div className="mt-4">
              <CategoryForm
                value={form}
                errors={fieldErrors}
                onChange={setForm}
                onSubmit={saveCategory}
                onCancel={resetForm}
              />
            </div>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(confirmId)}
        title="هل أنت متأكد أنك تريد حذف القسم؟"
        description="سيتم حذف القسم نهائياً."
        confirmLabel="نعم"
        cancelLabel="لا"
        onConfirm={deleteCategory}
        onCancel={() => setConfirmId(null)}
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
