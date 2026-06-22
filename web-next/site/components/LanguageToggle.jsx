import { useLanguage } from '../context/LanguageContext';

export function LanguageToggle({ className = '' }) {
  const { lang, setLang } = useLanguage();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
      className={`rounded-full border border-[#3162ac]/40 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#10346f] transition hover:bg-white ${className}`}
    >
      {lang === 'ar' ? 'EN' : 'AR'}
    </button>
  );
}
