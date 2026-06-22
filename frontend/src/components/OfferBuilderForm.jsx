import { useMemo, useState } from 'react';
import { resolveMediaUrl } from './ProductMedia';

function SearchableDropdown({ products, selectedIds, onPick, lang }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (Array.isArray(products) ? products : []).filter(Boolean).filter((product) => {
      if (!q) return true;
      return [product?.nameAr, product?.nameEn, String(product?.price ?? '')].some((value) =>
        String(value ?? '').toLowerCase().includes(q)
      );
    });
  }, [products, query]);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-right text-sm text-white transition hover:bg-white/5"
      >
        <span className="font-semibold">
          {lang === 'ar' ? 'اختر منتجًا من القائمة' : 'Choose product from list'}
        </span>
        <span className="text-xs text-white/45">{open ? '–' : '+'}</span>
      </button>

      {open ? (
        <>
          <input
            className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35"
            placeholder={lang === 'ar' ? 'ابحث عن منتج...' : 'Search product...'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
            {filtered.map((product) => {
              const isSelected = selectedIds.has(String(product.id));
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onPick(product)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-right text-sm transition ${
                    isSelected ? 'border-gold/40 bg-gold/10' : 'border-white/10 bg-black/20 hover:bg-white/5'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-3 text-right">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 text-[11px] font-bold text-white/70">
                      {isSelected ? '✓' : '+'}
                    </span>
                    <span className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/20">
                      {product.coverMediaUrl ? (
                        <img src={resolveMediaUrl(product.coverMediaUrl)} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <div className="truncate font-semibold text-white">
                        {lang === 'ar' ? (product?.nameAr ?? product?.nameEn ?? '') : (product?.nameEn ?? product?.nameAr ?? '')}
                      </div>
                      <div className="text-xs text-white/50">
                        EGP {Number(product?.price ?? 0).toFixed(2)}
                      </div>
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-bold text-gold">
                    {isSelected ? (lang === 'ar' ? 'مُضاف' : 'Added') : '+'}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-xs text-white/40">
          {lang === 'ar' ? 'افتح القائمة لاختيار المنتجات' : 'Open the list to choose products'}
        </div>
      )}
    </div>
  );
}

function OfferGroupEditor({ value, products, onChange, onDelete, lang }) {
  const selectedIds = useMemo(
    () => new Set((value.items ?? []).map((item) => String(item.productId)).filter(Boolean)),
    [value.items]
  );

  function addProduct(product) {
    if (selectedIds.has(String(product.id))) return;
    onChange({
      ...value,
      items: [
        ...(value.items ?? []),
        { productId: product.id, extraPrice: '0', includeProductOptions: false, sortOrder: String(value.items?.length ?? 0) }
      ]
    });
  }

  function updateItem(productId, patch) {
    onChange({
      ...value,
      items: (value.items ?? []).map((item) => (String(item.productId) === String(productId) ? { ...item, ...patch } : item))
    });
  }

  function removeItem(productId) {
    onChange({
      ...value,
      items: (value.items ?? []).filter((item) => String(item.productId) !== String(productId))
    });
  }

  return (
    <section className="rounded-[24px] border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-lg font-bold text-cream">
          {lang === 'ar' ? 'مجموعة العرض' : 'Offer group'}
        </h4>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-white/75">
            <input
              type="checkbox"
              checked={Boolean(value.required)}
              onChange={(e) => onChange({
                ...value,
                required: e.target.checked,
                minSelect: e.target.checked ? String(Math.max(1, Number(value.minSelect ?? 0))) : '0',
                maxSelect: e.target.checked
                  ? String(Math.max(Number(value.maxSelect ?? 1), Math.max(1, Number(value.minSelect ?? 0))))
                  : String(Math.max(Number(value.maxSelect ?? 1), 1))
              })}
            />
            {lang === 'ar' ? 'مطلوب' : 'Required'}
          </label>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20"
          >
            {lang === 'ar' ? 'حذف المجموعة' : 'Delete group'}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block space-y-2">
          <span className="block text-xs font-semibold text-white/60">
            {lang === 'ar' ? 'اسم المجموعة بالعربي' : 'Group title in Arabic'}
          </span>
          <input
            className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/35"
            placeholder={lang === 'ar' ? 'مثال: البيتزا الرئيسية' : 'Example: Main pizza'}
            value={value.titleAr ?? ''}
            onChange={(e) => onChange({ ...value, titleAr: e.target.value })}
          />
        </label>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <label className="block space-y-2">
          <span className="block text-xs font-semibold text-white/60">
            {lang === 'ar' ? 'نوع الاختيار' : 'Selection type'}
          </span>
          <select
            className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none"
            value={value.selectionMode ?? ''}
            onChange={(e) => onChange({
              ...value,
              selectionMode: e.target.value,
              minSelect: e.target.value === 'radio' ? '1' : value.minSelect,
              maxSelect: e.target.value === 'radio'
                ? '1'
                : String(Math.max(
                  Number(value.maxSelect ?? 1),
                  Number(value.items?.length ?? 1),
                  Number(value.minSelect ?? 1),
                  2
                ))
            })}
          >
            <option value="">{lang === 'ar' ? 'اختر نوع الاختيار' : 'Choose selection type'}</option>
            <option value="checkbox">{lang === 'ar' ? 'مربعات اختيار' : 'Checkbox'}</option>
            <option value="radio">{lang === 'ar' ? 'اختيار واحد' : 'Radio'}</option>
          </select>
        </label>
        <label className="block space-y-2">
          <span className="block text-xs font-semibold text-white/60">
            {lang === 'ar' ? 'الحد الأدنى للاختيار' : 'Min select'}
          </span>
          <input
            type="number"
            min="0"
            disabled={value.selectionMode === 'radio'}
            className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/35"
            value={value.minSelect ?? 0}
            onChange={(e) => onChange({ ...value, minSelect: e.target.value })}
          />
        </label>
        <label className="block space-y-2">
          <span className="block text-xs font-semibold text-white/60">
            {lang === 'ar' ? 'الحد الأقصى للاختيار' : 'Max select'}
          </span>
          <input
            type="number"
            min="1"
            disabled={value.selectionMode === 'radio'}
            className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/35"
            value={value.maxSelect ?? 1}
            onChange={(e) => onChange({ ...value, maxSelect: e.target.value })}
          />
        </label>
        <label className="block space-y-2">
          <span className="block text-xs font-semibold text-white/60">
            {lang === 'ar' ? 'ترتيب الظهور' : 'Sort order'}
          </span>
          <input
            type="number"
            className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/35"
            value={value.sortOrder ?? 0}
            onChange={(e) => onChange({ ...value, sortOrder: e.target.value })}
          />
        </label>
      </div>

      <div className="mt-4">
        <SearchableDropdown products={products} selectedIds={selectedIds} onPick={addProduct} lang={lang} />
      </div>

      <div className="mt-4 space-y-3">
        {(value.items ?? []).map((item) => {
          const product = (Array.isArray(products) ? products : []).filter(Boolean).find((p) => String(p.id) === String(item.productId));
          return (
            <div key={item.productId} className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                  {product?.coverMediaUrl ? (
                    <img src={resolveMediaUrl(product.coverMediaUrl)} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-white">
                    {lang === 'ar' ? (product?.nameAr ?? product?.nameEn ?? '') : (product?.nameEn ?? product?.nameAr ?? '')}
                  </div>
                  <div className="text-xs text-white/50">
                    EGP {Number(product?.price ?? 0).toFixed(2)}
                  </div>
                  {Array.isArray(product?.customChoiceGroups) && product.customChoiceGroups.length ? (
                    <div className="mt-1 text-[11px] text-white/35">
                      {lang === 'ar' ? 'يحتوي على مجموعات اختيار داخلية' : 'Has internal choice groups'}
                    </div>
                  ) : null}
                  <div className="mt-1 text-[11px] text-white/35">
                    {lang === 'ar'
                      ? (value.selectionMode === 'radio' ? 'اختيار واحد' : 'مربعات اختيار')
                      : (value.selectionMode === 'radio' ? 'Single choice' : 'Multiple choices allowed')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.productId)}
                  className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20"
                >
                  {lang === 'ar' ? 'حذف' : 'Remove'}
                </button>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-white/60">
                    {lang === 'ar' ? 'السعر الإضافي' : 'Extra price'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none placeholder:text-white/35"
                    value={item.extraPrice ?? '0'}
                    onChange={(e) => updateItem(item.productId, { extraPrice: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-white/60">
                    {lang === 'ar' ? 'ترتيب العنصر' : 'Item order'}
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none placeholder:text-white/35"
                    value={item.sortOrder ?? 0}
                    onChange={(e) => updateItem(item.productId, { sortOrder: e.target.value })}
                  />
                </div>
                <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-white/75 md:col-span-2">
                  <input
                    type="checkbox"
                    checked={Boolean(item.includeProductOptions)}
                    onChange={(e) => updateItem(item.productId, { includeProductOptions: e.target.checked })}
                  />
                  {lang === 'ar' ? 'إظهار تفاصيل المنتج للعميل' : 'Show product details to customer'}
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function OfferBuilderForm({ value, products, onChange, onSubmit, onImageFile, lang = 'ar' }) {
  function addGroup() {
    onChange({
      ...value,
      groups: [
        ...(value.groups ?? []),
        {
          titleAr: '',
          selectionMode: '',
          minSelect: 0,
          maxSelect: 2,
          sortOrder: String(value.groups?.length ?? 0),
          required: false,
          items: []
        }
      ]
    });
  }

  function updateGroup(index, patch) {
    onChange({
      ...value,
      groups: (value.groups ?? []).map((group, i) => (i === index ? { ...group, ...patch } : group))
    });
  }

  function removeGroup(index) {
    onChange({
      ...value,
      groups: (value.groups ?? []).filter((_, i) => i !== index)
    });
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <section className="rounded-[28px] border border-white/10 bg-white/5 p-5">
        <h2 className="text-xl font-bold text-cream">
          {lang === 'ar' ? 'بيانات العرض الأساسية' : 'Offer basics'}
        </h2>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="block text-xs font-semibold text-white/60">
              {lang === 'ar' ? 'اسم العرض بالعربي' : 'Offer name in Arabic'}
            </span>
            <input
              className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/35"
              placeholder={lang === 'ar' ? 'مثال: عرض البيتزا' : 'Example: Pizza offer'}
              value={value.nameAr ?? ''}
              onChange={(e) => onChange({ ...value, nameAr: e.target.value })}
            />
          </label>
          <label className="block space-y-2">
            <span className="block text-xs font-semibold text-white/60">
              {lang === 'ar' ? 'وصف العرض' : 'Offer description'}
            </span>
            <input
              className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/35"
              placeholder={lang === 'ar' ? 'اكتب وصف العرض هنا' : 'Write the offer description here'}
              value={value.noteEn ?? ''}
              onChange={(e) => onChange({ ...value, noteEn: e.target.value })}
            />
          </label>
          <label className="block space-y-2">
            <span className="block text-xs font-semibold text-white/60">
              {lang === 'ar' ? 'السعر الإجمالي للعرض' : 'Total offer price'}
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/35"
              placeholder="0.00"
              value={value.totalPrice ?? ''}
              onChange={(e) => onChange({ ...value, totalPrice: e.target.value })}
            />
          </label>
          <label className="block space-y-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <span className="block text-xs font-semibold text-white/60">
              {lang === 'ar' ? 'صورة العرض' : 'Offer image'}
            </span>
            <input
              type="file"
              accept="image/png,image/webp,image/jpeg"
              className="block w-full text-sm text-white file:mr-3 file:rounded-xl file:border-0 file:bg-gold file:px-3 file:py-2 file:text-xs file:font-bold file:text-ink"
              onChange={(e) => onImageFile?.(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
          <div className="rounded-[22px] border border-dashed border-white/10 bg-black/20 p-4">
            {value.imageUrl ? (
              <img src={resolveMediaUrl(value.imageUrl)} alt="" className="h-[180px] w-full rounded-2xl object-cover" />
            ) : (
              <div className="flex h-[180px] items-center justify-center text-sm text-white/35">
                {lang === 'ar' ? 'معاينة الصورة' : 'Image preview'}
              </div>
            )}
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
              {lang === 'ar'
                ? 'سعر العرض مستقل تمامًا عن سعر المنتجات الأصلية.'
                : 'Offer price is fully independent from the original product prices.'}
            </div>
            <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white/75">
              <input
                type="checkbox"
                checked={Boolean(value.isActive)}
                onChange={(e) => onChange({ ...value, isActive: e.target.checked })}
              />
              {lang === 'ar' ? 'العرض فعال' : 'Offer active'}
            </label>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xl font-bold text-cream">
            {lang === 'ar' ? 'مجموعات العرض الديناميكية' : 'Dynamic groups'}
          </h3>
          <button type="button" onClick={addGroup} className="rounded-2xl bg-gold px-4 py-3 text-sm font-bold text-ink">
            {lang === 'ar' ? 'إضافة مجموعة جديدة' : 'Add group'}
          </button>
        </div>

        {(value.groups ?? []).map((group, index) => (
          <OfferGroupEditor
            key={index}
            value={group}
            products={products}
            onChange={(next) => updateGroup(index, next)}
            onDelete={() => removeGroup(index)}
            lang={lang}
          />
        ))}
      </section>

      <button type="submit" className="rounded-2xl bg-gold px-5 py-3 text-sm font-bold text-ink">
        {lang === 'ar' ? 'حفظ العرض' : 'Save offer'}
      </button>
    </form>
  );
}
