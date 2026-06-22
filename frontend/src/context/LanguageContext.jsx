import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const LanguageContext = createContext(null);

function safePersistLang(lang) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('crevo-lang', lang);
    }
  } catch {
    // Ignore storage failures so the UI can still render.
  }
}

export function LanguageProvider({ children }) {
  try {
    if (typeof window !== 'undefined') {
      window.__crevoLanguageProviderRendered = true;
    }
  } catch {
    // Ignore debug failures.
  }

  const [lang, setLang] = useState('ar');

  useEffect(() => {
    safePersistLang(lang);
    document.documentElement.lang = lang === 'ar' ? 'ar' : 'en';
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang }), [lang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}
