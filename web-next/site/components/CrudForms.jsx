import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { t } from '../lib/i18n';
import { BUILTIN_PRODUCT_TAGS, getTagLabel, isBuiltinTag, normalizeSelectedTags } from '../lib/productTags';
import { resolveMediaUrl } from './ProductMedia';

function Field({ label, children, hint, error, required }) {
  return (
    <label className="block space-y-2">
      <span className="block text-sm font-medium text-white/75">
        {label}
        {required ? <span className="mr-1 text-red-300">*</span> : null}
      </span>
      {children}
      {hint ? <span className="block text-xs text-white/45">{hint}</span> : null}
      {error ? <span className="block text-xs font-medium text-red-300">{error}</span> : null}
    </label>
  );
}

const inputClass = 'w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition placeholder:text-white/25 focus:border-gold';

function TagPill({ tag, checked, onToggle, onEdit, onDelete, editable, lang }) {
  const label = getTagLabel(tag, lang);
  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2 transition ${
        checked ? 'border-white/20 bg-white/10' : 'border-white/10 bg-black/20'
      }`}
      style={checked ? { boxShadow: `inset 0 0 0 1px ${tag.color}55` } : undefined}
    >
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={checked} onChange={onToggle} />
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold text-white"
          style={{ backgroundColor: tag.color || '#64748b' }}
        >
          {label}
        </span>
      </label>

      {editable ? (
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <input
            className="min-w-[120px] flex-1 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none placeholder:text-white/30"
            value={tag.labelAr ?? ''}
            onChange={(event) => onEdit({ ...tag, labelAr: event.target.value, labelEn: event.target.value })}
            placeholder={lang === 'ar' ? 'اسم جديد' : 'New label'}
          />
          <input
            type="color"
            className="h-10 w-12 rounded-xl border border-white/10 bg-black/25 p-1"
            value={tag.color ?? '#64748b'}
            onChange={(event) => onEdit({ ...tag, color: event.target.value })}
            aria-label="Tag color"
          />
          <button
            type="button"
            onClick={onDelete}
            className="rounded-xl border border-red-400/20 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-400/10"
          >
            {lang === 'ar' ? 'حذف' : 'Delete'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function CategoryForm({ value, onChange, onSubmit, onCancel, errors = {} }) {
  const { lang } = useLanguage();
  return (
    <form
      className="space-y-4 rounded-[24px] border border-white/10 bg-white/5 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={lang === 'ar' ? 'اسم القسم' : 'Category name'} required error={errors.nameAr}>
          <input
            className={inputClass}
            placeholder={lang === 'ar' ? 'مثال: مشروبات' : 'Example: Drinks'}
            value={value.nameAr}
            onChange={(e) => onChange({ ...value, nameAr: e.target.value })}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t(lang, 'sortOrder')}>
          <input
            type="number"
            className={inputClass}
            placeholder="0"
            value={value.sortOrder}
            onChange={(e) => onChange({ ...value, sortOrder: e.target.value })}
          />
        </Field>
        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/75">
          <input
            type="checkbox"
            checked={value.isActive}
            onChange={(e) => onChange({ ...value, isActive: e.target.checked })}
          />
          {t(lang, 'activeCategory')}
        </label>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button className="rounded-2xl bg-gold px-4 py-3 text-sm font-bold text-ink" type="submit">
          {t(lang, 'saveCategory')}
        </button>
        <button className="rounded-2xl border border-white/10 px-4 py-3 text-sm" type="button" onClick={onCancel}>
          {lang === 'ar' ? 'إلغاء' : 'Cancel'}
        </button>
      </div>
    </form>
  );
}

export function ProductForm({
  value,
  categories,
  onChange,
  onSubmit,
  onCancel,
  onCoverFile,
  onGalleryFiles,
  errors = {}
}) {
  const { lang } = useLanguage();
  const [customTagLabel, setCustomTagLabel] = useState('');
  const [customTagColor, setCustomTagColor] = useState('#64748b');

  const selectedTags = useMemo(() => normalizeSelectedTags(value.tags), [value.tags]);
  const selectedIds = useMemo(() => new Set(selectedTags.map((tag) => tag.id)), [selectedTags]);
  const galleryItems = useMemo(
    () => String(value.galleryUrls ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    [value.galleryUrls]
  );
  const coverMedia = String(value.coverMediaUrl ?? '').trim();

  useEffect(() => {
    if (!value.tags?.length) {
      setCustomTagLabel('');
      setCustomTagColor('#64748b');
    }
  }, [value.tags]);

  function updateTags(nextTags) {
    onChange({ ...value, tags: nextTags });
  }

  function toggleBuiltinTag(tag) {
    const exists = selectedIds.has(tag.id);
    if (exists) {
      updateTags(selectedTags.filter((item) => item.id !== tag.id));
      return;
    }
    updateTags([...selectedTags, { ...tag, kind: 'builtin' }]);
  }

  function addCustomTag() {
    const label = String(customTagLabel ?? '').trim();
    if (!label) return;
    const id = `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    updateTags([
      ...selectedTags,
      {
        id,
        labelAr: label,
        labelEn: label,
        color: customTagColor || '#64748b',
        kind: 'custom'
      }
    ]);
    setCustomTagLabel('');
    setCustomTagColor('#64748b');
  }

  function editTag(updatedTag) {
    updateTags(selectedTags.map((tag) => (tag.id === updatedTag.id ? updatedTag : tag)));
  }

  function deleteTag(tagId) {
    updateTags(selectedTags.filter((tag) => tag.id !== tagId));
  }

  function removeGalleryItem(item) {
    onChange({
      ...value,
      galleryUrls: galleryItems.filter((candidate) => candidate !== item).join(', ')
    });
  }

  function removeCoverMedia() {
    onChange({ ...value, coverMediaUrl: '' });
  }

  return (
    <form
      className="space-y-4 rounded-[24px] border border-white/10 bg-white/5 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t(lang, 'category')} required error={errors.categoryId}>
          <select className={inputClass} value={value.categoryId} onChange={(e) => onChange({ ...value, categoryId: e.target.value })}>
            <option value="">{t(lang, 'selectCategory')}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {lang === 'ar' ? category.nameAr : category.nameEn}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t(lang, 'mediaType')}>
          <select className={inputClass} value={value.mediaType} onChange={(e) => onChange({ ...value, mediaType: e.target.value })}>
            <option value="image">{lang === 'ar' ? 'صورة' : 'Image'}</option>
            <option value="video">{lang === 'ar' ? 'فيديو' : 'Video'}</option>
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t(lang, 'productNameAr')} required error={errors.nameAr}>
          <input
            className={inputClass}
            placeholder={lang === 'ar' ? 'مثال: برجر' : 'Example: Burger'}
            value={value.nameAr}
            onChange={(e) => onChange({ ...value, nameAr: e.target.value })}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t(lang, 'descriptionAr')}>
          <textarea
            className={`${inputClass} min-h-28`}
            placeholder={lang === 'ar' ? 'وصف الصنف...' : 'Product description...'}
            value={value.descriptionAr}
            onChange={(e) => onChange({ ...value, descriptionAr: e.target.value })}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={lang === 'ar' ? 'المكونات' : 'Ingredients'}
          hint={lang === 'ar' ? 'اكتب المكونات مفصولة بفواصل.' : 'Write ingredients separated by commas.'}
        >
          <textarea
            className={`${inputClass} min-h-24`}
            placeholder={lang === 'ar' ? 'دجاج، جبنة، خبز...' : 'Chicken, cheese, bread...'}
            value={value.ingredients}
            onChange={(e) => onChange({ ...value, ingredients: e.target.value })}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t(lang, 'coverMediaUrl')}
          required
          error={errors.coverMediaUrl}
          hint={lang === 'ar' ? 'الصق الرابط أو ارفع ملفًا من الحقل بالأسفل.' : 'Paste a URL, or upload a file using the field below.'}
        >
          <input
            className={inputClass}
            placeholder="https://..."
            value={value.coverMediaUrl}
            onChange={(e) => onChange({ ...value, coverMediaUrl: e.target.value })}
          />
        </Field>
        <Field
          label={t(lang, 'galleryUrls')}
          hint={lang === 'ar' ? 'روابط مفصولة بفواصل. الملفات المرفوعة ستُضاف تلقائيًا.' : 'Comma-separated URLs. Uploaded files will be appended automatically.'}
        >
          <input
            className={inputClass}
            placeholder="https://..., https://..."
            value={value.galleryUrls}
            onChange={(e) => onChange({ ...value, galleryUrls: e.target.value })}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">{lang === 'ar' ? 'معاينة الغلاف' : 'Cover preview'}</h3>
              <p className="mt-1 text-xs text-white/45">{lang === 'ar' ? 'يمكنك حذف الصورة أو الفيديو من هنا.' : 'Remove the cover media from here.'}</p>
            </div>
            <button
              type="button"
              onClick={removeCoverMedia}
              className="rounded-xl border border-red-400/20 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-400/10"
            >
              {lang === 'ar' ? 'حذف' : 'Delete'}
            </button>
          </div>
          <div className="mt-3 aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 bg-black/30">
            {coverMedia ? (
              String(value.mediaType) === 'video' || /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(coverMedia) || coverMedia.startsWith('data:video') ? (
                <video src={resolveMediaUrl(coverMedia)} className="h-full w-full object-cover" autoPlay loop muted playsInline />
              ) : (
                <img src={resolveMediaUrl(coverMedia)} alt="" className="h-full w-full object-cover" />
              )
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-white/45">
                {lang === 'ar' ? 'لا توجد صورة غلاف' : 'No cover media'}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">{lang === 'ar' ? 'معرض الصور' : 'Gallery preview'}</h3>
              <p className="mt-1 text-xs text-white/45">{lang === 'ar' ? 'اضغط حذف لإزالة أي عنصر.' : 'Use delete to remove any item.'}</p>
            </div>
          </div>
          <div className="mt-3 grid max-h-[220px] grid-cols-2 gap-3 overflow-y-auto pr-1">
            {galleryItems.length ? galleryItems.map((item) => (
              <div key={item} className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                <div className="aspect-square">
                  {String(value.mediaType) === 'video' || /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(item) || item.startsWith('data:video') ? (
                    <video src={resolveMediaUrl(item)} className="h-full w-full object-cover" autoPlay loop muted playsInline />
                  ) : (
                    <img src={resolveMediaUrl(item)} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeGalleryItem(item)}
                  className="absolute left-2 top-2 rounded-full border border-red-400/20 bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-red-100"
                >
                  {lang === 'ar' ? 'حذف' : 'Delete'}
                </button>
              </div>
            )) : (
              <div className="col-span-2 rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-xs text-white/45">
                {lang === 'ar' ? 'لا توجد صور داخل المعرض' : 'No gallery media'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t(lang, 'uploadCoverFile')}>
          <input
            className="block w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-gold file:px-4 file:py-2 file:text-sm file:font-bold file:text-ink"
            type="file"
            accept="image/*,video/*"
            onChange={(e) => onCoverFile?.(e.target.files?.[0] ?? null)}
          />
        </Field>
        <Field label={t(lang, 'uploadGalleryFiles')}>
          <input
            className="block w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-gold file:px-4 file:py-2 file:text-sm file:font-bold file:text-ink"
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={(e) => onGalleryFiles?.(Array.from(e.target.files ?? []))}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t(lang, 'price')} required error={errors.price}>
          <input
            className={inputClass}
            placeholder="0.00"
            value={value.price}
            onChange={(e) => onChange({ ...value, price: e.target.value })}
          />
        </Field>
        <Field label={lang === 'ar' ? 'متوسط الانتظار' : 'Average wait time'}>
          <input
            className={inputClass}
            placeholder={lang === 'ar' ? '10' : '10'}
            value={value.averageWaitTime ?? ''}
            onChange={(e) => onChange({ ...value, averageWaitTime: e.target.value })}
          />
        </Field>
        <Field label={lang === 'ar' ? 'السعرات' : 'Calories'}>
          <input
            className={inputClass}
            placeholder="650"
            value={value.calories}
            onChange={(e) => onChange({ ...value, calories: e.target.value })}
          />
        </Field>
        <Field label={t(lang, 'sortOrder')}>
          <input
            className={inputClass}
            placeholder="0"
            value={value.sortOrder}
            onChange={(e) => onChange({ ...value, sortOrder: e.target.value })}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/75">
          <input
            type="checkbox"
            checked={value.isAvailable}
            onChange={(e) => onChange({ ...value, isAvailable: e.target.checked })}
          />
          {t(lang, 'available')}
        </label>
        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/75">
          <input
            type="checkbox"
            checked={value.isDiscounted}
            onChange={(e) => onChange({ ...value, isDiscounted: e.target.checked })}
          />
          {t(lang, 'discounted')}
        </label>
        <Field label={t(lang, 'discountPrice')}>
          <input
            className={inputClass}
            placeholder="0.00"
            value={value.discountPrice}
            onChange={(e) => onChange({ ...value, discountPrice: e.target.value })}
          />
        </Field>
      </div>

      <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">{lang === 'ar' ? 'الاختيارات' : 'Tags'}</h3>
            <p className="mt-1 text-xs text-white/45">
              {lang === 'ar' ? 'اختر أكثر من اختيار، وسيظهر اثنان فقط في الصفحة الرئيسية.' : 'Pick multiple tags. Only two will show on the homepage card.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              className="w-36 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30"
              value={customTagLabel}
              onChange={(event) => setCustomTagLabel(event.target.value)}
              placeholder={lang === 'ar' ? 'وسم جديد' : 'New tag'}
            />
            <input
              type="color"
              className="h-10 w-12 rounded-xl border border-white/10 bg-black/25 p-1"
              value={customTagColor}
              onChange={(event) => setCustomTagColor(event.target.value)}
              aria-label="Custom tag color"
            />
            <button type="button" onClick={addCustomTag} className="rounded-xl bg-gold px-3 py-2 text-xs font-bold text-ink">
              {lang === 'ar' ? 'إضافة' : 'Add'}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {BUILTIN_PRODUCT_TAGS.map((tag) => {
            const normalized = {
              id: tag.id,
              labelAr: tag.labelAr,
              labelEn: tag.labelEn,
              color: tag.color,
              kind: 'builtin'
            };
            return (
              <TagPill
                key={tag.id}
                tag={normalized}
                checked={selectedIds.has(tag.id)}
                onToggle={() => toggleBuiltinTag(normalized)}
                lang={lang}
              />
            );
          })}

          {selectedTags.filter((tag) => !isBuiltinTag(tag)).map((tag) => (
            <TagPill
              key={tag.id}
              tag={tag}
              checked={selectedIds.has(tag.id)}
              onToggle={() => {
                if (selectedIds.has(tag.id)) {
                  deleteTag(tag.id);
                  return;
                }
                updateTags([...selectedTags, tag]);
              }}
              onEdit={editTag}
              onDelete={() => deleteTag(tag.id)}
              editable
              lang={lang}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={lang === 'ar' ? 'مسببات الحساسية' : 'Allergens'}
          hint={lang === 'ar' ? 'اكتب العناصر مفصولة بفاصلة.' : 'Write items separated by commas.'}
        >
          <textarea
            className={`${inputClass} min-h-24`}
            placeholder={lang === 'ar' ? 'حليب، جلوتين، مكسرات' : 'Milk, gluten, nuts'}
            value={value.allergens}
            onChange={(e) => onChange({ ...value, allergens: e.target.value })}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button className="rounded-2xl bg-gold px-4 py-3 text-sm font-bold text-ink" type="submit">
          {t(lang, 'saveProduct')}
        </button>
        <button className="rounded-2xl border border-white/10 px-4 py-3 text-sm" type="button" onClick={onCancel}>
          {lang === 'ar' ? 'إلغاء' : 'Cancel'}
        </button>
      </div>
    </form>
  );
}
