import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { sendOk, sendError } from '../lib/http.js';
import {
  analyticsRangeSchema,
  categoryUpsertSchema,
  employeeCreateSchema,
  employeeUpdateSchema,
  productUpsertSchema,
  qrCreateSchema,
  qrUpdateSchema,
  reportScheduleSchema,
  uploadSchema,
  waiterComplaintSchema
} from '../lib/validators.js';
import { createQrUuid } from '../lib/qr.js';
import { saveDataUrl } from '../lib/upload.js';
import { getPeakOrderingHours, getRevenueAnalytics, getTopSellingProducts } from '../lib/analytics.js';
import { hashPassword } from '../lib/password.js';
import { emitDataChanged } from '../lib/realtime.js';
import { loadVipCustomers, loadVipInvoiceDiscount, resetVipCycleByPhone } from '../lib/vip.js';

const DEFAULT_MEDIA_URL = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><rect width="1200" height="900" fill="%23111219"/><rect x="80" y="80" width="1040" height="740" rx="44" fill="%23181b24" stroke="%23d4af37" stroke-width="6"/><text x="600" y="430" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" fill="%23ffffff">Crevo</text><text x="600" y="500" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="%23cfcfcf">Add product media</text></svg>';

function normalizePeriodRange(query) {
  const parsed = analyticsRangeSchema.parse(query);
  const to = parsed.to ? new Date(parsed.to) : new Date();
  const from = parsed.from ? new Date(parsed.from) : new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
  const bucket = parsed.bucket ?? 'day';
  return { from, to, bucket };
}

function normalizeEmployeeRole(role) {
  return role === 'seller' ? 'cashier' : role;
}

function normalizeAuthRole(role) {
  return role === 'cashier' ? 'seller' : role;
}

function canAccessAdminRoute(role, req) {
  const normalizedRole = normalizeAuthRole(role);
  if (normalizedRole === 'admin') return true;

  const cleanPath = String(req?.path ?? '').replace(/\/+$/, '') || '/';
  const routePath = String(req?.originalUrl ?? cleanPath)
    .split('?')[0]
    .replace(/^\/api\/admin/, '')
    .replace(/\/+$/, '') || cleanPath;
  const isSellerOrderArea = (
    routePath === '/orders' ||
    routePath.startsWith('/orders/') ||
    routePath.startsWith('/order-items/')
  );

  if (normalizedRole === 'seller') {
    return isSellerOrderArea;
  }

  if (normalizedRole === 'waiter') {
    return routePath.includes('waiter-complaints');
  }

  if (normalizedRole === 'manager') {
    return (
      routePath === '/dashboard/summary' ||
      routePath === '/branches' ||
      routePath === '/categories' ||
      routePath.startsWith('/categories/') ||
      routePath === '/products' ||
      routePath.startsWith('/products/') ||
      routePath === '/offers' ||
      routePath.startsWith('/offers/') ||
      routePath === '/orders' ||
      routePath === '/orders/previous' ||
      routePath.startsWith('/orders/') ||
      routePath.startsWith('/order-items/') ||
      routePath === '/tables' ||
      routePath.startsWith('/tables/') ||
      routePath === '/vip-customers' ||
      routePath === '/vip-customers/reset' ||
      routePath === '/vip-summary' ||
      routePath.includes('waiter-complaints') ||
      routePath === '/admin/qr' ||
      routePath.startsWith('/admin/qr/')
    );
  }

  return false;
}

function selectProductColumns() {
  return prisma.$queryRaw`
    SELECT
      id,
      category_id AS "categoryId",
      scope,
      name_ar AS "nameAr",
      name_en AS "nameEn",
      description_ar AS "descriptionAr",
      description_en AS "descriptionEn",
      media_type AS "mediaType",
      cover_media_url AS "coverMediaUrl",
      gallery_urls AS "galleryUrls",
      ingredients,
      tags,
      allergens,
      size_options AS "sizeOptions",
      side_dish_options AS "sideDishOptions",
      addon_options AS "addonOptions",
      custom_choice_groups AS "customChoiceGroups",
      price,
      calories,
      average_wait_time AS "averageWaitTime",
      is_discounted AS "isDiscounted",
      discount_price AS "discountPrice",
      is_available AS "isAvailable",
      is_featured AS "isFeatured",
      sort_order AS "sortOrder"
    FROM products
    ORDER BY sort_order ASC, id ASC
  `;
}

function selectProductById(id) {
  return prisma.$queryRaw`
    SELECT
      id,
      category_id AS "categoryId",
      scope,
      name_ar AS "nameAr",
      name_en AS "nameEn",
      description_ar AS "descriptionAr",
      description_en AS "descriptionEn",
      media_type AS "mediaType",
      cover_media_url AS "coverMediaUrl",
      gallery_urls AS "galleryUrls",
      ingredients,
      tags,
      allergens,
      size_options AS "sizeOptions",
      side_dish_options AS "sideDishOptions",
      addon_options AS "addonOptions",
      custom_choice_groups AS "customChoiceGroups",
      price,
      calories,
      average_wait_time AS "averageWaitTime",
      is_discounted AS "isDiscounted",
      discount_price AS "discountPrice",
      is_available AS "isAvailable",
      is_featured AS "isFeatured",
      sort_order AS "sortOrder"
    FROM products
    WHERE id = ${id}
    LIMIT 1
  `;
}

function selectCategoryColumns(scope) {
  return prisma.$queryRaw`
    SELECT
      id,
      name_ar AS "nameAr",
      name_en AS "nameEn",
      sort_order AS "sortOrder",
      is_active AS "isActive",
      scope
    FROM categories
    WHERE scope = ${scope}::"MenuScope"
    ORDER BY sort_order ASC, id ASC
  `;
}

function selectCategoryById(id) {
  return prisma.$queryRaw`
    SELECT
      id,
      name_ar AS "nameAr",
      name_en AS "nameEn",
      sort_order AS "sortOrder",
      is_active AS "isActive",
      scope
    FROM categories
    WHERE id = ${id}
    LIMIT 1
  `;
}

function normalizeOptionList(list) {
  return Array.isArray(list)
    ? list.map((item, index) => ({
      id: String(item?.id ?? `item-${index + 1}`),
      labelAr: String(item?.labelAr ?? item?.label ?? '').trim(),
      labelEn: String(item?.labelEn ?? item?.label ?? '').trim(),
      price: String(item?.price ?? '0'),
      required: Boolean(item?.required)
    })).filter((item) => item.labelAr || item.labelEn)
    : [];
}

function normalizeChoiceGroups(list) {
  return Array.isArray(list)
    ? list.map((group, index) => {
      const items = normalizeOptionList(group?.items);
      const titleAr = String(group?.titleAr ?? group?.labelAr ?? '').trim();
      const titleEn = String(group?.titleEn ?? group?.labelEn ?? titleAr ?? '').trim() || titleAr;
      if (!titleAr && !titleEn) return null;
      return {
        id: String(group?.id ?? `choice-group-${index + 1}`),
        titleAr,
        titleEn,
        items
      };
    }).filter(Boolean)
    : [];
}

function resolveChoiceGroupsPayload(payload) {
  return payload.customChoiceGroups
    ?? payload.choiceGroups
    ?? payload.customChoiceFields
    ?? payload.optionGroups
    ?? null;
}

function normalizeScope(scope) {
  return scope === 'studio' ? 'studio' : 'menu';
}

export const adminRouter = Router();

adminRouter.use((req, res, next) => {
  if (canAccessAdminRoute(req.auth?.role, req)) {
    return next();
  }
  return sendError(res, 403, 'Permission denied');
});

async function logAudit(action, entityType, entityId, oldValues = null, newValues = null) {
  await prisma.auditLog.create({
    data: {
      action,
      entityType,
      entityId: String(entityId),
      actorType: 'system',
      oldValues: oldValues ? JSON.parse(JSON.stringify(oldValues)) : null,
      newValues: newValues ? JSON.parse(JSON.stringify(newValues)) : null
    }
  });
}

adminRouter.get('/dashboard/summary', async (_req, res, next) => {
  try {
    const [categories, products, tables, calls, orders] = await Promise.all([
      prisma.category.count(),
      prisma.product.count(),
      prisma.table.count(),
      prisma.waiterCall.count({ where: { status: 'pending' } }),
      prisma.order.count()
    ]);
    const [{ pendingInvoices }] = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS "pendingInvoices"
      FROM tables
      WHERE invoice_requested_at IS NOT NULL
    `;
    sendOk(res, { categories, products, tables, pendingCalls: calls, pendingInvoices, orders });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/branches', async (_req, res, next) => {
  try {
    const branches = await prisma.branch.findMany({ orderBy: [{ id: 'asc' }] });
    sendOk(res, branches);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/categories', async (_req, res, next) => {
  try {
    const scope = normalizeScope(_req.query?.scope);
    const categories = await selectCategoryColumns(scope);
    sendOk(res, categories);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/categories', async (req, res, next) => {
  try {
    const payload = categoryUpsertSchema.parse(req.body);
    const nameAr = String(payload.nameAr ?? '').trim();
    const nameEn = String(payload.nameEn ?? '').trim();
    const [category] = await prisma.$queryRaw`
      INSERT INTO categories (
        name_ar,
        name_en,
        sort_order,
        is_active,
        scope
      ) VALUES (
        ${nameAr || nameEn || 'قسم جديد'},
        ${nameEn || nameAr || 'New Category'},
        ${payload.sortOrder ?? 0},
        ${payload.isActive ?? true},
        ${normalizeScope(payload.scope)}::"MenuScope"
      )
      RETURNING
        id,
        name_ar AS "nameAr",
        name_en AS "nameEn",
        sort_order AS "sortOrder",
        is_active AS "isActive",
        scope
    `;
    await logAudit('create', 'Category', category.id, null, category);
    emitDataChanged(req.app.get('io'), { entity: 'category', action: 'create' });
    sendOk(res, category);
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/categories/:id', async (req, res, next) => {
  try {
    const payload = categoryUpsertSchema.partial().parse(req.body);
    const id = Number(req.params.id);
    const [before] = await selectCategoryById(id);
    const nameAr = payload.nameAr !== undefined ? String(payload.nameAr ?? '').trim() : undefined;
    const nameEn = payload.nameEn !== undefined ? String(payload.nameEn ?? '').trim() : undefined;
    await prisma.$executeRaw`
      UPDATE categories
      SET
        name_ar = COALESCE(${nameAr ?? null}, name_ar),
        name_en = COALESCE(${nameEn ?? null}, name_en),
        sort_order = COALESCE(${payload.sortOrder ?? null}, sort_order),
        is_active = COALESCE(${payload.isActive ?? null}, is_active),
        scope = COALESCE(${payload.scope ? normalizeScope(payload.scope) : null}::"MenuScope", scope)
      WHERE id = ${id}
    `;
    const [category] = await selectCategoryById(id);
    await logAudit('update', 'Category', id, before, category);
    emitDataChanged(req.app.get('io'), { entity: 'category', action: 'update' });
    sendOk(res, category);
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/categories/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [before] = await selectCategoryById(id);
    const dependentProducts = await prisma.product.count({ where: { categoryId: id } });
    if (dependentProducts > 0) {
      return sendError(res, 409, 'There are products linked to this category', {
        dependentProducts,
        categoryId: id
      });
    }
    await prisma.$executeRaw`DELETE FROM categories WHERE id = ${id}`;
    await logAudit('delete', 'Category', id, before, null);
    emitDataChanged(req.app.get('io'), { entity: 'category', action: 'delete' });
    sendOk(res, true);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/categories/:id/transfer-products', async (req, res, next) => {
  try {
    const sourceId = Number(req.params.id);
    const targetId = Number(req.body?.targetCategoryId);
    if (!Number.isInteger(targetId)) {
      return sendError(res, 400, 'Target category is required');
    }
    if (sourceId === targetId) {
      return sendError(res, 400, 'Target category must be different from source');
    }

    const [sourceCategory] = await selectCategoryById(sourceId);
    const [targetCategory] = await selectCategoryById(targetId);
    if (!sourceCategory || !targetCategory) {
      return sendError(res, 404, 'Category not found');
    }
    if (String(sourceCategory.scope) !== String(targetCategory.scope)) {
      return sendError(res, 400, 'Categories must belong to the same menu scope');
    }

    const affectedProducts = await prisma.product.findMany({
      where: { categoryId: sourceId },
      select: { id: true, categoryId: true, scope: true, nameAr: true, nameEn: true }
    });
    const [beforeCategory] = await selectCategoryById(sourceId);

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE products
        SET category_id = ${targetId}
        WHERE category_id = ${sourceId}
      `;
      await tx.$executeRaw`
        DELETE FROM categories
        WHERE id = ${sourceId}
      `;
    });

    await logAudit('update', 'CategoryProducts', `${sourceId}->${targetId}`, {
      category: beforeCategory,
      products: affectedProducts
    }, {
      sourceCategoryId: sourceId,
      targetCategoryId: targetId,
      deletedSourceCategory: true
    });
    emitDataChanged(req.app.get('io'), { entity: 'category', action: 'transfer-products' });

    sendOk(res, true);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/products', async (_req, res, next) => {
  try {
    const scope = normalizeScope(_req.query?.scope);
    const products = await prisma.$queryRaw`
      SELECT
        id,
        category_id AS "categoryId",
        scope,
        name_ar AS "nameAr",
        name_en AS "nameEn",
        description_ar AS "descriptionAr",
        description_en AS "descriptionEn",
        media_type AS "mediaType",
        cover_media_url AS "coverMediaUrl",
        gallery_urls AS "galleryUrls",
        ingredients,
        tags,
        allergens,
        size_options AS "sizeOptions",
        side_dish_options AS "sideDishOptions",
        addon_options AS "addonOptions",
        custom_choice_groups AS "customChoiceGroups",
        price,
        calories,
        average_wait_time AS "averageWaitTime",
        is_discounted AS "isDiscounted",
        discount_price AS "discountPrice",
        is_available AS "isAvailable",
        is_featured AS "isFeatured",
        sort_order AS "sortOrder"
      FROM products
      WHERE scope = ${scope}::"MenuScope"
      ORDER BY sort_order ASC, id ASC
    `;
    sendOk(res, products);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/products', async (req, res, next) => {
  try {
    const payload = productUpsertSchema.parse(req.body);
    const nameAr = String(payload.nameAr ?? '').trim();
    const nameEn = String(payload.nameEn ?? '').trim();
    const coverInput = String(payload.coverMediaUrl ?? '').trim();
    const coverMediaUrl = coverInput.startsWith('data:')
      ? (await saveDataUrl(coverInput)).url
      : (coverInput || DEFAULT_MEDIA_URL);
    const galleryUrls = await Promise.all((payload.galleryUrls ?? []).map(async (item) => {
      if (String(item).startsWith('data:')) {
        return (await saveDataUrl(item)).url;
      }
      return item;
    }));
    const sizeOptions = normalizeOptionList(payload.sizeOptions);
    const sideDishOptions = normalizeOptionList(payload.sideDishOptions);
    const addonOptions = normalizeOptionList(payload.addonOptions);
    const customChoiceGroups = normalizeChoiceGroups(resolveChoiceGroupsPayload(payload));
    const [createdProduct] = await prisma.$queryRaw`
      INSERT INTO products (
        category_id,
        scope,
        name_ar,
        name_en,
        description_ar,
        description_en,
        media_type,
        cover_media_url,
        gallery_urls,
        ingredients,
        tags,
        allergens,
        size_options,
        side_dish_options,
        addon_options,
        custom_choice_groups,
        price,
        calories,
        average_wait_time,
        is_discounted,
        discount_price,
        is_available,
        is_featured,
        sort_order
      ) VALUES (
        ${payload.categoryId},
        ${normalizeScope(payload.scope)}::"MenuScope",
        ${nameAr || nameEn || 'منتج جديد'},
        ${nameEn || nameAr || 'New Product'},
        ${payload.descriptionAr ?? null},
        ${payload.descriptionEn ?? null},
        ${payload.mediaType}::"MediaType",
        ${coverMediaUrl},
        ${JSON.stringify(galleryUrls)}::jsonb,
        ${JSON.stringify(payload.ingredients ?? [])}::jsonb,
        ${JSON.stringify(payload.tags ?? [])}::jsonb,
        ${JSON.stringify(payload.allergens ?? [])}::jsonb,
        ${JSON.stringify(sizeOptions)}::jsonb,
        ${JSON.stringify(sideDishOptions)}::jsonb,
        ${JSON.stringify(addonOptions)}::jsonb,
        ${JSON.stringify(customChoiceGroups)}::jsonb,
        ${payload.price}::numeric(10,2),
        ${payload.calories ?? null},
        ${payload.averageWaitTime ?? null},
        ${payload.isDiscounted},
        ${payload.discountPrice ?? null}::numeric(10,2),
        ${payload.isAvailable},
        ${payload.isFeatured},
        ${payload.sortOrder}
      )
      RETURNING id
    `;
    const [savedProduct] = await selectProductById(createdProduct.id);
    await logAudit('create', 'Product', createdProduct.id, null, savedProduct);
    emitDataChanged(req.app.get('io'), { entity: 'product', action: 'create' });
    sendOk(res, savedProduct);
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/products/:id', async (req, res, next) => {
  try {
    const payload = productUpsertSchema.partial().parse(req.body);
    const id = Number(req.params.id);
    const before = await prisma.product.findUnique({ where: { id } });
    const nameAr = payload.nameAr !== undefined ? String(payload.nameAr ?? '').trim() : undefined;
    const nameEn = payload.nameEn !== undefined ? String(payload.nameEn ?? '').trim() : undefined;
    const nextCoverMediaUrl = payload.coverMediaUrl?.startsWith('data:')
      ? (await saveDataUrl(payload.coverMediaUrl)).url
      : (payload.coverMediaUrl ? payload.coverMediaUrl : undefined);
    const nextGalleryUrls = payload.galleryUrls
      ? await Promise.all(payload.galleryUrls.map(async (item) => {
        if (String(item).startsWith('data:')) {
          return (await saveDataUrl(item)).url;
        }
        return item;
      }))
      : undefined;
    const nextSizeOptions = payload.sizeOptions !== undefined ? normalizeOptionList(payload.sizeOptions) : undefined;
    const nextSideDishOptions = payload.sideDishOptions !== undefined ? normalizeOptionList(payload.sideDishOptions) : undefined;
    const nextAddonOptions = payload.addonOptions !== undefined ? normalizeOptionList(payload.addonOptions) : undefined;
    const nextCustomChoiceGroupsInput = resolveChoiceGroupsPayload(payload);
    const nextCustomChoiceGroups = nextCustomChoiceGroupsInput !== null && nextCustomChoiceGroupsInput !== undefined
      ? normalizeChoiceGroups(nextCustomChoiceGroupsInput)
      : undefined;
    await prisma.$executeRaw`
      UPDATE products
      SET
        category_id = COALESCE(${payload.categoryId ?? null}, category_id),
        scope = COALESCE(${payload.scope ? normalizeScope(payload.scope) : null}::"MenuScope", scope),
        name_ar = COALESCE(${nameAr ?? null}, name_ar),
        name_en = COALESCE(${nameEn ?? null}, name_en),
        description_ar = CASE WHEN ${payload.descriptionAr !== undefined} THEN ${payload.descriptionAr ?? null} ELSE description_ar END,
        description_en = CASE WHEN ${payload.descriptionEn !== undefined} THEN ${payload.descriptionEn ?? null} ELSE description_en END,
        media_type = COALESCE(${payload.mediaType ?? null}::"MediaType", media_type),
        cover_media_url = COALESCE(${nextCoverMediaUrl ?? null}, cover_media_url),
        gallery_urls = COALESCE(${nextGalleryUrls !== undefined ? JSON.stringify(nextGalleryUrls) : null}::jsonb, gallery_urls),
        ingredients = COALESCE(${payload.ingredients !== undefined ? JSON.stringify(payload.ingredients ?? []) : null}::jsonb, ingredients),
        tags = COALESCE(${payload.tags !== undefined ? JSON.stringify(payload.tags ?? []) : null}::jsonb, tags),
        allergens = COALESCE(${payload.allergens !== undefined ? JSON.stringify(payload.allergens ?? []) : null}::jsonb, allergens),
        size_options = COALESCE(${nextSizeOptions !== undefined ? JSON.stringify(nextSizeOptions) : null}::jsonb, size_options),
        side_dish_options = COALESCE(${nextSideDishOptions !== undefined ? JSON.stringify(nextSideDishOptions) : null}::jsonb, side_dish_options),
        addon_options = COALESCE(${nextAddonOptions !== undefined ? JSON.stringify(nextAddonOptions) : null}::jsonb, addon_options),
        custom_choice_groups = COALESCE(${nextCustomChoiceGroups !== undefined ? JSON.stringify(nextCustomChoiceGroups) : null}::jsonb, custom_choice_groups),
        price = COALESCE(${payload.price ?? null}::numeric(10,2), price),
        calories = CASE WHEN ${payload.calories !== undefined} THEN ${payload.calories ?? null} ELSE calories END,
        average_wait_time = CASE WHEN ${payload.averageWaitTime !== undefined} THEN ${payload.averageWaitTime ?? null} ELSE average_wait_time END,
        is_discounted = COALESCE(${payload.isDiscounted ?? null}, is_discounted),
        discount_price = CASE WHEN ${payload.discountPrice !== undefined} THEN NULLIF(${payload.discountPrice ?? ''}, '')::numeric(10,2) ELSE discount_price END,
        is_available = COALESCE(${payload.isAvailable ?? null}, is_available),
        is_featured = COALESCE(${payload.isFeatured ?? null}, is_featured),
        sort_order = COALESCE(${payload.sortOrder ?? null}, sort_order)
      WHERE id = ${id}
    `;
    const [savedProduct] = await selectProductById(id);
    await logAudit('update', 'Product', id, before, savedProduct);
    emitDataChanged(req.app.get('io'), { entity: 'product', action: 'update' });
    sendOk(res, savedProduct);
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/products/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const forceDelete = ['1', 'true', 'yes'].includes(String(req.query?.force ?? '').toLowerCase());
    const before = await prisma.product.findUnique({ where: { id } });
    if (!before) {
      return sendError(res, 404, 'Product not found');
    }

      const [{ orderItemsCount }] = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS "orderItemsCount"
        FROM order_items
        WHERE product_id = ${id}
          AND COALESCE(item_type, 'product') <> 'offer'
      `;

    if (Number(orderItemsCount) > 0) {
      if (!forceDelete) {
        return sendError(
          res,
          409,
          'لا يمكن حذف المنتج لأنه مرتبط بطلبات سابقة. يمكنك إلغاء تفعيله بدل الحذف.'
        );
      }
      await prisma.$transaction(async (tx) => {
        await tx.orderItem.deleteMany({ where: { productId: id } });
        await tx.product.delete({ where: { id } });
      });
      await logAudit('delete', 'Product', id, before, null);
      emitDataChanged(req.app.get('io'), { entity: 'product', action: 'delete', forced: true });
      return sendOk(res, { deleted: true, forced: true });
    }

    await prisma.product.delete({ where: { id } });
    await logAudit('delete', 'Product', id, before, null);
    emitDataChanged(req.app.get('io'), { entity: 'product', action: 'delete' });
    sendOk(res, true);
  } catch (error) {
    if (error?.code === 'P2003') {
      return sendError(
        res,
        409,
        'لا يمكن حذف المنتج لأنه مرتبط ببيانات أخرى. يمكنك إلغاء تفعيله بدل الحذف.'
      );
    }
    next(error);
  }
});

adminRouter.get('/orders', async (_req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: [{ createdAt: 'desc' }],
      include: {
        table: true,
        branch: true,
        customer: true,
        waiter: true,
        items: {
          include: {
            product: {
              include: {
                category: true
              }
            }
          }
        }
      }
    });
    if (!orders.length) {
      return sendOk(res, []);
    }
    const orderNumbers = await prisma.$queryRaw`
      SELECT id, order_number AS "orderNumber", cancel_reason AS "cancelReason"
      FROM orders
      WHERE id IN (${Prisma.join(orders.map((order) => order.id))})
    `;
    const orderMetaMap = new Map(orderNumbers.map((row) => [row.id, row]));
      const orderItemRows = await prisma.$queryRaw`
        SELECT
          id,
          order_id AS "orderId",
          offer_id AS "offerId",
          item_type AS "itemType",
          display_name_ar AS "displayNameAr",
          display_name_en AS "displayNameEn",
          display_image_url AS "displayImageUrl",
          selected_options AS "selectedOptions"
        FROM order_items
        WHERE order_id IN (${Prisma.join(orders.map((order) => order.id))})
      `;
      const orderItemsMap = new Map();
    for (const row of orderItemRows) {
      const list = orderItemsMap.get(row.orderId) ?? [];
      list.push(row);
      orderItemsMap.set(row.orderId, list);
    }
      sendOk(res, orders.map((order) => ({
        ...order,
        items: order.items.map((item) => {
          const match = (orderItemsMap.get(order.id) ?? []).find((row) => row.id === item.id);
          const selectedOptions = match?.selectedOptions ?? item.selectedOptions ?? null;
          const offerId = match?.offerId ?? item.offerId ?? selectedOptions?.offerId ?? null;
          const displayNameAr = match?.displayNameAr ?? item.displayNameAr ?? selectedOptions?.displayNameAr ?? selectedOptions?.offerNameAr ?? null;
          const displayNameEn = match?.displayNameEn ?? item.displayNameEn ?? selectedOptions?.displayNameEn ?? selectedOptions?.offerNameEn ?? null;
          const displayImageUrl = match?.displayImageUrl ?? item.displayImageUrl ?? selectedOptions?.displayImageUrl ?? selectedOptions?.offerImageUrl ?? null;
          const hasOfferMeta = Boolean(
            offerId
            || String(selectedOptions?.itemType ?? '').toLowerCase() === 'offer'
            || displayNameAr
            || displayNameEn
            || displayImageUrl
            || selectedOptions?.offerNameAr
            || selectedOptions?.offerNameEn
            || selectedOptions?.offerGroupSelections?.length
            || selectedOptions?.selectedOfferItems?.length
          );
          const itemType = hasOfferMeta
            ? 'offer'
            : (match?.itemType ?? item.itemType ?? 'product');
          return {
            ...item,
            offerId,
            itemType,
            displayNameAr,
            displayNameEn,
            displayImageUrl,
            selectedOptions: {
              ...(selectedOptions && typeof selectedOptions === 'object' ? selectedOptions : {}),
              offerId,
              itemType,
              displayNameAr,
              displayNameEn,
              displayImageUrl
            }
          };
        }),
        orderNumber: orderMetaMap.get(order.id)?.orderNumber ?? order.id,
      cancelReason: orderMetaMap.get(order.id)?.cancelReason ?? null
    })));
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/orders/previous', async (_req, res, next) => {
  try {
    const archivedRows = await prisma.$queryRaw`
      SELECT
        order_id AS "orderId",
        payload,
        created_at AS "createdAt",
        archived_at AS "archivedAt",
        table_number AS "tableNumber",
        table_color AS "tableColor",
        session_uuid AS "sessionUuid",
        order_number AS "orderNumber",
        status,
        source,
        total_amount AS "totalAmount"
      FROM archived_orders
      ORDER BY COALESCE(session_uuid, archived_at::text, created_at::text) DESC, COALESCE(archived_at, created_at) DESC, order_id DESC
    `;
    if (!archivedRows.length) {
      return sendOk(res, []);
    }
    sendOk(res, archivedRows.map((row) => {
      const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
      const sessionOpenedAt = payload.table?.openedAt ?? payload.openedAt ?? row.createdAt ?? row.archivedAt ?? null;
      const sessionGroupKey = row.sessionUuid ?? sessionOpenedAt ?? row.tableNumber ?? row.orderId;
      return {
        ...payload,
        id: payload.id ?? row.orderId,
        tableId: payload.tableId ?? payload.table?.id ?? null,
        table: payload.table ?? (row.tableNumber ? { tableNumber: row.tableNumber, tableColor: row.tableColor ?? null } : null),
        items: Array.isArray(payload.items) ? payload.items.map((item) => {
          const selectedOptions = item.selectedOptions && typeof item.selectedOptions === 'object' ? item.selectedOptions : {};
          const offerId = item.offerId ?? selectedOptions.offerId ?? null;
          const displayNameAr = item.displayNameAr ?? selectedOptions.displayNameAr ?? selectedOptions.offerNameAr ?? null;
          const displayNameEn = item.displayNameEn ?? selectedOptions.displayNameEn ?? selectedOptions.offerNameEn ?? null;
          const displayImageUrl = item.displayImageUrl ?? selectedOptions.displayImageUrl ?? selectedOptions.offerImageUrl ?? null;
          const hasOfferMeta = Boolean(
            offerId
            || String(selectedOptions.itemType ?? '').toLowerCase() === 'offer'
            || displayNameAr
            || displayNameEn
            || displayImageUrl
            || selectedOptions.offerNameAr
            || selectedOptions.offerNameEn
            || selectedOptions.offerGroupSelections?.length
            || selectedOptions.selectedOfferItems?.length
          );
          const itemType = hasOfferMeta ? 'offer' : (item.itemType ?? 'product');
          return {
            ...item,
            offerId,
            itemType,
            displayNameAr,
            displayNameEn,
            displayImageUrl,
            selectedOptions: {
              ...selectedOptions,
              offerId,
              itemType,
              displayNameAr,
              displayNameEn,
              displayImageUrl
            }
          };
        }) : [],
        orderNumber: payload.orderNumber ?? row.orderNumber ?? row.orderId,
        status: payload.status ?? row.status ?? 'pending',
        source: payload.source ?? row.source ?? 'qr',
        totalAmount: payload.totalAmount ?? row.totalAmount ?? null,
        createdAt: payload.createdAt ?? row.createdAt,
        archivedAt: row.archivedAt,
        sessionUuid: row.sessionUuid ?? null,
        sessionOpenedAt,
        sessionGroupKey
      };
    }));
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/orders/:id/status', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const status = String(req.body?.status ?? '');
    const reason = String(req.body?.reason ?? '').trim();
    if (!['pending', 'completed', 'cancelled'].includes(status)) {
      return sendError(res, 400, 'Invalid order status');
    }
    const before = await prisma.order.findUnique({ where: { id } });
    await prisma.$executeRaw`
      UPDATE orders
      SET
        status = ${status}::"OrderStatus",
        cancel_reason = CASE
          WHEN ${status} = 'cancelled' THEN ${reason || null}
          ELSE NULL
        END
      WHERE id = ${id}
    `;
    const order = await prisma.order.findUnique({ where: { id } });
    await logAudit('update', 'Order', id, before, order);
    emitDataChanged(req.app.get('io'), { entity: 'order', action: 'status', id, status });
    sendOk(res, order);
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/order-items/:id/status', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const status = String(req.body?.status ?? '');
    const reason = String(req.body?.reason ?? '').trim();
    if (!['pending', 'completed', 'cancelled'].includes(status)) {
      return sendError(res, 400, 'Invalid order item status');
    }

    const beforeRows = await prisma.$queryRaw`
      SELECT
        id,
        order_id AS "orderId",
        product_id AS "productId",
        quantity,
        price_at_sale AS "priceAtSale",
        selected_options AS "selectedOptions"
      FROM order_items
      WHERE id = ${id}
      LIMIT 1
    `;
    const before = beforeRows?.[0] ?? null;
    if (!before) {
      return sendError(res, 404, 'Order item not found');
    }

    const nextSelectedOptions = {
      ...(before.selectedOptions && typeof before.selectedOptions === 'object' ? before.selectedOptions : {}),
      adminStatus: status,
      adminStatusReason: status === 'cancelled' ? reason : '',
      adminStatusUpdatedAt: new Date().toISOString()
    };

    await prisma.$executeRaw`
      UPDATE order_items
      SET selected_options = ${JSON.stringify(nextSelectedOptions)}::jsonb
      WHERE id = ${id}
    `;

    const afterRows = await prisma.$queryRaw`
      SELECT
        id,
        order_id AS "orderId",
        product_id AS "productId",
        quantity,
        price_at_sale AS "priceAtSale",
        selected_options AS "selectedOptions"
      FROM order_items
      WHERE id = ${id}
      LIMIT 1
    `;
    const after = afterRows?.[0] ?? null;
    await logAudit('update', 'OrderItem', id, before, after);
    emitDataChanged(req.app.get('io'), { entity: 'order-item', action: 'status', id, status });
    sendOk(res, after);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/employees', async (_req, res, next) => {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: [{ id: 'asc' }],
      include: { branch: true }
    });
    sendOk(res, employees);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/employees', async (req, res, next) => {
  try {
    const payload = employeeCreateSchema.parse(req.body ?? {});
    const fullName = String(payload.fullName ?? '').trim();
    const phone = String(payload.phone ?? '').trim();
    const email = payload.email ?? null;
    const passwordHash = await hashPassword(payload.password);
    const employee = await prisma.employee.create({
      data: {
        fullName: fullName || 'موظف جديد',
        phone,
        email,
        passwordHash,
        role: normalizeEmployeeRole(payload.role),
        branchId: payload.branchId ?? null,
        isActive: payload.isActive ?? true
      },
      include: { branch: true }
    });
    await logAudit('create', 'Employee', employee.id, null, employee);
    emitDataChanged(req.app.get('io'), { entity: 'employee', action: 'create' });
    sendOk(res, employee);
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/employees/:id', async (req, res, next) => {
  try {
    const payload = employeeUpdateSchema.parse(req.body ?? {});
    const id = Number(req.params.id);
    const before = await prisma.employee.findUnique({ where: { id } });
    const fullName = payload.fullName !== undefined ? String(payload.fullName ?? '').trim() : undefined;
    const phone = payload.phone !== undefined ? String(payload.phone ?? '').trim() : undefined;
    const email = payload.email !== undefined ? payload.email : undefined;
    const passwordHash = payload.password ? await hashPassword(payload.password) : undefined;
    const employee = await prisma.employee.update({
      where: { id },
      data: {
        ...(fullName !== undefined ? { fullName: fullName || 'موظف جديد' } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(passwordHash ? { passwordHash } : {}),
        ...(payload.role ? { role: normalizeEmployeeRole(payload.role) } : {}),
        ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
        branchId: payload.branchId === null ? null : (payload.branchId ?? undefined)
      },
      include: { branch: true }
    });
    await logAudit('update', 'Employee', id, before, employee);
    emitDataChanged(req.app.get('io'), { entity: 'employee', action: 'update' });
    sendOk(res, employee);
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/employees/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const before = await prisma.employee.findUnique({ where: { id } });
    await prisma.employee.delete({ where: { id } });
    await logAudit('delete', 'Employee', id, before, null);
    emitDataChanged(req.app.get('io'), { entity: 'employee', action: 'delete' });
    sendOk(res, true);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/tables', async (_req, res, next) => {
  try {
    const tables = await prisma.$queryRaw`
      SELECT
        t.id,
        t.branch_id AS "branchId",
        t.name,
        t.table_number AS "tableNumber",
        t.qr_code_uuid AS "qrCodeUuid",
        t.session_uuid AS "sessionUuid",
        t.table_color AS "tableColor",
        t.current_phone AS "currentPhone",
        t.opened_at AS "openedAt",
        t.invoice_requested_at AS "invoiceRequestedAt",
        t.active_order_number AS "activeOrderNumber",
        t.status,
        t.created_at AS "createdAt",
        b.id AS "branch__id",
        b.name_ar AS "branch__nameAr",
        b.name_en AS "branch__nameEn",
        b.code AS "branch__code",
        b.is_active AS "branch__isActive"
      FROM tables t
      LEFT JOIN branches b ON b.id = t.branch_id
      ORDER BY t.created_at DESC
    `;
    sendOk(res, tables);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/vip-customers', async (_req, res, next) => {
  try {
    const vip = await loadVipCustomers();
    sendOk(res, vip);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/vip-customers/reset', async (req, res, next) => {
  try {
    const vip = await loadVipCustomers();
    const resetPhones = Array.isArray(vip?.customers)
      ? vip.customers.map((customer) => String(customer.phone ?? '').trim()).filter(Boolean)
      : [];

    if (resetPhones.length) {
      await Promise.all(resetPhones.map((phone) => resetVipCycleByPhone(phone)));
    }

    const refreshed = await loadVipCustomers();
    emitDataChanged(req.app.get('io'), { entity: 'vip-customer', action: 'reset-view' });
    sendOk(res, refreshed);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/vip-summary', async (req, res, next) => {
  try {
    const phone = String(req.query?.phone ?? '').trim();
    const subtotal = Number(req.query?.subtotal ?? 0);
    const vip = await loadVipInvoiceDiscount(phone, subtotal);
    sendOk(res, vip);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/tables', async (req, res, next) => {
  try {
    const payload = qrCreateSchema.parse(req.body);
    const requestedNumber = String(payload.tableNumber ?? '').trim();
    let tableNumber = requestedNumber;
    if (!tableNumber) {
      const existingTables = await prisma.$queryRaw`
        SELECT table_number AS "tableNumber"
        FROM tables
      `;
      const maxNumber = existingTables.reduce((max, row) => {
        const current = Number.parseInt(String(row.tableNumber ?? '').replace(/[^\d]/g, ''), 10);
        return Number.isFinite(current) && current > max ? current : max;
      }, 0);
      tableNumber = String(maxNumber + 1);
    }
    const [table] = await prisma.$queryRaw`
      INSERT INTO tables (name, table_number, qr_code_uuid, session_uuid, table_color, current_phone, opened_at)
      VALUES (${payload.name?.trim() || null}, ${tableNumber}, ${createQrUuid()}, ${createQrUuid()}, ${payload.tableColor?.trim() || null}, NULL, NULL)
      RETURNING
        id,
        branch_id AS "branchId",
        name,
        table_number AS "tableNumber",
        qr_code_uuid AS "qrCodeUuid",
        session_uuid AS "sessionUuid",
        table_color AS "tableColor",
        current_phone AS "currentPhone",
        opened_at AS "openedAt",
        invoice_requested_at AS "invoiceRequestedAt",
        active_order_number AS "activeOrderNumber",
        status,
        created_at AS "createdAt"
    `;
    await logAudit('create', 'Table', table.id, null, table);
    emitDataChanged(req.app.get('io'), { entity: 'table', action: 'create' });
    sendOk(res, table);
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/tables/:id', async (req, res, next) => {
  try {
    const payload = qrUpdateSchema.parse(req.body ?? {});
    const id = Number(req.params.id);
    const [before] = await prisma.$queryRaw`
      SELECT id, branch_id AS "branchId", name, table_number AS "tableNumber", qr_code_uuid AS "qrCodeUuid", session_uuid AS "sessionUuid", table_color AS "tableColor", current_phone AS "currentPhone", opened_at AS "openedAt", active_order_number AS "activeOrderNumber", status, created_at AS "createdAt"
      FROM tables
      WHERE id = ${id}
      LIMIT 1
    `;
    await prisma.$executeRaw`
      UPDATE tables
      SET
        table_number = COALESCE(${payload.tableNumber ? String(payload.tableNumber).trim() : null}, table_number),
        name = CASE WHEN ${payload.name !== undefined} THEN ${payload.name ? String(payload.name).trim() : null} ELSE name END,
        table_color = CASE WHEN ${payload.tableColor !== undefined} THEN ${payload.tableColor ? String(payload.tableColor).trim() : null} ELSE table_color END,
        status = COALESCE(${payload.status ?? null}::"TableStatus", status)
      WHERE id = ${id}
    `;
    const [table] = await prisma.$queryRaw`
      SELECT id, branch_id AS "branchId", name, table_number AS "tableNumber", qr_code_uuid AS "qrCodeUuid", session_uuid AS "sessionUuid", table_color AS "tableColor", current_phone AS "currentPhone", opened_at AS "openedAt", invoice_requested_at AS "invoiceRequestedAt", active_order_number AS "activeOrderNumber", status, created_at AS "createdAt"
      FROM tables
      WHERE id = ${id}
      LIMIT 1
    `;
    await logAudit('update', 'Table', id, before, table);
    emitDataChanged(req.app.get('io'), { entity: 'table', action: 'update' });
    sendOk(res, table);
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/tables/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [before] = await prisma.$queryRaw`
      SELECT id, branch_id AS "branchId", name, table_number AS "tableNumber", qr_code_uuid AS "qrCodeUuid", session_uuid AS "sessionUuid", table_color AS "tableColor", current_phone AS "currentPhone", opened_at AS "openedAt", invoice_requested_at AS "invoiceRequestedAt", active_order_number AS "activeOrderNumber", status, created_at AS "createdAt"
      FROM tables
      WHERE id = ${id}
      LIMIT 1
    `;
    if (before?.currentPhone) {
      return sendError(res, 409, 'الرجاء إغلاق الطاولة أولاً ثم حذف الـ QR');
    }
    const [{ orderCount }] = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS "orderCount"
      FROM orders
      WHERE table_id = ${id}
    `;
    const [{ waiterCallCount }] = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS "waiterCallCount"
      FROM waiter_calls
      WHERE table_id = ${id}
    `;
    if (Number(orderCount) > 0 || Number(waiterCallCount) > 0) {
      return sendError(res, 409, 'لا يمكن حذف QR لأن هناك طلبات أو طلبات نادل مرتبطة بهذه الطاولة');
    }
    await prisma.$executeRaw`DELETE FROM tables WHERE id = ${id}`;
    await logAudit('delete', 'Table', id, before, null);
    emitDataChanged(req.app.get('io'), { entity: 'table', action: 'delete' });
    sendOk(res, true);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return sendError(res, 409, 'لا يمكن حذف QR لأن هناك بيانات مرتبطة بهذه الطاولة');
    }
    next(error);
  }
});

adminRouter.post('/tables/:id/rotate-qr', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [before] = await prisma.$queryRaw`
      SELECT id, branch_id AS "branchId", name, table_number AS "tableNumber", qr_code_uuid AS "qrCodeUuid", session_uuid AS "sessionUuid", table_color AS "tableColor", current_phone AS "currentPhone", opened_at AS "openedAt", invoice_requested_at AS "invoiceRequestedAt", active_order_number AS "activeOrderNumber", status, created_at AS "createdAt"
      FROM tables
      WHERE id = ${id}
      LIMIT 1
    `;
    await prisma.$executeRaw`
      UPDATE tables
      SET
        session_uuid = ${createQrUuid()},
        current_phone = NULL,
        opened_at = NULL,
        invoice_requested_at = NULL,
        active_order_number = NULL
      WHERE id = ${id}
    `;
    const [table] = await prisma.$queryRaw`
      SELECT id, branch_id AS "branchId", name, table_number AS "tableNumber", qr_code_uuid AS "qrCodeUuid", session_uuid AS "sessionUuid", table_color AS "tableColor", current_phone AS "currentPhone", opened_at AS "openedAt", invoice_requested_at AS "invoiceRequestedAt", status, created_at AS "createdAt"
      FROM tables
      WHERE id = ${id}
      LIMIT 1
    `;
    await logAudit('update', 'Table', id, before, table);
    emitDataChanged(req.app.get('io'), { entity: 'table', action: 'rotate-qr' });
    sendOk(res, table);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/waiter-calls', async (_req, res, next) => {
  try {
    const calls = await prisma.waiterCall.findMany({
      orderBy: [{ createdAt: 'desc' }],
      include: { table: true },
      take: 50
    });
    sendOk(res, calls);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/waiter-complaints', async (_req, res, next) => {
  try {
    const complaints = await prisma.$queryRaw`
      SELECT
        id,
        table_number AS "tableNumber",
        complaint,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM waiter_complaints
      ORDER BY created_at DESC, id DESC
    `;
    sendOk(res, complaints);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/customer-reviews', async (_req, res, next) => {
  try {
    const reviews = await prisma.$queryRaw`
      SELECT
        cr.id,
        cr.table_id AS "tableId",
        cr.table_uuid AS "tableUuid",
        cr.session_uuid AS "sessionUuid",
        cr.table_number AS "tableNumber",
        cr.table_color AS "tableColor",
        cr.phone,
        cr.customer_name AS "customerName",
        cr.rating_mode AS "ratingMode",
        cr.rating_value AS "ratingValue",
        cr.comment,
        cr.created_at AS "createdAt",
        t.status AS "tableStatus"
      FROM customer_reviews cr
      LEFT JOIN tables t ON t.id = cr.table_id
      ORDER BY cr.created_at DESC, cr.id DESC
    `;
    sendOk(res, reviews);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/waiter-complaints', async (req, res, next) => {
  try {
    const payload = waiterComplaintSchema.parse(req.body ?? {});
    const [complaint] = await prisma.$queryRaw`
      INSERT INTO waiter_complaints (table_number, complaint, created_at, updated_at)
      VALUES (${payload.tableNumber.trim()}, ${payload.complaint.trim()}, NOW(), NOW())
      RETURNING
        id,
        table_number AS "tableNumber",
        complaint,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `;
    logAudit('create', 'WaiterComplaint', complaint.id, null, complaint).catch(() => {});
    emitDataChanged(req.app.get('io'), { entity: 'waiter-complaint', action: 'create' });
    sendOk(res, complaint);
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/waiter-complaints/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const payload = waiterComplaintSchema.partial().parse(req.body ?? {});
    const [before] = await prisma.$queryRaw`
      SELECT
        id,
        table_number AS "tableNumber",
        complaint,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM waiter_complaints
      WHERE id = ${id}
      LIMIT 1
    `;
    await prisma.$executeRaw`
      UPDATE waiter_complaints
      SET
        table_number = COALESCE(${payload.tableNumber ? payload.tableNumber.trim() : null}, table_number),
        complaint = COALESCE(${payload.complaint ? payload.complaint.trim() : null}, complaint),
        updated_at = NOW()
      WHERE id = ${id}
    `;
    const [complaint] = await prisma.$queryRaw`
      SELECT
        id,
        table_number AS "tableNumber",
        complaint,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM waiter_complaints
      WHERE id = ${id}
      LIMIT 1
    `;
    logAudit('update', 'WaiterComplaint', id, before, complaint).catch(() => {});
    emitDataChanged(req.app.get('io'), { entity: 'waiter-complaint', action: 'update' });
    sendOk(res, complaint);
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/waiter-complaints/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [before] = await prisma.$queryRaw`
      SELECT
        id,
        table_number AS "tableNumber",
        complaint,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM waiter_complaints
      WHERE id = ${id}
      LIMIT 1
    `;
    await prisma.$executeRaw`
      DELETE FROM waiter_complaints
      WHERE id = ${id}
    `;
    logAudit('delete', 'WaiterComplaint', id, before, null).catch(() => {});
    emitDataChanged(req.app.get('io'), { entity: 'waiter-complaint', action: 'delete' });
    sendOk(res, true);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/report-schedules', async (_req, res, next) => {
  try {
    const schedules = await prisma.reportSchedule.findMany({ orderBy: [{ createdAt: 'desc' }] });
    sendOk(res, schedules);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/report-schedules', async (req, res, next) => {
  try {
    const payload = reportScheduleSchema.parse(req.body);
    const schedule = await prisma.reportSchedule.create({
      data: {
        ...payload,
        nextRunAt: payload.nextRunAt ? new Date(payload.nextRunAt) : null,
        lastRunAt: payload.lastRunAt ? new Date(payload.lastRunAt) : null
      }
    });
    await logAudit('create', 'ReportSchedule', schedule.id, null, schedule);
    emitDataChanged(req.app.get('io'), { entity: 'report-schedule', action: 'create' });
    sendOk(res, schedule);
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/report-schedules/:id', async (req, res, next) => {
  try {
    const payload = reportScheduleSchema.partial().parse(req.body);
    const id = Number(req.params.id);
    const before = await prisma.reportSchedule.findUnique({ where: { id } });
    const schedule = await prisma.reportSchedule.update({
      where: { id },
      data: {
        ...payload,
        nextRunAt: payload.nextRunAt ? new Date(payload.nextRunAt) : undefined,
        lastRunAt: payload.lastRunAt ? new Date(payload.lastRunAt) : undefined
      }
    });
    await logAudit('update', 'ReportSchedule', id, before, schedule);
    emitDataChanged(req.app.get('io'), { entity: 'report-schedule', action: 'update' });
    sendOk(res, schedule);
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/report-schedules/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const before = await prisma.reportSchedule.findUnique({ where: { id } });
    await prisma.reportSchedule.delete({ where: { id } });
    await logAudit('delete', 'ReportSchedule', id, before, null);
    emitDataChanged(req.app.get('io'), { entity: 'report-schedule', action: 'delete' });
    sendOk(res, true);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/reports/refresh', async (_req, res, next) => {
  try {
    await prisma.$executeRaw`REFRESH MATERIALIZED VIEW "analytics_daily_sales_mv"`;
    await logAudit('refresh', 'Reporting', 'analytics_daily_sales_mv', null, { refreshedAt: new Date().toISOString() });
    emitDataChanged(req.app.get('io'), { entity: 'reports', action: 'refresh' });
    sendOk(res, true);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/uploads', async (req, res, next) => {
  try {
    const payload = uploadSchema.parse(req.body);
    const file = await saveDataUrl(payload.fileData);
    emitDataChanged(req.app.get('io'), { entity: 'upload', action: 'create' });
    sendOk(res, file);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/waiter-calls/:id/acknowledge', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const call = await prisma.waiterCall.update({
      where: { id },
      data: { status: 'acknowledged', respondedAt: new Date() }
    });
    emitDataChanged(req.app.get('io'), { entity: 'waiter-call', action: 'acknowledge' });
    sendOk(res, call);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/waiter-calls/:id/complete', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const call = await prisma.waiterCall.update({
      where: { id },
      data: { status: 'completed', respondedAt: new Date() }
    });
    emitDataChanged(req.app.get('io'), { entity: 'waiter-call', action: 'complete' });
    sendOk(res, call);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/analytics/top-products', async (req, res, next) => {
  try {
    const { from, to } = normalizePeriodRange(req.query);
    const data = await getTopSellingProducts(prisma, from, to);
    sendOk(res, data);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/analytics/peak-hours', async (req, res, next) => {
  try {
    const { from, to } = normalizePeriodRange(req.query);
    const data = await getPeakOrderingHours(prisma, from, to);
    sendOk(res, data);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/analytics/revenue', async (req, res, next) => {
  try {
    const { from, to, bucket } = normalizePeriodRange(req.query);
    const data = await getRevenueAnalytics(prisma, from, to, bucket === 'day' ? 'day' : bucket === 'week' ? 'week' : 'month');
    sendOk(res, data);
  } catch (error) {
    next(error);
  }
});
