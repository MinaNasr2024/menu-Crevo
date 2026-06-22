import { useLanguage } from '../context/LanguageContext';

export function CategoryRail({ categories, activeId, onSelect }) {
  const { lang } = useLanguage();

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`shrink-0 rounded-full px-4 py-2 text-sm transition ${activeId === null ? 'bg-gold text-ink' : 'bg-white/5 text-white/70'}`}
      >
        الكل
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onSelect(category.id)}
          className={`shrink-0 rounded-full px-4 py-2 text-sm transition ${activeId === category.id ? 'bg-gold text-ink' : 'bg-white/5 text-white/70'}`}
        >
          {lang === 'ar' ? category.nameAr : category.nameEn}
        </button>
      ))}
    </div>
  );
}
