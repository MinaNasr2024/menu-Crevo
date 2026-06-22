import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminShell } from '../components/AdminShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Toast } from '../components/Toast';
import { api } from '../lib/api';
import { normalizeSelectedTags, getTagLabel } from '../lib/productTags';
import { useLanguage } from '../context/LanguageContext';

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

export function ProductsPage() {
  const navigate = useNavigate();
  const { setLang, lang } = useLanguage();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [confirmId, setConfirmId] = useState(null);
  const [toast, setToast] = useState(null);

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

  const categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  async function deleteProduct() {
    if (!confirmId) return;
    try {
      await api.deleteProduct(confirmId);
      setToast({ type: 'success', title: 'تم الحذف بنجاح' });
      setConfirmId(null);
      await refresh();
    } catch (error) {
      setConfirmId(null);
      setToast({ type: 'error', title: 'خطأ', description: error.message });
    }
  }

  return (
    <AdminShell title="المنتجات">
      <div className="space-y-6">
        <section className="glass-panel rounded-[32px] p-6 shadow-glow">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">إدارة المنتجات</p>
              <h1 className="mt-2 text-3xl font-bold text-cream">قائمة المنتجات</h1>
            </div>
            <button
              type="button"
              onClick={() => navigate('/admin/products/new')}
              className="rounded-2xl bg-gold px-4 py-3 text-sm font-bold text-ink"
            >
              إضافة منتج
            </button>
          </div>
        </section>

        <section className="glass-panel rounded-[32px] p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-cream">المنتجات الحالية</h2>
            <span className="text-xs text-white/50">{products.length} منتج</span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[1250px] border-separate border-spacing-y-3 text-right">
              <thead>
                <tr className="text-xs uppercase tracking-[0.25em] text-white/40">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">اسم المنتج</th>
                  <th className="px-3 py-2">السعر</th>
                  <th className="px-3 py-2">السعرات</th>
                  <th className="px-3 py-2">متوسط الانتظار</th>
                  <th className="px-3 py-2">الوصف</th>
                  <th className="px-3 py-2">التاج</th>
                  <th className="px-3 py-2">الخصم</th>
                  <th className="px-3 py-2">الترتيب</th>
                  <th className="px-3 py-2">القسم</th>
                  <th className="px-3 py-2">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product, index) => {
                  const tags = normalizeSelectedTags(product.tags).slice(0, 2);
                  return (
                    <tr key={product.id} className="rounded-2xl bg-white/5 text-sm text-white/80">
                      <td className="rounded-r-2xl px-3 py-4 font-semibold text-white">{index + 1}</td>
                      <td className="px-3 py-4">
                        <div className="font-semibold text-white">{product.nameAr}</div>
                        <div className="mt-1 text-xs text-white/45">{product.nameEn}</div>
                      </td>
                      <td className="px-3 py-4">EGP {Number(product.price ?? 0).toFixed(2)}</td>
                      <td className="px-3 py-4">{product.calories ?? 0}</td>
                      <td className="px-3 py-4">{product.averageWaitTime ?? 0}</td>
                      <td className="px-3 py-4">{product.descriptionAr || '0'}</td>
                      <td className="px-3 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {tags.length ? tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
                              style={{ backgroundColor: tag.color || '#64748b' }}
                            >
                              {getTagLabel(tag, lang)}
                            </span>
                          )) : <span className="text-white/45">0</span>}
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        {product.isDiscounted && product.discountPrice ? `EGP ${Number(product.discountPrice).toFixed(2)}` : '0'}
                      </td>
                      <td className="px-3 py-4">{product.sortOrder ?? 0}</td>
                      <td className="px-3 py-4">{categoryMap.get(product.categoryId)?.nameAr ?? '0'}</td>
                      <td className="rounded-l-2xl px-3 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/products/new?edit=${product.id}`)}
                            className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/5"
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(product.id)}
                            className="rounded-xl border border-red-400/20 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-400/10"
                          >
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(confirmId)}
        title="هل أنت متأكد أنك تريد حذف المنتج؟"
        description="سيتم حذف المنتج نهائيًا."
        confirmLabel="نعم"
        cancelLabel="لا"
        onConfirm={deleteProduct}
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
