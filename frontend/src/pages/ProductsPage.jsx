import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminShell } from '../components/AdminShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Toast } from '../components/Toast';
import { api } from '../lib/api';
import { normalizeSelectedTags, getTagLabel } from '../lib/productTags';
import { useLanguage } from '../context/LanguageContext';
import { useWindowDataChanged } from '../hooks/useWindowDataChanged';

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
  const [forceDeleteId, setForceDeleteId] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setLang('ar');
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'ar';
  }, [setLang]);

  async function refresh() {
    const [categoryData, productData] = await Promise.all([api.categories('menu'), api.products('menu')]);
    setCategories(Array.isArray(categoryData) ? categoryData.filter(Boolean) : []);
    setProducts(Array.isArray(productData) ? productData.filter(Boolean) : []);
  }

  useEffect(() => {
    refresh().catch((error) => setToast({ type: 'error', title: 'خطأ', description: error.message }));
  }, []);

  useWindowDataChanged(() => {
    refresh().catch(() => {});
  });

  const categoryMap = useMemo(
    () => new Map((Array.isArray(categories) ? categories.filter(Boolean) : []).map((category) => [category.id, category])),
    [categories]
  );
  const safeProducts = useMemo(() => (Array.isArray(products) ? products.filter(Boolean) : []), [products]);

  function renderSizePreview(product) {
    const sizeOptions = Array.isArray(product.sizeOptions) ? product.sizeOptions.filter(Boolean) : [];
    if (!sizeOptions.length) return null;
    return (
      <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
        <div className="mb-2 text-[11px] font-semibold text-white/45">
          {lang === 'ar' ? 'الأحجام' : 'Sizes'}
        </div>
        <select
          className="w-full rounded-xl border border-white/10 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
          value=""
          disabled
        >
          <option value="">{lang === 'ar' ? 'اختر المقاس' : 'Choose size'}</option>
          {sizeOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {lang === 'ar' ? item.labelAr : item.labelEn} + {Number(item.price ?? 0).toFixed(2)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  async function deleteProduct() {
    if (!confirmId) return;
    try {
      await api.deleteProduct(confirmId);
      setToast({ type: 'success', title: 'تم الحذف بنجاح' });
      setConfirmId(null);
      await refresh();
    } catch (error) {
      if (String(error.message ?? '').includes('مرتبط بطلبات سابقة')) {
        setForceDeleteId(confirmId);
        setConfirmId(null);
        return;
      }
      setConfirmId(null);
      setToast({ type: 'error', title: 'خطأ', description: error.message });
    }
  }

  async function confirmForceDelete() {
    if (!forceDeleteId) return;
    try {
      await api.deleteProduct(forceDeleteId, true);
      setToast({ type: 'success', title: 'تم الحذف بنجاح' });
      setForceDeleteId(null);
      await refresh();
    } catch (error) {
      setForceDeleteId(null);
      setToast({ type: 'error', title: 'خطأ', description: error.message });
    }
  }

  return (
    <AdminShell title="المنتجات">
      <div className="space-y-6">
        <section className="glass-panel rounded-[32px] p-5 sm:p-6 shadow-glow">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-bold text-cream">المنتجات الحالية</h2>
            <span className="text-xs text-white/50">{safeProducts.length} منتج</span>
          </div>

          <div className="mt-4 space-y-3 lg:hidden">
            {safeProducts.map((product, index) => {
              const tags = normalizeSelectedTags(product.tags).slice(0, 2);
              return (
                <div key={product.id} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-white/45">#{index + 1}</div>
                      <div className="mt-1 font-semibold text-white">{product?.nameAr ?? product?.nameEn ?? ''}</div>
                      <div className="text-xs text-white/45">{product?.nameEn ?? product?.nameAr ?? ''}</div>
                    </div>
                    <span className="text-sm font-bold text-gold">EGP {Number(product?.price ?? 0).toFixed(2)}</span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-white/75">
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="text-[11px] text-white/45">السعرات</div>
                      <div className="mt-1 font-semibold text-white">{product?.calories ?? 0}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="text-[11px] text-white/45">الانتظار</div>
                      <div className="mt-1 font-semibold text-white">{product?.averageWaitTime ?? 0}</div>
                    </div>
                  </div>

                  <div className="mt-3 text-sm text-white/70">
                    {product?.descriptionAr || product?.descriptionEn || '0'}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
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

                  {renderSizePreview(product)}

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/products/new?edit=${product?.id}`)}
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/5"
                    >
                      تعديل
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(product?.id)}
                      className="rounded-xl border border-red-400/20 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-400/10"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 hidden overflow-x-auto lg:block">
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
                {safeProducts.map((product, index) => {
                  const tags = normalizeSelectedTags(product.tags).slice(0, 2);
                  return (
                    <tr key={product.id} className="rounded-2xl bg-white/5 text-sm text-white/80">
                      <td className="rounded-r-2xl px-3 py-4 font-semibold text-white">{index + 1}</td>
                      <td className="px-3 py-4">
                        <div className="font-semibold text-white">{product?.nameAr ?? product?.nameEn ?? ''}</div>
                        <div className="mt-1 text-xs text-white/45">{product?.nameEn ?? product?.nameAr ?? ''}</div>
                        {Array.isArray(product.sizeOptions) && product.sizeOptions.length ? (
                          <div className="mt-2">
                            <span className="rounded-full bg-gold/15 px-2.5 py-1 text-[11px] font-semibold text-gold">
                              {lang === 'ar' ? 'متغير' : 'Variable'}
                            </span>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-4">EGP {Number(product?.price ?? 0).toFixed(2)}</td>
                      <td className="px-3 py-4">{product?.calories ?? 0}</td>
                      <td className="px-3 py-4">{product?.averageWaitTime ?? 0}</td>
                      <td className="px-3 py-4">{product?.descriptionAr || product?.descriptionEn || '0'}</td>
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
                        {product?.isDiscounted && product?.discountPrice ? `EGP ${Number(product.discountPrice).toFixed(2)}` : '0'}
                      </td>
                      <td className="px-3 py-4">{product.sortOrder ?? 0}</td>
                      <td className="px-3 py-4">{categoryMap.get(product.categoryId)?.nameAr ?? '0'}</td>
                      <td className="rounded-l-2xl px-3 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/products/new?edit=${product?.id}`)}
                            className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/5"
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(product?.id)}
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

      <ConfirmDialog
        open={Boolean(forceDeleteId)}
        title="هذا المنتج مرتبط بطلبات سابقة"
        description="هل أنت متأكد أنك تريد حذفه؟ سيتم حذف بياناته من الطلبات السابقة أيضًا."
        confirmLabel="نعم"
        cancelLabel="لا"
        onConfirm={confirmForceDelete}
        onCancel={() => setForceDeleteId(null)}
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
