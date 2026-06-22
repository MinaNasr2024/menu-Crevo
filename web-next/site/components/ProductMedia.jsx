import { getApiBase } from '../lib/api';

export function resolveMediaUrl(url) {
  if (!url) return '';
  if (String(url).startsWith('http://') || String(url).startsWith('https://') || String(url).startsWith('data:')) {
    return url;
  }
  return `${getApiBase()}${url}`;
}

export function ProductMedia({ product, className = '' }) {
  const mediaSrc = resolveMediaUrl(product.coverMediaUrl);
  if (!mediaSrc) {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 ${className}`}>
        <span className="text-xs font-semibold tracking-[0.25em] text-slate-400">المطعم</span>
      </div>
    );
  }
  if (product.mediaType === 'video') {
    return (
      <video
        className={`h-full w-full object-cover ${className}`}
        src={mediaSrc}
        autoPlay
        loop
        muted
        playsInline
        webkit-playsinline="true"
      />
    );
  }

  return <img className={`h-full w-full object-cover ${className}`} src={mediaSrc} alt="" loading="lazy" />;
}
