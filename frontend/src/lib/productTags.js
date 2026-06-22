export const BUILTIN_PRODUCT_TAGS = [
  { id: 'new', labelAr: 'جديد', labelEn: 'New', color: '#ef4444' },
  { id: 'popular', labelAr: 'شائع', labelEn: 'Popular', color: '#f59e0b' },
  { id: 'hot', labelAr: 'حار', labelEn: 'Hot', color: '#f97316' },
  { id: 'offer', labelAr: 'عرض', labelEn: 'Offer', color: '#2563eb' },
  { id: 'cold', labelAr: 'بارد', labelEn: 'Cold', color: '#0ea5e9' }
];

export function getTagLabel(tag, lang = 'ar') {
  if (!tag) return '';
  return lang === 'ar'
    ? String(tag.labelAr ?? tag.labelEn ?? tag.label ?? '').trim()
    : String(tag.labelEn ?? tag.labelAr ?? tag.label ?? '').trim();
}

export function isBuiltinTag(tag) {
  return BUILTIN_PRODUCT_TAGS.some((builtin) => builtin.id === tag?.id);
}

export function tagDisplayId(tag) {
  return String(tag?.id ?? tag?.labelAr ?? tag?.labelEn ?? tag?.label ?? '').trim().toLowerCase().replace(/\s+/g, '-');
}

export function normalizeSelectedTags(tags) {
  return Array.isArray(tags) ? tags.filter(Boolean) : [];
}
