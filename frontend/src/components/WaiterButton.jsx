import { useLanguage } from '../context/LanguageContext';
import { t } from '../lib/i18n';

export function WaiterButton({ verified, onRequest, className = '' }) {
  const { lang } = useLanguage();
  return (
    <button
      type="button"
      onClick={onRequest}
      disabled={!verified}
      className={`site-button rounded-full border px-5 py-3 text-sm font-bold text-[var(--site-button-text)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      style={{ borderColor: 'var(--site-border)' }}
    >
      {verified ? t(lang, 'requestWaiter') : t(lang, 'viewOnly')}
    </button>
  );
}
