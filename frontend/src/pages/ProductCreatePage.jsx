import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AdminShell } from '../components/AdminShell';
import { ProductForm } from '../components/CrudForms';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Toast } from '../components/Toast';
import { api } from '../lib/api';
import { normalizeSelectedTags } from '../lib/productTags';
import { useLanguage } from '../context/LanguageContext';
import { useWindowDataChanged } from '../hooks/useWindowDataChanged';

function createChoiceGroup(index = 0) {
  return {
    id: `choice-group-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    titleAr: '',
    titleEn: '',
    items: []
  };
}

function createEmptyProduct() {
  return {
    categoryId: '',
    nameAr: '',
    nameEn: '',
    descriptionAr: '',
    descriptionEn: '',
    ingredients: '',
    mediaType: 'image',
    coverMediaUrl: '',
    galleryUrls: '',
    tags: [],
    allergens: '',
    sizeOptions: [],
    sideDishOptions: [],
    addonOptions: [],
    customChoiceGroups: [createChoiceGroup(0), createChoiceGroup(1)],
    price: '',
    calories: '',
    averageWaitTime: '',
    isDiscounted: false,
    discountPrice: '',
    isAvailable: true,
    isFeatured: false,
    sortOrder: 0,
    scope: 'menu'
  };
}

const MAX_UPLOAD_BYTES = 1024 * 1024;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function splitList(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeOptionList(items = []) {
  return Array.isArray(items)
    ? items.map((item, index) => ({
      id: String(item?.id ?? `option-${index + 1}`),
      labelAr: String(item?.labelAr ?? item?.labelEn ?? item?.label ?? '').trim(),
      labelEn: String(item?.labelEn ?? item?.labelAr ?? item?.label ?? '').trim(),
      price: String(item?.price ?? '0'),
      required: Boolean(item?.required)
    })).filter((item) => item.labelAr || item.labelEn)
    : [];
}

function normalizeChoiceGroups(groups = []) {
  return Array.isArray(groups)
    ? groups.map((group, index) => {
      const items = normalizeOptionList(group?.items);
      const titleAr = String(group?.titleAr ?? '').trim();
      const titleEn = String(group?.titleEn ?? titleAr ?? '').trim() || titleAr;
      if (!titleAr && !titleEn) return null;
      return {
        id: String(group?.id ?? `choice-group-${index + 1}`),
        titleAr,
        titleEn,
        items
      };
    }).filter(Boolean)
    : [];
}

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

export function ProductCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setLang } = useLanguage();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(() => createEmptyProduct());
  const [selectedId, setSelectedId] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [confirmId, setConfirmId] = useState(null);
  const [forceDeleteId, setForceDeleteId] = useState(null);
  const [toast, setToast] = useState(null);
  const formRef = useRef(null);

  useEffect(() => {
    setLang('ar');
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'ar';
  }, [setLang]);

  async function refresh() {
    const [categoryData, productData] = await Promise.all([api.categories('menu'), api.products('menu')]);
    setCategories(categoryData);
    setProducts(productData);
    const editId = searchParams.get('edit');
    if (editId) {
      const product = productData.find((item) => String(item.id) === String(editId));
      if (product) {
        startEdit(product);
      }
    }
  }

  useEffect(() => {
    refresh().catch((error) => setToast({ type: 'error', title: 'خطأ', description: error.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useWindowDataChanged(() => {
    refresh().catch(() => {});
  });

  const categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  function resetForm() {
    setForm(createEmptyProduct());
    setSelectedId(null);
    setFieldErrors({});
  }

  function scrollToForm() {
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  }

  function startEdit(product) {
    setSelectedId(product.id);
    setForm({
      categoryId: product.categoryId,
      nameAr: product.nameAr ?? '',
      nameEn: product.nameEn ?? '',
      descriptionAr: product.descriptionAr ?? '',
      descriptionEn: product.descriptionEn ?? '',
      ingredients: Array.isArray(product.ingredients) ? product.ingredients.join(', ') : '',
      mediaType: product.mediaType ?? 'image',
      coverMediaUrl: product.coverMediaUrl ?? '',
      galleryUrls: Array.isArray(product.galleryUrls) ? product.galleryUrls.join(', ') : '',
      tags: normalizeSelectedTags(product.tags),
      allergens: Array.isArray(product.allergens) ? product.allergens.join(', ') : '',
      sizeOptions: normalizeOptionList(product.sizeOptions),
      sideDishOptions: normalizeOptionList(product.sideDishOptions),
      addonOptions: normalizeOptionList(product.addonOptions),
      customChoiceGroups: normalizeChoiceGroups(product.customChoiceGroups).length
        ? normalizeChoiceGroups(product.customChoiceGroups)
        : [createChoiceGroup(0), createChoiceGroup(1)],
      price: String(product.price ?? ''),
      calories: product.calories ?? '',
      averageWaitTime: product.averageWaitTime ?? '',
      isDiscounted: Boolean(product.isDiscounted),
      discountPrice: product.discountPrice ?? '',
      isAvailable: Boolean(product.isAvailable),
      isFeatured: Boolean(product.isFeatured),
      sortOrder: product.sortOrder ?? 0,
      scope: 'menu'
    });
    setFieldErrors({});
    scrollToForm();
  }

  async function handleCoverFile(file) {
    try {
      if (!file) return;
      if (file.size > MAX_UPLOAD_BYTES) throw new Error('File size must be 1MB or smaller');
      const dataUrl = await readFileAsDataUrl(file);
      const uploaded = await api.upload({ fileData: dataUrl, fileName: file.name });
      setForm((current) => ({ ...current, coverMediaUrl: uploaded.url }));
    } catch (error) {
      setToast({ type: 'error', title: 'خطأ', description: error.message });
    }
  }

  async function handleGalleryFiles(files) {
    try {
      const uploaded = [];
      for (const file of files) {
        if (file.size > MAX_UPLOAD_BYTES) throw new Error('File size must be 1MB or smaller');
        const dataUrl = await readFileAsDataUrl(file);
        const result = await api.upload({ fileData: dataUrl, fileName: file.name });
        uploaded.push(result.url);
      }
      if (!uploaded.length) return;
      setForm((current) => {
        const existing = splitList(current.galleryUrls);
        return { ...current, galleryUrls: [...existing, ...uploaded].join(', ') };
      });
    } catch (error) {
      setToast({ type: 'error', title: 'خطأ', description: error.message });
    }
  }

  async function saveProduct() {
    try {
      setFieldErrors({});
      const nameAr = String(form.nameAr ?? '').trim();
      const coverMediaUrl = String(form.coverMediaUrl ?? '').trim();
      if (!form.categoryId) return setFieldErrors({ categoryId: 'مطلوب' });
      if (!nameAr) return setFieldErrors({ nameAr: 'مطلوب' });
      if (!String(form.price ?? '').trim()) return setFieldErrors({ price: 'مطلوب' });
      if (!coverMediaUrl) return setFieldErrors({ coverMediaUrl: 'مطلوب' });

      const payload = {
        categoryId: Number(form.categoryId),
        nameAr,
        nameEn: String(form.nameEn ?? '').trim() || nameAr,
        descriptionAr: String(form.descriptionAr ?? '').trim(),
        descriptionEn: String(form.descriptionEn ?? '').trim() || String(form.descriptionAr ?? '').trim(),
        ingredients: splitList(form.ingredients),
        mediaType: form.mediaType || 'image',
        coverMediaUrl,
        galleryUrls: splitList(form.galleryUrls),
        tags: normalizeSelectedTags(form.tags),
        allergens: splitList(form.allergens),
        sizeOptions: normalizeOptionList(form.sizeOptions),
        sideDishOptions: normalizeOptionList(form.sideDishOptions),
        addonOptions: normalizeOptionList(form.addonOptions),
        customChoiceGroups: normalizeChoiceGroups(form.customChoiceGroups),
        price: form.price,
        calories: form.calories ? Number(form.calories) : null,
        averageWaitTime: String(form.averageWaitTime ?? '').trim() ? Number(form.averageWaitTime) : null,
        isDiscounted: Boolean(form.isDiscounted),
        discountPrice: form.isDiscounted && String(form.discountPrice ?? '').trim() ? form.discountPrice : null,
        isAvailable: Boolean(form.isAvailable),
        isFeatured: Boolean(form.isFeatured),
        sortOrder: Number(form.sortOrder) || 0,
        scope: 'menu'
      };

      if (selectedId) {
        await api.updateProduct(selectedId, payload);
        setToast({ type: 'success', title: 'تم التعديل بنجاح' });
      } else {
        await api.createProduct(payload);
        setToast({ type: 'success', title: 'تم الحفظ بنجاح' });
      }
      resetForm();
      await refresh();
    } catch (error) {
      const details = parseValidationDetails(error);
      if (details) {
        setFieldErrors({
          categoryId: firstFieldMessage(details, 'categoryId') || '',
          nameAr: firstFieldMessage(details, 'nameAr') || '',
          price: firstFieldMessage(details, 'price') || '',
          coverMediaUrl: firstFieldMessage(details, 'coverMediaUrl') || ''
        });
        return;
      }
      setToast({ type: 'error', title: 'خطأ', description: error.message });
    }
  }

  async function deleteProduct() {
    if (!confirmId) return;
    try {
      await api.deleteProduct(confirmId);
      setToast({ type: 'success', title: 'تم الحذف بنجاح' });
      setConfirmId(null);
      if (selectedId === confirmId) resetForm();
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
      if (selectedId === forceDeleteId) resetForm();
      setForceDeleteId(null);
      await refresh();
    } catch (error) {
      setForceDeleteId(null);
      setToast({ type: 'error', title: 'خطأ', description: error.message });
    }
  }

  return (
    <AdminShell title="إضافة منتج">
      <div className="space-y-6">
        <section className="glass-panel rounded-[32px] p-6 shadow-glow">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">إضافة / تعديل منتج</p>
              <h1 className="mt-2 text-3xl font-bold text-cream">{selectedId ? 'تعديل المنتج' : 'إضافة منتج'}</h1>
            </div>
            <button type="button" onClick={() => navigate('/admin/products')} className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/80">
              قائمة المنتجات
            </button>
          </div>
        </section>

        <div className="glass-panel rounded-[32px] p-5" ref={formRef}>
          <ProductForm
            value={form}
            errors={fieldErrors}
            categories={categories}
            onChange={setForm}
            onSubmit={saveProduct}
            onCancel={resetForm}
            onCoverFile={handleCoverFile}
            onGalleryFiles={handleGalleryFiles}
          />
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(confirmId)}
        title="هل أنت متأكد أنك تريد حذف هذا المنتج؟"
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
