import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { useLanguage } from '../context/LanguageContext';
import { t } from '../lib/i18n';
import { getQrGatewayBase } from '../lib/api';
export function QRCodePanel({ table }) {
  const { lang } = useLanguage();
  const [url, setUrl] = useState('');
  const targetUrl = useMemo(() => (
    table
      ? new URL(`/qr/${table.qrCodeUuid}`, getQrGatewayBase()).toString()
      : ''
  ), [table]);

  useEffect(() => {
    let active = true;
    if (!targetUrl) {
      setUrl('');
      return undefined;
    }
    QRCode.toDataURL(targetUrl, { errorCorrectionLevel: 'H', margin: 1, scale: 14 })
      .then((dataUrl) => {
        if (active) setUrl(dataUrl);
      })
      .catch(() => {
        if (active) setUrl('');
      });
    return () => {
      active = false;
    };
  }, [targetUrl]);

  function download() {
    if (!table) return;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `table-${table.tableNumber}-qr.png`;
    anchor.click();
  }

  if (!table) return null;

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/40">{t(lang, 'tableQrCode')}</p>
          <h3 className="mt-2 text-lg font-bold">{lang === 'ar' ? `الطاولة ${table.tableNumber}` : `Table ${table.tableNumber}`}</h3>
        </div>
        <button type="button" onClick={download} className="rounded-2xl bg-gold px-4 py-2 text-sm font-bold text-ink">
          {t(lang, 'download')}
        </button>
      </div>
      <img className="mt-4 aspect-square w-full max-w-[280px] rounded-3xl bg-white p-3" src={url} alt={`QR code for table ${table.tableNumber}`} />
    </div>
  );
}
