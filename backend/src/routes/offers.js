import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { sendOk, sendError } from '../lib/http.js';
import { emitDataChanged } from '../lib/realtime.js';
import { listOffers, loadOffer, normalizeOfferSelection } from '../lib/offers.js';

const offerItemSchema = z.object({
  productId: z.coerce.number().int().positive(),
  extraPrice: z.coerce.number().min(0).default(0),
  includeProductOptions: z.preprocess((value) => {
    if (value === true || value === false) return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
      if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
    }
    if (typeof value === 'number') return value !== 0;
    return Boolean(value);
  }, z.boolean().default(false)),
  sortOrder: z.coerce.number().int().default(0)
});

const offerGroupSchema = z.object({
  titleAr: z.string().optional().default(''),
  titleEn: z.string().optional().default(''),
  selectionMode: z.string().optional().default(''),
  minSelect: z.coerce.number().int().min(0),
  maxSelect: z.coerce.number().int().min(1),
  sortOrder: z.coerce.number().int().default(0),
  required: z.coerce.boolean().default(false),
  items: z.array(offerItemSchema).min(1)
}).refine((group) => group.maxSelect >= group.minSelect, {
  path: ['maxSelect'],
  message: 'maxSelect must be greater than or equal to minSelect'
});

const offerUpsertSchema = z.object({
  nameAr: z.string().min(1),
  nameEn: z.string().min(1),
  noteAr: z.string().optional().default(''),
  noteEn: z.string().optional().default(''),
  totalPrice: z.coerce.number().min(0),
  imageUrl: z.string().optional().default(''),
  isActive: z.coerce.boolean().default(true),
  groups: z.array(offerGroupSchema).min(1)
});

const offerSelectionSchema = z.object({
  selections: z.array(z.object({
    groupId: z.coerce.number().int().positive(),
    productIds: z.array(z.coerce.number().int().positive()).default([])
  })).default([])
});

function toFieldErrors(issues = []) {
  const fieldErrors = {};
  for (const issue of issues) {
    const key = issue.path?.[0] ?? 'form';
    fieldErrors[key] = fieldErrors[key] ?? [];
    fieldErrors[key].push(issue.message);
  }
  return { fieldErrors };
}

function validationResponse(fieldErrors) {
  return {
    success: false,
    error: {
      message: 'Validation failed',
      details: { fieldErrors }
    }
  };
}

async function ensureProductsExist(groups) {
  const ids = [...new Set(groups.flatMap((group) => group.items.map((item) => Number(item.productId))))];
  if (!ids.length) return true;
  const products = await prisma.$queryRaw`
    SELECT id
    FROM products
    WHERE id IN (${Prisma.join(ids.map((id) => Number(id)))})
  `;
  return products.length === ids.length;
}

function sumSelectedExtraPrice(group, selectedProductIds = []) {
  const selectedSet = new Set(selectedProductIds.map((id) => Number(id)));
  return group.items.reduce((sum, item) => (
    selectedSet.has(Number(item.productId)) ? sum + Number(item.extraPrice ?? 0) : sum
  ), 0);
}

function normalizeSelectionMode(value) {
  return String(value ?? '').trim() === 'radio' ? 'radio' : 'checkbox';
}

function normalizeBoolean(value) {
  if (value === true || value === false) return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
  }
  if (typeof value === 'number') return value !== 0;
  return Boolean(value);
}

async function replaceOfferGraph(tx, offerId, groups) {
  await tx.$executeRaw`
    DELETE FROM offer_groups
    WHERE offer_id = ${offerId}
  `;

  for (const [groupIndex, group] of groups.entries()) {
    const [createdGroup] = await tx.$queryRaw`
        INSERT INTO offer_groups (
        offer_id, title_ar, title_en, selection_mode, min_select, max_select, sort_order, required, created_at, updated_at
      ) VALUES (
        ${offerId},
        ${group.titleAr},
        ${String(group.titleEn ?? group.titleAr ?? '').trim() || group.titleAr},
        ${normalizeSelectionMode(group.selectionMode)},
        ${group.minSelect},
        ${group.maxSelect},
        ${group.sortOrder ?? groupIndex},
        ${normalizeBoolean(group.required)},
        NOW(),
        NOW()
      )
      RETURNING id
    `;

    for (const [itemIndex, item] of group.items.entries()) {
      await tx.$executeRaw`
        INSERT INTO offer_group_products (
          group_id, product_id, extra_price, include_product_options, sort_order, created_at, updated_at
        ) VALUES (
          ${Number(createdGroup.id)},
          ${item.productId},
          ${item.extraPrice},
          ${normalizeBoolean(item.includeProductOptions)},
          ${item.sortOrder ?? itemIndex},
          NOW(),
          NOW()
        )
      `;
    }
  }
}

async function validateOfferPayload(payload) {
  const parsed = offerUpsertSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: validationResponse(toFieldErrors(parsed.error.issues).fieldErrors) };
  }

  const data = {
    ...parsed.data,
    groups: parsed.data.groups.map((group, index) => ({
      ...group,
      titleAr: String(group.titleAr ?? '').trim() || `مجموعة ${index + 1}`,
      titleEn: String(group.titleEn ?? '').trim(),
      selectionMode: String(group.selectionMode ?? '').trim(),
      minSelect: String(group.selectionMode ?? '').trim() === 'radio'
        ? 1
        : (normalizeBoolean(group.required) ? Math.max(1, Number(group.minSelect)) : 0),
      maxSelect: String(group.selectionMode ?? '').trim() === 'radio'
        ? 1
        : Math.max(Number(group.maxSelect), normalizeBoolean(group.required) ? Math.max(1, Number(group.minSelect)) : 1),
      required: normalizeBoolean(group.required)
    }))
  };
  if (!data.groups.length) {
    return { ok: false, error: validationResponse({ groups: ['At least one group is required'] }) };
  }
  for (const [index, group] of data.groups.entries()) {
    if (group.selectionMode !== 'radio' && group.selectionMode !== 'checkbox') {
      return {
        ok: false,
        error: validationResponse({
          [`groups.${index}.selectionMode`]: ['Selection type is required']
        })
      };
    }
    const maxSelect = group.selectionMode === 'radio' ? 1 : Number(group.maxSelect);
    const minSelect = group.selectionMode === 'radio' ? 1 : Number(group.minSelect);
    if (minSelect > maxSelect) {
      return {
        ok: false,
        error: validationResponse({
          [`groups.${index}.maxSelect`]: ['Minimum selection cannot exceed maximum selection']
        })
      };
    }
  }
  const productsExist = await ensureProductsExist(data.groups);
  if (!productsExist) {
    return { ok: false, error: validationResponse({ groups: ['One or more selected products do not exist'] }) };
  }
  return { ok: true, data };
}

export const offersRouter = Router();

offersRouter.get('/', async (_req, res, next) => {
  try {
    sendOk(res, await listOffers());
  } catch (error) {
    next(error);
  }
});

offersRouter.get('/active', async (_req, res, next) => {
  try {
    sendOk(res, await listOffers({ activeOnly: true }));
  } catch (error) {
    next(error);
  }
});

offersRouter.post('/', async (req, res, next) => {
  try {
    const validated = await validateOfferPayload(req.body);
    if (!validated.ok) return res.status(422).json(validated.error);

    const data = validated.data;
    const created = await prisma.$transaction(async (tx) => {
      const [offer] = await tx.$queryRaw`
        INSERT INTO offers (
          name_ar, name_en, note_ar, note_en, total_price, image_url, is_active, created_at, updated_at
        ) VALUES (
          ${data.nameAr},
          ${data.nameEn},
          ${String(data.noteAr ?? '')},
          ${String(data.noteEn ?? '')},
          ${data.totalPrice},
          ${String(data.imageUrl ?? '')},
          ${Boolean(data.isActive)},
          NOW(),
          NOW()
        )
        RETURNING id
      `;
      await replaceOfferGraph(tx, Number(offer.id), data.groups);
      return offer.id;
    });

    emitDataChanged(req.app.get('io'), { entity: 'offers', action: 'create' });
    sendOk(res, await loadOffer(created));
  } catch (error) {
    next(error);
  }
});

offersRouter.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = await loadOffer(id);
    if (!existing) return sendError(res, 404, 'Offer not found');

    const validated = await validateOfferPayload(req.body);
    if (!validated.ok) return res.status(422).json(validated.error);

    const data = validated.data;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE offers
        SET name_ar = ${data.nameAr},
            name_en = ${data.nameEn},
            note_ar = ${String(data.noteAr ?? '')},
            note_en = ${String(data.noteEn ?? '')},
            total_price = ${data.totalPrice},
            image_url = ${String(data.imageUrl ?? '')},
            is_active = ${Boolean(data.isActive)},
            updated_at = NOW()
        WHERE id = ${id}
      `;
      await replaceOfferGraph(tx, id, data.groups);
    });

    emitDataChanged(req.app.get('io'), { entity: 'offers', action: 'update' });
    sendOk(res, await loadOffer(id));
  } catch (error) {
    next(error);
  }
});

offersRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = await loadOffer(id);
    if (!existing) return sendError(res, 404, 'Offer not found');
    await prisma.$executeRaw`
      DELETE FROM offers
      WHERE id = ${id}
    `;
    emitDataChanged(req.app.get('io'), { entity: 'offers', action: 'delete' });
    sendOk(res, { deleted: true });
  } catch (error) {
    next(error);
  }
});

offersRouter.post('/:id/validate-selection', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const offer = await loadOffer(id);
    if (!offer) return sendError(res, 404, 'Offer not found');
    const parsed = offerSelectionSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 422, 'Validation failed', toFieldErrors(parsed.error.issues));
    }

    const selectionMap = new Map(normalizeOfferSelection(parsed.data).map((item) => [Number(item.groupId), item.productIds]));
    const fieldErrors = {};
    let total = Number(offer.totalPrice);

    for (const group of offer.groups) {
      const selected = selectionMap.get(Number(group.id)) ?? [];
      const uniqueSelected = [...new Set(selected)];
      const selectionMode = normalizeSelectionMode(group.selectionMode);
      const minSelect = selectionMode === 'radio' ? 1 : Number(group.minSelect);
      const maxSelect = selectionMode === 'radio' ? 1 : Number(group.maxSelect);
      if (uniqueSelected.length < minSelect || uniqueSelected.length > maxSelect) {
        fieldErrors[`group_${group.id}`] = [`Select between ${group.minSelect} and ${group.maxSelect} items`];
        continue;
      }

      const allowed = new Map(group.items.map((item) => [Number(item.productId), item]));
      for (const productId of uniqueSelected) {
        const item = allowed.get(Number(productId));
        if (!item) {
          fieldErrors[`group_${group.id}`] = ['One or more selected products do not belong to this group'];
          break;
        }
        total += Number(item.extraPrice ?? 0);
      }
    }

    if (Object.keys(fieldErrors).length) {
      return sendError(res, 422, 'Validation failed', { fieldErrors });
    }

    sendOk(res, {
      offerId: offer.id,
      totalPrice: Number(total.toFixed(2))
    });
  } catch (error) {
    next(error);
  }
});
