function hexToRgbTriplet(value, fallback = '215 164 57') {
  const hex = String(value ?? '').trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(hex)) return fallback;

  const expanded = hex.length === 3
    ? hex.split('').map((char) => char + char).join('')
    : hex;

  const numeric = Number.parseInt(expanded, 16);
  if (Number.isNaN(numeric)) return fallback;

  const red = (numeric >> 16) & 255;
  const green = (numeric >> 8) & 255;
  const blue = numeric & 255;
  return `${red} ${green} ${blue}`;
}

export function applySiteTheme(settings = {}) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const theme = settings.theme === 'dark' ? 'dark' : 'light';
  const buttonColor = String(settings.buttonColor ?? '#d7a439').trim() || '#d7a439';
  const headingColor = String(settings.headingColor ?? '#10172a').trim() || '#10172a';
  const headingFont = String(settings.headingFont ?? 'Tajawal').trim() || 'Tajawal';
  const bodyFont = String(settings.bodyFont ?? 'Tajawal').trim() || 'Tajawal';

  root.dataset.siteTheme = theme;
  root.style.setProperty('--site-button', buttonColor);
  root.style.setProperty('--site-button-rgb', hexToRgbTriplet(buttonColor));
  root.style.setProperty('--site-button-text', '#ffffff');
  root.style.setProperty('--site-heading-color', headingColor);
  root.style.setProperty('--site-body-font', bodyFont);
  root.style.setProperty('--site-heading-font', headingFont);
}
