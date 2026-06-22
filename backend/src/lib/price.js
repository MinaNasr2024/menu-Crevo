export function toNumber(value) {
  if (value === null || value === undefined) return null;
  return Number(value);
}

export function currentPrice(product) {
  return product.isDiscounted && product.discountPrice != null ? Number(product.discountPrice) : Number(product.price);
}
