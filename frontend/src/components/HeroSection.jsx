import { useEffect, useMemo, useState } from 'react';
import { resolveMediaUrl } from './ProductMedia';

function isVideoUrl(url = '') {
  const value = String(url).toLowerCase();
  return value.startsWith('data:video') || /\.(mp4|webm|mov|m4v)$/i.test(value);
}

function SocialGlyph({ type }) {
  const common = 'h-5 w-5 fill-current';
  switch (type) {
    case 'facebook':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={common}>
          <path d="M14 8.5V7c0-.8.2-1.5 1.5-1.5H18V2h-2.7C12.2 2 11 3.7 11 6.5V8H8v3h3v11h3v-11h2.9l.5-3H14z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={common}>
          <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3.2A4.8 4.8 0 1 1 7.2 12 4.8 4.8 0 0 1 12 7.2zm0 2A2.8 2.8 0 1 0 14.8 12 2.8 2.8 0 0 0 12 9.2zM17.4 6.6a1 1 0 1 0 1 1 1 1 0 0 0-1-1z" />
        </svg>
      );
    case 'snapchat':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={common}>
          <path d="M12 3c2.8 0 5 2.2 5 5v4.2c0 .6.2 1.1.7 1.5l1 .8c.5.4.2 1.2-.5 1.2h-1.5c-.4 0-.7.3-.7.7 0 1.1.9 2 2 2 .5 0 .8.6.5 1l-1.1 1.4c-.2.3-.6.5-1 .5-.6 0-1 .4-1.2.9-.2.7-.8 1.1-1.5 1.1h-3.4c-.7 0-1.3-.4-1.5-1.1-.2-.5-.6-.9-1.2-.9-.4 0-.8-.2-1-.5L6.8 20c-.3-.4 0-1 .5-1 1.1 0 2-.9 2-2 0-.4-.3-.7-.7-.7H7.1c-.7 0-1-.8-.5-1.2l1-.8c.5-.4.7-.9.7-1.5V8c0-2.8 2.2-5 5-5z" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={common}>
          <path d="M16.5 3c.4 2.2 1.7 4 3.5 5.1V12a8 8 0 1 1-8-8v3.2a4.8 4.8 0 1 0 4.8 4.8V3h-.3z" />
        </svg>
      );
    case 'youtube':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={common}>
          <path d="M21.8 7.2a3 3 0 0 0-2.1-2.1C18 4.7 12 4.7 12 4.7s-6 0-7.7.4a3 3 0 0 0-2.1 2.1A31.6 31.6 0 0 0 1.8 12a31.6 31.6 0 0 0 .4 4.8 3 3 0 0 0 2.1 2.1c1.7.4 7.7.4 7.7.4s6 0 7.7-.4a3 3 0 0 0 2.1-2.1A31.6 31.6 0 0 0 22.2 12a31.6 31.6 0 0 0-.4-4.8zM10 15.2V8.8l5.5 3.2L10 15.2z" />
        </svg>
      );
    default:
      return null;
  }
}

function PhoneGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M6.6 3.6c.5-.5 1.3-.5 1.8 0l2.1 2.1c.5.5.5 1.3 0 1.8l-1.2 1.2c-.3.3-.4.8-.2 1.2.6 1.2 1.6 2.5 3 3.9 1.4 1.4 2.7 2.4 3.9 3 .4.2.9.1 1.2-.2l1.2-1.2c.5-.5 1.3-.5 1.8 0l2.1 2.1c.5.5.5 1.3 0 1.8l-1 1c-.8.8-1.8 1.1-2.9 1-2.8-.2-6.1-2-9.8-5.7S3.6 10.7 3.4 7.9c-.1-1.1.2-2.1 1-2.9l1-1z" />
    </svg>
  );
}

export function HeroSection({ settings, language = 'ar' }) {
  const slides = useMemo(() => (settings?.heroSlides ?? []).filter(Boolean), [settings]);
  const socialLinks = useMemo(() => (settings?.socialLinks ?? {}), [settings]);
  const socialItems = useMemo(
    () => [
      { key: 'facebook', label: 'FB', href: socialLinks.facebook },
      { key: 'instagram', label: 'IG', href: socialLinks.instagram },
      { key: 'snapchat', label: 'SC', href: socialLinks.snapchat },
      { key: 'tiktok', label: 'TT', href: socialLinks.tiktok },
      { key: 'youtube', label: 'YT', href: socialLinks.youtube }
    ].filter((item) => String(item.href ?? '').trim()),
    [socialLinks]
  );
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const activeSlide = slides[index];
  const mediaUrl = resolveMediaUrl(activeSlide);
  const slideIsVideo = isVideoUrl(activeSlide);
  const restaurantName = (
    language === 'ar'
      ? settings?.restaurantNameAr?.trim() || settings?.restaurantNameEn?.trim() || settings?.restaurantName?.trim()
      : settings?.restaurantNameEn?.trim() || settings?.restaurantNameAr?.trim() || settings?.restaurantName?.trim()
  ) || 'اسم المطعم';

  return (
    <section className="relative z-20 overflow-visible rounded-[28px] bg-[var(--site-surface)] pb-[92px] shadow-[0_22px_70px_rgba(0,0,0,0.08)] md:pb-[0px]">
      <div className="relative overflow-visible rounded-[28px] h-[420px] w-full md:h-[520px]">
        <div className="relative h-full w-full overflow-hidden rounded-[28px]">
        {activeSlide ? (
          slideIsVideo ? (
            <video
              key={mediaUrl}
              className="h-full w-full object-cover object-center"
              src={mediaUrl}
              autoPlay
              loop
              muted
              playsInline
            />
          ) : (
            <img
              src={mediaUrl}
              alt="سلايدر المنيو"
              className="h-full w-full object-cover object-center"
            />
          )
        ) : (
          <div className="h-full w-full bg-gradient-to-b from-[#ececec] via-[#dddddd] to-[#c8c8c8]" />
        )}
        </div>

        <div className="absolute inset-x-0 bottom-[-90px] z-40 flex justify-center px-4 pb-6 md:bottom-[-90px] md:pb-8">
          <div className="site-card w-full max-w-[1300px] rounded-[32px] border bg-white px-5 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.14)] md:px-7 md:py-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-black/5 bg-white shadow-[0_10px_25px_rgba(0,0,0,0.12)]">
                  {settings?.logoUrl ? (
                    <img src={resolveMediaUrl(settings.logoUrl)} alt="شعار الموقع" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-base font-bold text-[#666]">BW</span>
                  )}
                </div>
                <div className="text-right">
                  <h2 className="site-heading text-[38px] font-black leading-none tracking-tight md:text-[54px]">
                    {restaurantName}
                  </h2>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {settings?.phone ? (
                  <a
                    href={`tel:${settings.phone}`}
                    className="flex h-11 items-center justify-center rounded-full border border-[var(--site-border)] bg-[var(--site-card)] px-3 text-sm font-semibold text-[var(--site-text)] shadow-sm transition hover:brightness-95"
                    aria-label="phone"
                  >
                    <PhoneGlyph />
                  </a>
                ) : null}
                {socialItems.length ? (
                  socialItems.map((item) => (
                    <a
                      key={item.key}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--site-border)] bg-[var(--site-card)] text-[var(--site-text)] shadow-sm transition hover:brightness-95"
                      aria-label={item.key}
                    >
                      <SocialGlyph type={item.key} />
                    </a>
                  ))
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {slides.length > 1 ? (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
            {slides.map((slide, slideIndex) => (
              <button
                key={`${slide}-${slideIndex}`}
                type="button"
                onClick={() => setIndex(slideIndex)}
                className={`h-2.5 rounded-full transition-all ${
                  slideIndex === index ? 'w-8 bg-white' : 'w-2.5 bg-white/65'
                }`}
                aria-label={`الشريحة ${slideIndex + 1}`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
