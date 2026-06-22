export function formatCurrency(amount) {
  return `EGP ${Number(amount ?? 0).toFixed(2)}`;
}

export function discountPercent(price, discountPrice) {
  if (!price || !discountPrice) return null;
  return Math.round((1 - Number(discountPrice) / Number(price)) * 100);
}
