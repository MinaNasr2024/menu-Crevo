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

const optionPalette = ['#d4af37', '#22c55e', '#38bdf8', '#f97316', '#a855f7', '#ef4444'];

function createOptionItem(index = 0) {
  return {
    id: `option-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    labelAr: '',
    labelEn: '',
    price: '0',
    required: false
  };
}

function createChoiceGroup(index = 0) {
  return {
    id: `choice-group-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    titleAr: '',
    titleEn: '',
    items: []
  };
}

function OptionGroupEditor({ title, hint, items = [], onChange, lang }) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);

  function updateItem(id, nextItem) {
    onChange(normalizedItems.map((item) => (item.id === id ? nextItem : item)));
  }

  function addItem() {
    const next = createOptionItem(normalizedItems.length);
    onChange([...normalizedItems, next]);
    setEditingId(next.id);
    setDraft({ ...next });
  }

  function removeItem(id) {
    onChange(normalizedItems.filter((item) => item.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setDraft(null);
    }
  }

  function startEdit(item) {
    setEditingId(item.id);
    setDraft({ ...item });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  function saveItem() {
    if (!draft) return;
    const nextItem = {
      ...draft,
      labelAr: String(draft.labelAr ?? '').trim(),
      labelEn: String(draft.labelEn ?? '').trim() || String(draft.labelAr ?? '').trim(),
      price: String(draft.price ?? '0').trim() || '0'
    };
    onChange(normalizedItems.map((item) => (item.id === nextItem.id ? nextItem : item)));
    setEditingId(null);
    setDraft(null);
  }

  const activeDraft = draft && editingId ? draft : null;

  return (
    <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {hint ? <p className="mt-1 text-xs text-white/45">{hint}</p> : null}
        </div>
        <button type="button" onClick={addItem} className="rounded-xl bg-gold px-3 py-2 text-xs font-bold text-ink">
          {lang === 'ar' ? 'إضافة' : 'Add'}
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {normalizedItems.length ? normalizedItems.map((item, index) => {
          const accent = optionPalette[index % optionPalette.length];
          const isEditing = editingId === item.id;
          return (
            <div
              key={item.id}
              className="rounded-[20px] border bg-black/25 p-3"
              style={{ borderColor: `${accent}55`, boxShadow: `inset 0 0 0 1px ${accent}22` }}
            >
              {isEditing ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                    <label className="block space-y-2">
                      <span className="block text-xs font-medium text-white/65">
                        {lang === 'ar' ? 'الاسم بالعربي' : 'Arabic name'}
                      </span>
                      <input
                        className={inputClass}
                        value={activeDraft?.labelAr ?? ''}
                        onChange={(event) => setDraft((current) => ({
                          ...current,
                          labelAr: event.target.value,
                          labelEn: current?.labelEn && current.labelEn !== current.labelAr ? current.labelEn : event.target.value
                        }))}
                        placeholder={lang === 'ar' ? 'مثال: كبير' : 'Example: Large'}
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="block text-xs font-medium text-white/65">
                        {lang === 'ar' ? 'السعر' : 'Price'}
                      </span>
                      <input
                        className={inputClass}
                        type="number"
                        step="0.01"
                        min="0"
                        value={activeDraft?.price ?? ''}
                        onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))}
                        placeholder="0.00"
                      />
                    </label>
                    <div className="flex items-end gap-2">
                      <button
                        type="button"
                        onClick={saveItem}
                        className="rounded-xl bg-gold px-3 py-3 text-xs font-bold text-ink"
                      >
                        {lang === 'ar' ? 'حفظ' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded-xl border border-white/15 px-3 py-3 text-xs font-semibold text-white transition hover:bg-white/5"
                      >
                        {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-white/40">
                    <span>{lang === 'ar' ? 'يمكنك تعديل الاسم والسعر ثم حفظ التغييرات.' : 'Edit the name and price, then save the changes.'}</span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="rounded-lg border border-red-400/20 px-3 py-1.5 text-[11px] font-semibold text-red-200 transition hover:bg-red-400/10"
                    >
                      {lang === 'ar' ? 'حذف' : 'Delete'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked readOnly />
                      <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: accent }}>
                        {lang === 'ar' ? item.labelAr : item.labelEn}
                      </span>
                    </label>
                    <div className="text-sm font-bold text-[var(--site-button)]">+ {item.price || '0.00'}</div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="text-[11px] text-white/40">
                      {lang === 'ar' ? 'اضغط تعديل لتغيير الاسم أو السعر.' : 'Press edit to change the name or price.'}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/5"
                      >
                        {lang === 'ar' ? 'تعديل' : 'Edit'}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="rounded-xl border border-red-400/20 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-400/10"
                      >
                        {lang === 'ar' ? 'حذف' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        }) : (
          <div className="rounded-[20px] border border-dashed border-white/10 px-4 py-8 text-center text-xs text-white/45">
            {lang === 'ar' ? 'لا توجد عناصر مضافة بعد' : 'No items added yet'}
          </div>
        )}
      </div>
    </div>
  );
}

function CustomChoiceGroupEditor({ title, hint, value, onChange, lang }) {
  const group = value ?? createChoiceGroup();
  const normalizedItems = Array.isArray(group.items) ? group.items : [];
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);

  function updateGroup(nextGroup) {
    onChange(nextGroup);
  }

  function setRequiredItem(itemId) {
    updateGroup({
      ...group,
      items: normalizedItems.map((item) => ({
        ...item,
        required: String(item.id) === String(itemId)
      }))
    });
  }

  function commitDraft(nextDraft) {
    if (!nextDraft) return;
    const nextGroup = {
      ...group,
      items: normalizedItems.map((item) => (item.id === nextDraft.id ? nextDraft : item))
    };
    updateGroup(nextGroup);
  }

  function updateItem(id, nextItem) {
    updateGroup({
      ...group,
      items: normalizedItems.map((item) => (item.id === id ? nextItem : item))
    });
  }

  function addItem() {
    const next = createOptionItem(normalizedItems.length);
    updateGroup({
      ...group,
      items: [...normalizedItems, next]
    });
    setEditingId(next.id);
    setDraft({ ...next });
  }

  function removeItem(id) {
    updateGroup({
      ...group,
      items: normalizedItems.filter((item) => item.id !== id)
    });
    if (editingId === id) {
      setEditingId(null);
      setDraft(null);
    }
  }

  function startEdit(item) {
    setEditingId(item.id);
    setDraft({ ...item });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  function saveItem() {
    if (!draft) return;
    const required = Boolean(
      draft.required ?? normalizedItems.find((item) => String(item.id) === String(draft.id))?.required ?? false
    );
    const nextItem = {
      ...draft,
      labelAr: String(draft.labelAr ?? '').trim(),
      labelEn: String(draft.labelEn ?? '').trim() || String(draft.labelAr ?? '').trim(),
      price: String(draft.price ?? '0').trim() || '0',
      required
    };
    updateGroup({
      ...group,
      items: normalizedItems.map((item) => (item.id === nextItem.id ? nextItem : item))
    });
    setEditingId(null);
    setDraft(null);
  }

  const activeDraft = draft && editingId ? draft : null;
  const titleAr = String(group.titleAr ?? '').trim();
  const titleEn = String(group.titleEn ?? '').trim();
  const isActive = Boolean(titleAr || titleEn);

  return (
    <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {hint ? <p className="mt-1 text-xs text-white/45">{hint}</p> : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="block text-xs font-medium text-white/65">
            {lang === 'ar' ? 'اسم الحقل بالعربي' : 'Field name in Arabic'}
          </span>
                      <input
                        className={inputClass}
                        value={group.titleAr ?? ''}
                        onChange={(event) => updateGroup({
                          ...group,
              titleAr: event.target.value,
              titleEn: String(group.titleEn ?? '').trim() || event.target.value
            })}
            placeholder={lang === 'ar' ? 'مثال: درجة الاستواء' : 'Example: Doneness'}
          />
        </label>
        <label className="block space-y-2">
          <span className="block text-xs font-medium text-white/65">
            {lang === 'ar' ? 'اسم الحقل بالإنجليزي' : 'Field name in English'}
          </span>
                      <input
                        className={inputClass}
                        value={group.titleEn ?? ''}
                        onChange={(event) => updateGroup({
                          ...group,
              titleEn: event.target.value,
              titleAr: String(group.titleAr ?? '').trim() || event.target.value
            })}
            placeholder={lang === 'ar' ? 'مثال: Doneness' : 'Example: Doneness'}
          />
        </label>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-white/45">
        <span>{lang === 'ar' ? 'لن يظهر للعميل إلا إذا كتبت اسم الحقل وأضفت عناصر.' : 'It will only appear to customers after you add a title and items.'}</span>
        <button
          type="button"
          onClick={addItem}
          disabled={!isActive}
          className="rounded-xl bg-gold px-3 py-2 text-xs font-bold text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {lang === 'ar' ? 'إضافة عنصر' : 'Add item'}
        </button>
      </div>

      {isActive ? (
        <div className="mt-4 space-y-3">
          {normalizedItems.length ? normalizedItems.map((item, index) => {
            const accent = optionPalette[index % optionPalette.length];
            const isEditing = editingId === item.id;
            return (
              <div
                key={item.id}
                className="rounded-[20px] border bg-black/25 p-3"
                style={{ borderColor: `${accent}55`, boxShadow: `inset 0 0 0 1px ${accent}22` }}
              >
                {isEditing ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                      <label className="block space-y-2">
                        <span className="block text-xs font-medium text-white/65">
                          {lang === 'ar' ? 'الاسم بالعربي' : 'Arabic name'}
                        </span>
                        <input
                          className={inputClass}
                          value={activeDraft?.labelAr ?? ''}
                          onChange={(event) => {
                            const nextDraft = {
                              ...(activeDraft ?? {}),
                              labelAr: event.target.value,
                              labelEn: activeDraft?.labelEn && activeDraft.labelEn !== activeDraft.labelAr ? activeDraft.labelEn : event.target.value
                            };
                            setDraft(nextDraft);
                            commitDraft(nextDraft);
                          }}
                          placeholder={lang === 'ar' ? 'مثال: متوسط' : 'Example: Medium'}
                        />
                      </label>
                      <label className="block space-y-2">
                        <span className="block text-xs font-medium text-white/65">
                          {lang === 'ar' ? 'السعر' : 'Price'}
                        </span>
                        <input
                          className={inputClass}
                          type="number"
                          step="0.01"
                          min="0"
                          value={activeDraft?.price ?? ''}
                          onChange={(event) => {
                            const nextDraft = { ...(activeDraft ?? {}), price: event.target.value };
                            setDraft(nextDraft);
                            commitDraft(nextDraft);
                          }}
                          placeholder="0.00"
                        />
                      </label>
                      <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-xs font-medium text-white/75">
                        <input
                          type="radio"
                          checked={Boolean(activeDraft?.required)}
                          onChange={() => {
                            const nextDraft = { ...(activeDraft ?? {}), required: true };
                            setDraft(nextDraft);
                            commitDraft(nextDraft);
                          }}
                        />
                        {lang === 'ar' ? 'مطلوب' : 'Required'}
                      </label>
                      <div className="flex items-end gap-2">
                        <button
                          type="button"
                          onClick={saveItem}
                          className="rounded-xl bg-gold px-3 py-3 text-xs font-bold text-ink"
                        >
                          {lang === 'ar' ? 'حفظ' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="rounded-xl border border-white/15 px-3 py-3 text-xs font-semibold text-white transition hover:bg-white/5"
                        >
                          {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-white/40">
                      <span>{lang === 'ar' ? 'يمكنك تعديل الاسم والسعر ثم حفظ التغييرات.' : 'Edit the name and price, then save the changes.'}</span>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="rounded-lg border border-red-400/20 px-3 py-1.5 text-[11px] font-semibold text-red-200 transition hover:bg-red-400/10"
                      >
                        {lang === 'ar' ? 'حذف' : 'Delete'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-3">
                        <input
                          type="radio"
                          checked={Boolean(item.required)}
                          onChange={() => {
                            const nextDraft = { ...item, required: true };
                            updateGroup({
                              ...group,
                              items: normalizedItems.map((candidate) => ({
                                ...candidate,
                                required: String(candidate.id) === String(item.id)
                              }))
                            });
                            if (editingId === item.id) {
                              setDraft(nextDraft);
                            }
                          }}
                        />
                        <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: accent }}>
                          {lang === 'ar' ? item.labelAr : item.labelEn}
                        </span>
                      </label>
                      <div className="flex items-center gap-2">
                        {item.required ? (
                          <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-semibold text-emerald-200">
                            {lang === 'ar' ? 'مطلوب' : 'Required'}
                          </span>
                        ) : null}
                        <div className="text-sm font-bold text-[var(--site-button)]">+ {item.price || '0.00'}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="text-[11px] text-white/40">
                        {lang === 'ar' ? 'اضغط تعديل لتغيير الاسم أو السعر.' : 'Press edit to change the name or price.'}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/5"
                        >
                          {lang === 'ar' ? 'تعديل' : 'Edit'}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="rounded-xl border border-red-400/20 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-400/10"
                        >
                          {lang === 'ar' ? 'حذف' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          }) : (
            <div className="rounded-[20px] border border-dashed border-white/10 px-4 py-8 text-center text-xs text-white/45">
              {lang === 'ar' ? 'لا توجد عناصر مضافة بعد' : 'No items added yet'}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-[20px] border border-dashed border-white/10 px-4 py-8 text-center text-xs text-white/45">
          {lang === 'ar' ? 'اكتب اسم الحقل لبدء إضافة العناصر.' : 'Add a field title to start adding items.'}
        </div>
      )}
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

      <div className="grid gap-4">
        <Field label={t(lang, 'productNameAr')} required error={errors.nameAr}>
          <input
            className={inputClass}
            placeholder={lang === 'ar' ? 'مثال: برجر' : 'Example: Burger'}
            value={value.nameAr}
            onChange={(e) => onChange({ ...value, nameAr: e.target.value })}
          />
        </Field>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Field label={t(lang, 'descriptionAr')}>
          <textarea
            className={`${inputClass} min-h-28`}
            placeholder={lang === 'ar' ? 'وصف الصنف...' : 'Product description...'}
            value={value.descriptionAr}
            onChange={(e) => onChange({ ...value, descriptionAr: e.target.value })}
          />
        </Field>
        <Field
          label={lang === 'ar' ? 'المكونات' : 'Ingredients'}
          hint={lang === 'ar' ? 'اكتب المكونات مفصولة بفواصل.' : 'Write ingredients separated by commas.'}
        >
          <textarea
            className={`${inputClass} min-h-28`}
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
          <div className="mt-3 grid grid-cols-[repeat(auto-fill,150px)] gap-3 justify-start">
            {galleryItems.length ? galleryItems.map((item) => (
              <div key={item} className="relative h-[150px] w-[150px] overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                <div className="h-full w-full">
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
            accept="image/png,image/webp,image/jpeg,video/*"
            onChange={(e) => onCoverFile?.(e.target.files?.[0] ?? null)}
          />
        </Field>
        <Field label={t(lang, 'uploadGalleryFiles')}>
          <input
            className="block w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-gold file:px-4 file:py-2 file:text-sm file:font-bold file:text-ink"
            type="file"
            accept="image/png,image/webp,image/jpeg,video/*"
            multiple
            onChange={(e) => onGalleryFiles?.(Array.from(e.target.files ?? []))}
          />
        </Field>
      </div>

      <div className="grid gap-3 xl:grid-cols-5">
        <Field label={t(lang, 'price')} required error={errors.price}>
          <input
            className={`${inputClass} text-sm`}
            placeholder="0.00"
            value={value.price}
            onChange={(e) => onChange({ ...value, price: e.target.value })}
          />
        </Field>
        <Field label={t(lang, 'discountPrice')}>
          <input
            className={`${inputClass} text-sm`}
            placeholder="0.00"
            value={value.discountPrice}
            onChange={(e) => onChange({ ...value, discountPrice: e.target.value })}
          />
        </Field>
        <Field label={lang === 'ar' ? 'متوسط الانتظار' : 'Average wait time'}>
          <input
            className={`${inputClass} text-sm`}
            placeholder={lang === 'ar' ? '10' : '10'}
            value={value.averageWaitTime ?? ''}
            onChange={(e) => onChange({ ...value, averageWaitTime: e.target.value })}
          />
        </Field>
        <Field label={lang === 'ar' ? 'السعرات' : 'Calories'}>
          <input
            className={`${inputClass} text-sm`}
            placeholder="650"
            value={value.calories}
            onChange={(e) => onChange({ ...value, calories: e.target.value })}
          />
        </Field>
        <Field label={t(lang, 'sortOrder')}>
          <input
            className={`${inputClass} text-sm`}
            placeholder="0"
            value={value.sortOrder}
            onChange={(e) => onChange({ ...value, sortOrder: e.target.value })}
          />
        </Field>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
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
        <Field label={lang === 'ar' ? 'مسببات الحساسية' : 'Allergens'} hint={lang === 'ar' ? 'اكتب العناصر مفصولة بفواصل.' : 'Write items separated by commas.'}>
          <textarea
            className={`${inputClass} min-h-14`}
            placeholder={lang === 'ar' ? 'حليب، جلوتين، مكسرات' : 'Milk, gluten, nuts'}
            value={value.allergens}
            onChange={(e) => onChange({ ...value, allergens: e.target.value })}
          />
        </Field>
      </div>

      <div className="grid gap-4">
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
          <div className="mb-3 text-sm font-medium text-white/75">{lang === 'ar' ? 'عرض المنتج' : 'Product visibility'}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75">
              <input
                type="radio"
                name="featured-mode"
                checked={!value.isFeatured}
                onChange={() => onChange({ ...value, isFeatured: false })}
              />
              {lang === 'ar' ? 'عادي' : 'Normal'}
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75">
              <input
                type="radio"
                name="featured-mode"
                checked={Boolean(value.isFeatured)}
                onChange={() => onChange({ ...value, isFeatured: true })}
              />
              {lang === 'ar' ? 'إظهار في أول الصفحة / Slider مميز' : 'Show in featured top slider'}
            </label>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <OptionGroupEditor
          title={lang === 'ar' ? 'الأحجام' : 'Sizes'}
          hint={lang === 'ar' ? 'كل حجم له سعر إضافي أو سعر خاص.' : 'Each size can change the final price.'}
          items={Array.isArray(value.sizeOptions) ? value.sizeOptions : []}
          onChange={(next) => onChange({ ...value, sizeOptions: next })}
          lang={lang}
        />

        <OptionGroupEditor
          title={lang === 'ar' ? 'الأطباق الإضافية' : 'Side dishes'}
          hint={lang === 'ar' ? 'يمكن إضافة أكثر من طبق إضافي.' : 'You can add multiple extra dishes.'}
          items={Array.isArray(value.sideDishOptions) ? value.sideDishOptions : []}
          onChange={(next) => onChange({ ...value, sideDishOptions: next })}
          lang={lang}
        />

        <OptionGroupEditor
          title={lang === 'ar' ? 'الإضافات' : 'Add-ons'}
          hint={lang === 'ar' ? 'هذه الإضافات تُحتسب على السعر الأصلي.' : 'These add-ons are added to the base price.'}
          items={Array.isArray(value.addonOptions) ? value.addonOptions : []}
          onChange={(next) => onChange({ ...value, addonOptions: next })}
          lang={lang}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <CustomChoiceGroupEditor
          title={lang === 'ar' ? 'حقل اختياري 1' : 'Custom choice field 1'}
          hint={lang === 'ar' ? 'يظهر للعميل فقط عند كتابة اسم الحقل وإضافة عناصر.' : 'Shown only when the field has a title and items.'}
          value={Array.isArray(value.customChoiceGroups) ? value.customChoiceGroups[0] : null}
          onChange={(next) => onChange({
            ...value,
            customChoiceGroups: [
              next,
              Array.isArray(value.customChoiceGroups) ? value.customChoiceGroups[1] ?? createChoiceGroup(1) : createChoiceGroup(1)
            ]
          })}
          lang={lang}
        />
        <CustomChoiceGroupEditor
          title={lang === 'ar' ? 'حقل اختياري 2' : 'Custom choice field 2'}
          hint={lang === 'ar' ? 'يمكنك تركه فارغًا، ولن يظهر للعميل.' : 'You can leave it empty and it will not appear to customers.'}
          value={Array.isArray(value.customChoiceGroups) ? value.customChoiceGroups[1] : null}
          onChange={(next) => onChange({
            ...value,
            customChoiceGroups: [
              Array.isArray(value.customChoiceGroups) ? value.customChoiceGroups[0] ?? createChoiceGroup(0) : createChoiceGroup(0),
              next
            ]
          })}
          lang={lang}
        />
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

