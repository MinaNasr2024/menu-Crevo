import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value) {
  if (value === true || value === false) return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
  }
  if (typeof value === 'number') return value !== 0;
  return Boolean(value);
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeProducts(rows = []) {
  return rows.map((row) => ({
    id: Number(row.id),
    nameAr: normalizeText(row.nameAr),
    nameEn: normalizeText(row.nameEn),
    price: toNumber(row.price),
    coverMediaUrl: normalizeText(row.coverMediaUrl),
    descriptionAr: normalizeText(row.descriptionAr),
    descriptionEn: normalizeText(row.descriptionEn),
    ingredients: Array.isArray(row.ingredients) ? row.ingredients : [],
    allergens: Array.isArray(row.allergens) ? row.allergens : [],
    customChoiceGroups: Array.isArray(row.customChoiceGroups) ? row.customChoiceGroups : [],
    calories: row.calories ?? null,
    averageWaitTime: row.averageWaitTime ?? null
  }));
}

function buildOfferGraph(offers = [], groups = [], items = []) {
  const groupMap = new Map();
  const productMap = new Map();

  for (const item of items) {
    const groupId = Number(item.groupId);
    const bucket = groupMap.get(groupId) ?? [];
    bucket.push({
      id: Number(item.id),
      groupId,
      productId: Number(item.productId),
      extraPrice: toNumber(item.extraPrice),
      includeProductOptions: toBoolean(item.includeProductOptions),
      sortOrder: Number(item.sortOrder ?? 0),
      product: {
        id: Number(item.productId),
        nameAr: normalizeText(item.nameAr),
        nameEn: normalizeText(item.nameEn),
        price: toNumber(item.productPrice),
        coverMediaUrl: normalizeText(item.coverMediaUrl),
        descriptionAr: normalizeText(item.descriptionAr),
        descriptionEn: normalizeText(item.descriptionEn),
        ingredients: Array.isArray(item.ingredients) ? item.ingredients : [],
        allergens: Array.isArray(item.allergens) ? item.allergens : [],
        customChoiceGroups: Array.isArray(item.customChoiceGroups) ? item.customChoiceGroups : [],
        calories: item.calories ?? null,
        averageWaitTime: item.averageWaitTime ?? null
      }
    });
    groupMap.set(groupId, bucket);
  }

  for (const group of groups) {
    const offerId = Number(group.offerId);
    const groupItems = groupMap.get(Number(group.id)) ?? [];
    const selectionMode = normalizeText(group.selectionMode) === 'radio' ? 'radio' : 'checkbox';
    const rawMaxSelect = Number(group.maxSelect ?? 0);
    const required = toBoolean(group.required);
    const maxSelect = selectionMode === 'radio'
      ? 1
      : Math.max(rawMaxSelect, groupItems.length > 1 ? groupItems.length : 1);
    const bucket = productMap.get(offerId) ?? [];
    bucket.push({
      id: Number(group.id),
      offerId,
      titleAr: normalizeText(group.titleAr),
      titleEn: normalizeText(group.titleEn),
      selectionMode,
      minSelect: selectionMode === 'radio' ? 1 : (required ? Math.max(1, Number(group.minSelect ?? 0)) : 0),
      maxSelect,
      sortOrder: Number(group.sortOrder ?? 0),
      required,
      items: groupItems
    });
    productMap.set(offerId, bucket);
  }

  return offers.map((offer) => ({
    id: Number(offer.id),
    nameAr: normalizeText(offer.nameAr),
    nameEn: normalizeText(offer.nameEn),
    noteAr: normalizeText(offer.noteAr),
    noteEn: normalizeText(offer.noteEn),
    totalPrice: toNumber(offer.totalPrice),
    imageUrl: normalizeText(offer.imageUrl),
    isActive: Boolean(offer.isActive),
    groups: (productMap.get(Number(offer.id)) ?? []).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
  }));
}

export async function listOffers({ activeOnly = false } = {}) {
  const filter = activeOnly ? Prisma.sql`WHERE o.is_active = true` : Prisma.empty;
  const offers = await prisma.$queryRaw`
    SELECT
      o.id,
      o.name_ar AS "nameAr",
      o.name_en AS "nameEn",
      o.note_ar AS "noteAr",
      o.note_en AS "noteEn",
      o.total_price AS "totalPrice",
      o.image_url AS "imageUrl",
      o.is_active AS "isActive",
      o.created_at AS "createdAt",
      o.updated_at AS "updatedAt"
    FROM offers o
    ${filter}
    ORDER BY o.id DESC
  `;
  if (!offers.length) return [];
  const offerIds = offers.map((offer) => Number(offer.id));
  const groups = await prisma.$queryRaw`
    SELECT
      og.id,
      og.offer_id AS "offerId",
      og.title_ar AS "titleAr",
      og.title_en AS "titleEn",
      og.selection_mode AS "selectionMode",
      og.min_select AS "minSelect",
      og.max_select AS "maxSelect",
      og.sort_order AS "sortOrder",
      og.required AS "required",
      og.created_at AS "createdAt",
      og.updated_at AS "updatedAt"
    FROM offer_groups og
    WHERE og.offer_id IN (${Prisma.join(offerIds)})
    ORDER BY og.sort_order ASC, og.id ASC
  `;
  const groupIds = groups.map((group) => Number(group.id));
  const items = groupIds.length
    ? await prisma.$queryRaw`
      SELECT
        ogp.id,
        ogp.group_id AS "groupId",
        ogp.product_id AS "productId",
        ogp.extra_price AS "extraPrice",
        ogp.include_product_options AS "includeProductOptions",
        ogp.sort_order AS "sortOrder",
        ogp.created_at AS "createdAt",
        ogp.updated_at AS "updatedAt",
        p.name_ar AS "nameAr",
        p.name_en AS "nameEn",
        p.price AS "productPrice",
        p.cover_media_url AS "coverMediaUrl",
        p.description_ar AS "descriptionAr",
        p.description_en AS "descriptionEn",
        p.ingredients AS "ingredients",
        p.allergens AS "allergens",
        p.custom_choice_groups AS "customChoiceGroups",
        p.calories AS "calories",
        p.average_wait_time AS "averageWaitTime"
      FROM offer_group_products ogp
      INNER JOIN products p ON p.id = ogp.product_id
      WHERE ogp.group_id IN (${Prisma.join(groupIds)})
      ORDER BY ogp.sort_order ASC, ogp.id ASC
    `
    : [];
  return buildOfferGraph(offers, groups, items);
}

export async function loadOffer(id) {
  const [offer] = await prisma.$queryRaw`
    SELECT
      o.id,
      o.name_ar AS "nameAr",
      o.name_en AS "nameEn",
      o.note_ar AS "noteAr",
      o.note_en AS "noteEn",
      o.total_price AS "totalPrice",
      o.image_url AS "imageUrl",
      o.is_active AS "isActive",
      o.created_at AS "createdAt",
      o.updated_at AS "updatedAt"
    FROM offers o
    WHERE o.id = ${Number(id)}
    LIMIT 1
  `;
  if (!offer) return null;
  const groups = await prisma.$queryRaw`
    SELECT
      og.id,
      og.offer_id AS "offerId",
      og.title_ar AS "titleAr",
      og.title_en AS "titleEn",
      og.selection_mode AS "selectionMode",
      og.min_select AS "minSelect",
      og.max_select AS "maxSelect",
      og.sort_order AS "sortOrder",
      og.required AS "required",
      og.created_at AS "createdAt",
      og.updated_at AS "updatedAt"
    FROM offer_groups og
    WHERE og.offer_id = ${Number(id)}
    ORDER BY og.sort_order ASC, og.id ASC
  `;
  const groupIds = groups.map((group) => Number(group.id));
  const items = groupIds.length
    ? await prisma.$queryRaw`
      SELECT
        ogp.id,
        ogp.group_id AS "groupId",
        ogp.product_id AS "productId",
        ogp.extra_price AS "extraPrice",
        ogp.include_product_options AS "includeProductOptions",
        ogp.sort_order AS "sortOrder",
        ogp.created_at AS "createdAt",
        ogp.updated_at AS "updatedAt",
        p.name_ar AS "nameAr",
        p.name_en AS "nameEn",
        p.price AS "productPrice",
        p.cover_media_url AS "coverMediaUrl",
        p.description_ar AS "descriptionAr",
        p.description_en AS "descriptionEn",
        p.ingredients AS "ingredients",
        p.allergens AS "allergens",
        p.custom_choice_groups AS "customChoiceGroups",
        p.calories AS "calories",
        p.average_wait_time AS "averageWaitTime"
      FROM offer_group_products ogp
      INNER JOIN products p ON p.id = ogp.product_id
      WHERE ogp.group_id IN (${Prisma.join(groupIds)})
      ORDER BY ogp.sort_order ASC, ogp.id ASC
    `
    : [];
  return buildOfferGraph([offer], groups, items)[0] ?? null;
}

export function validateOfferGraph(payload) {
  const errors = {};
  if (!normalizeText(payload?.nameAr)) errors.nameAr = ['Offer name in Arabic is required'];
  if (!normalizeText(payload?.nameEn)) errors.nameEn = ['Offer name in English is required'];
  if (!(Number(payload?.totalPrice) >= 0)) errors.totalPrice = ['Total offer price must be >= 0'];
  if (!Array.isArray(payload?.groups) || payload.groups.length === 0) {
    errors.groups = ['At least one group is required'];
  }
  return errors;
}

export function normalizeOfferSelection(input = {}) {
  const selections = Array.isArray(input.selections) ? input.selections : [];
  return selections.map((selection) => ({
    groupId: Number(selection.groupId),
    productIds: Array.isArray(selection.productIds) ? selection.productIds.map((id) => Number(id)).filter(Boolean) : []
  }));
}
