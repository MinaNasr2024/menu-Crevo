import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { sendOk, sendError } from '../lib/http.js';
import { currentPrice } from '../lib/price.js';
import { customerReviewSchema, invoiceRequestSchema, menuQuerySchema, orderCreateSchema, productViewCreateSchema, tableCloseSchema, tablePhoneSchema, tableUuidSchema, waiterCallCreateSchema } from '../lib/validators.js';
import { createQrUuid } from '../lib/qr.js';
import { emitDataChanged } from '../lib/realtime.js';
import { listOffers } from '../lib/offers.js';
import { loadLatestCustomerNameByPhone, loadVipCampaign, loadVipInvoiceDiscount, loadVipSummary, recordVipAmountSpend, recordVipVisit, resetVipCycleByPhone } from '../lib/vip.js';

function normalizeOptionList(list) {
  return Array.isArray(list) ? list : [];
}

function toNumber(value) {
  return Number.parseFloat(String(value ?? '0')) || 0;
}

function pickOptionById(options, id) {
  return normalizeOptionList(options).find((option) => String(option?.id) === String(id)) ?? null;
}

function normalizeChoiceGroups(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((group) => ({
      id: String(group?.id ?? ''),
      titleAr: String(group?.titleAr ?? '').trim(),
      titleEn: String(group?.titleEn ?? '').trim(),
      items: normalizeOptionList(group?.items).map((item) => ({
        ...item,
        required: Boolean(item?.required)
      }))
    }))
    .filter((group) => group.titleAr || group.titleEn);
}

function calculateProductUnitPrice(product, selectedOptions = {}) {
  const size = selectedOptions.sizeId ? pickOptionById(product.sizeOptions, selectedOptions.sizeId) : null;
  let total = size ? toNumber(size.price) : currentPrice(product);
  for (const addonId of selectedOptions.addonIds ?? []) {
    const addon = pickOptionById(product.addonOptions, addonId);
    if (addon) total += toNumber(addon.price);
  }
  for (const sideDishId of selectedOptions.sideDishIds ?? []) {
    const sideDish = pickOptionById(product.sideDishOptions, sideDishId);
    if (sideDish) total += toNumber(sideDish.price);
  }
  for (const selection of selectedOptions.customChoiceSelections ?? []) {
    const group = pickOptionById(product.customChoiceGroups, selection.groupId);
    const choice = group ? pickOptionById(group.items, selection.choiceId) : null;
    total += choice ? toNumber(choice.price) : toNumber(selection.choicePrice);
  }
  return Number(total.toFixed(2));
}

function normalizeOfferText(value) {
  return String(value ?? '').trim();
}

function resolveOrderItemDisplay(selectedOptions = {}) {
  const itemType = String(selectedOptions.itemType ?? '').toLowerCase() === 'offer' || selectedOptions.offerId
    ? 'offer'
    : 'product';
  if (itemType !== 'offer') {
    return {
      itemType: 'product',
      displayNameAr: null,
      displayNameEn: null,
      displayImageUrl: null
    };
  }
  return {
    itemType: 'offer',
    displayNameAr: normalizeOfferText(selectedOptions.displayNameAr || selectedOptions.offerNameAr),
    displayNameEn: normalizeOfferText(selectedOptions.displayNameEn || selectedOptions.offerNameEn),
    displayImageUrl: normalizeOfferText(selectedOptions.displayImageUrl || selectedOptions.offerImageUrl),
    offerId: Number(selectedOptions.offerId ?? 0) || null
  };
}

function serializeProduct(product) {
  const lang = product._lang ?? 'en';
  return {
    id: product.id,
    categoryId: product.categoryId,
    name: lang === 'ar' ? product.nameAr : product.nameEn,
    nameAr: product.nameAr,
    nameEn: product.nameEn,
    description: lang === 'ar' ? product.descriptionAr : product.descriptionEn,
    descriptionAr: product.descriptionAr,
    descriptionEn: product.descriptionEn,
    mediaType: product.mediaType,
    coverMediaUrl: product.coverMediaUrl,
    galleryUrls: Array.isArray(product.galleryUrls) ? product.galleryUrls : [],
    ingredients: Array.isArray(product.ingredients) ? product.ingredients : [],
    tags: Array.isArray(product.tags) ? product.tags : [],
    allergens: Array.isArray(product.allergens) ? product.allergens : [],
    sizeOptions: Array.isArray(product.sizeOptions) ? product.sizeOptions : [],
    sideDishOptions: Array.isArray(product.sideDishOptions) ? product.sideDishOptions : [],
    addonOptions: Array.isArray(product.addonOptions) ? product.addonOptions : [],
    customChoiceGroups: normalizeChoiceGroups(product.customChoiceGroups),
    price: Number(product.price),
    effectivePrice: currentPrice(product),
    calories: product.calories,
    isDiscounted: product.isDiscounted,
    discountPrice: product.discountPrice ? Number(product.discountPrice) : null,
    isAvailable: product.isAvailable,
    isFeatured: Boolean(product.isFeatured),
    sortOrder: product.sortOrder,
    averageWaitTime: product.averageWaitTime ?? null
  };
}

function selectMenuProducts() {
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
    WHERE scope = 'menu'::"MenuScope"
      AND is_available = true
    ORDER BY sort_order ASC, id ASC
  `;
}

async function resolveTableByUuid(uuid) {
  const [table] = await prisma.$queryRaw`
    SELECT
      id,
      branch_id AS "branchId",
      name,
      table_number AS "tableNumber",
      qr_code_uuid AS "qrCodeUuid",
      session_uuid AS "sessionUuid",
      table_color AS "tableColor",
      active_order_number AS "activeOrderNumber",
      current_phone AS "currentPhone",
      opened_at AS "openedAt",
      invoice_requested_at AS "invoiceRequestedAt",
      status,
      created_at AS "createdAt"
    FROM tables
    WHERE qr_code_uuid = ${uuid}
       OR session_uuid = ${uuid}
       OR CAST(id AS text) = ${uuid}
    LIMIT 1
  `;
  return table ?? null;
}

async function ensureTableSessionUuid(table) {
  if (!table?.id) return table;
  const currentSessionUuid = String(table.sessionUuid ?? '').trim();
  if (currentSessionUuid && currentSessionUuid !== 'null' && currentSessionUuid !== 'undefined') {
    return table;
  }

  const nextSessionUuid = createQrUuid();
  await prisma.$executeRaw`
    UPDATE tables
    SET session_uuid = ${nextSessionUuid}
    WHERE id = ${table.id}
  `;
  return {
    ...table,
    sessionUuid: nextSessionUuid
  };
}

async function loadCurrentSessionOrderCount(table) {
  if (!table?.id || !table?.openedAt) return 0;
  const [row] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS "orderCount"
    FROM orders
    WHERE table_id = ${table.id}
      AND created_at >= ${table.openedAt}
  `;
  return Number(row?.orderCount ?? 0) || 0;
}

async function loadCurrentSessionSubtotal(table) {
  if (!table?.id || !table?.openedAt) return 0;
  const [row] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(total_amount), 0)::numeric(10,2) AS "subtotal"
    FROM orders
    WHERE table_id = ${table.id}
      AND created_at >= ${table.openedAt}
  `;
  return Number(row?.subtotal ?? 0) || 0;
}

function getClientOrigin() {
  const configured = String(process.env.CLIENT_ORIGIN ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (configured.length) {
    const nonLocal = configured.find((item) => !/localhost|127\.0\.0\.1/i.test(item));
    return nonLocal || configured[0];
  }
  return process.env.NODE_ENV === 'production'
    ? 'https://menu.crevo-eg.com'
    : 'http://localhost:5173';
}

function sessionIsValid(table, session) {
  if (!session) return true;
  return table?.sessionUuid === session;
}

export const publicRouter = Router();

function selectMenuCategories() {
  return prisma.$queryRaw`
    SELECT
      id,
      name_ar AS "nameAr",
      name_en AS "nameEn",
      sort_order AS "sortOrder",
      is_active AS "isActive",
      scope
    FROM categories
    WHERE is_active = true
      AND scope = 'menu'::"MenuScope"
    ORDER BY sort_order ASC, id ASC
  `;
}

publicRouter.get('/menu', async (req, res, next) => {
  try {
    const query = menuQuerySchema.parse(req.query);
    const lang = query.lang ?? 'en';
    const [categories, products] = await Promise.all([
      selectMenuCategories(),
      selectMenuProducts()
    ]);
    const productsByCategory = new Map();
    for (const product of products) {
      const bucket = productsByCategory.get(product.categoryId) ?? [];
      bucket.push(product);
      productsByCategory.set(product.categoryId, bucket);
    }

    const shaped = categories.map((category) => ({
      ...category,
      name: lang === 'ar' ? category.nameAr : category.nameEn,
      products: (productsByCategory.get(category.id) ?? []).map((product) => serializeProduct({ ...product, _lang: lang }))
    }));

    let table = query.table ? await resolveTableByUuid(query.table) : null;
    if (table) {
      table = await ensureTableSessionUuid(table);
    }
    if (table && query.session && !sessionIsValid(table, query.session)) {
      return sendError(res, 403, 'QR session expired');
    }
    const orderCount = table ? await loadCurrentSessionOrderCount(table) : 0;
    if (table) {
      if (table.activeOrderNumber == null) {
        const [{ nextOrderNumber }] = await prisma.$queryRaw`
          SELECT COALESCE(MAX(order_number), 0) + 1 AS "nextOrderNumber"
          FROM orders
        `;
        const assigned = Number(nextOrderNumber) || 1;
        await prisma.$executeRaw`
          UPDATE tables
          SET active_order_number = ${assigned}
          WHERE id = ${table.id} AND active_order_number IS NULL
        `;
        table.activeOrderNumber = assigned;
      }
      await prisma.qrScan.create({
        data: {
          tableId: table.id,
          branchId: table.branchId ?? null
        }
      });
    }
    const customerName = table?.currentPhone ? await loadLatestCustomerNameByPhone(table.currentPhone) : '';
    const subtotal = table ? await loadCurrentSessionSubtotal(table) : 0;
    const vip = table?.currentPhone ? await loadVipSummary(table.currentPhone, { sessionUuid: table.sessionUuid ?? '', subtotal }) : null;
    emitDataChanged(req.app.get('io'), { entity: 'menu', action: 'view' });
    sendOk(res, {
      table: table
        ? {
          id: table.id,
          name: table.name,
          tableNumber: table.tableNumber,
          qrCodeUuid: table.qrCodeUuid,
          sessionUuid: table.sessionUuid,
          tableColor: table.tableColor,
          activeOrderNumber: table.activeOrderNumber,
          status: table.status,
          currentPhone: table.currentPhone,
          customerName,
          openedAt: table.openedAt,
          invoiceRequestedAt: table.invoiceRequestedAt,
          orderCount,
          hasOrders: orderCount > 0
        }
        : null,
      verified: Boolean(table),
      categories: shaped,
      vip
    });
  } catch (error) {
    next(error);
  }
});

publicRouter.get('/offers', async (_req, res, next) => {
  try {
    sendOk(res, await listOffers({ activeOnly: true }));
  } catch (error) {
    next(error);
  }
});

publicRouter.get('/table/resolve', async (req, res, next) => {
  try {
    const { uuid } = tableUuidSchema.parse(req.query);
    const session = req.query?.session ? String(req.query.session) : null;
    let table = await resolveTableByUuid(uuid);
    if (!table) return sendError(res, 404, 'Invalid table QR code');
    table = await ensureTableSessionUuid(table);
    if (session && !sessionIsValid(table, session)) {
      return sendError(res, 403, 'QR session expired');
    }
    const orderCount = await loadCurrentSessionOrderCount(table);
    sendOk(res, {
      id: table.id,
      name: table.name,
      tableNumber: table.tableNumber,
      qrCodeUuid: table.qrCodeUuid,
      sessionUuid: table.sessionUuid,
      tableColor: table.tableColor,
      activeOrderNumber: table.activeOrderNumber,
      status: table.status,
      currentPhone: table.currentPhone,
      customerName: table.currentPhone ? await loadLatestCustomerNameByPhone(table.currentPhone) : '',
      openedAt: table.openedAt,
      invoiceRequestedAt: table.invoiceRequestedAt,
      orderCount,
      hasOrders: orderCount > 0
    });
  } catch (error) {
    next(error);
  }
});

publicRouter.get('/qr/:uuid', async (req, res, next) => {
  try {
    const { uuid } = tableUuidSchema.parse({ uuid: req.params.uuid });
    let table = await resolveTableByUuid(uuid);
    if (!table) return sendError(res, 404, 'Invalid table QR code');
    table = await ensureTableSessionUuid(table);

    const redirectUrl = new URL(
      `/qr/${encodeURIComponent(table.qrCodeUuid)}?table=${encodeURIComponent(table.qrCodeUuid)}&session=${encodeURIComponent(table.sessionUuid ?? '')}`,
      getClientOrigin()
    ).toString();

    res.redirect(302, redirectUrl);
  } catch (error) {
    next(error);
  }
});

publicRouter.post('/table/open', async (req, res, next) => {
  try {
    const payload = tablePhoneSchema.parse(req.body);
    const table = await resolveTableByUuid(payload.uuid);
    if (!table) return sendError(res, 404, 'Invalid table QR code');
    const ensuredTable = await ensureTableSessionUuid(table);
    if (!sessionIsValid(ensuredTable, payload.session)) {
      return sendError(res, 403, 'QR session expired');
    }
    const wasNewOpen = !ensuredTable.currentPhone;
    if (ensuredTable.currentPhone && ensuredTable.currentPhone !== payload.phone) {
      return sendError(res, 403, 'الرجاء كتابة الرقم المفتوح به الطاولة');
    }
    await prisma.$executeRaw`
      UPDATE tables
      SET
        current_phone = COALESCE(current_phone, ${payload.phone}),
        opened_at = COALESCE(opened_at, NOW())
      WHERE id = ${ensuredTable.id}
    `;
    const updated = await resolveTableByUuid(payload.uuid);
    const customerName = await loadLatestCustomerNameByPhone(updated.currentPhone ?? payload.phone);
    const subtotal = await loadCurrentSessionSubtotal(updated);
    const vip = await loadVipSummary(updated.currentPhone ?? payload.phone, { sessionUuid: updated.sessionUuid ?? '', subtotal });
    emitDataChanged(req.app.get('io'), { entity: 'table', action: 'open' });
    sendOk(res, {
      id: updated.id,
      name: updated.name,
      tableNumber: updated.tableNumber,
      qrCodeUuid: updated.qrCodeUuid,
      sessionUuid: updated.sessionUuid,
      tableColor: updated.tableColor,
      activeOrderNumber: updated.activeOrderNumber,
      status: updated.status,
      currentPhone: updated.currentPhone,
      customerName,
      openedAt: updated.openedAt,
      invoiceRequestedAt: updated.invoiceRequestedAt,
      vip
    });
  } catch (error) {
    next(error);
  }
});

publicRouter.post('/table/close', async (req, res, next) => {
  try {
    const payload = tableCloseSchema.parse(req.body);
    const table = await resolveTableByUuid(payload.uuid);
    if (!table) return sendError(res, 404, 'Invalid table QR code');
    const ensuredTable = await ensureTableSessionUuid(table);
    const closingPhone = String(payload.phone ?? ensuredTable.currentPhone ?? '').trim();
    const sessionValid = sessionIsValid(ensuredTable, payload.session);
    const hasOpenTable = Boolean(String(ensuredTable.currentPhone ?? '').trim());
    const hasClosingPhone = Boolean(closingPhone);
    if (!sessionValid && !hasOpenTable && !hasClosingPhone) {
      return sendError(res, 403, 'QR session expired');
    }
    let vip = null;
    if (ensuredTable.currentPhone) {
      try {
        const subtotal = await loadCurrentSessionSubtotal(ensuredTable);
        vip = await loadVipSummary(ensuredTable.currentPhone, { sessionUuid: ensuredTable.sessionUuid ?? '', subtotal });
      } catch (vipError) {
        console.error('[closeTable] VIP lookup failed', vipError);
      }
    }

    try {
      const tableOrders = await prisma.order.findMany({
        where: { tableId: ensuredTable.id },
        orderBy: [{ createdAt: 'asc' }],
        include: {
          table: true,
          items: true
        }
      });
      const tableOrderIds = tableOrders.map((order) => order.id);
      const archivedOrderItemRows = tableOrderIds.length ? await prisma.$queryRaw`
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
        WHERE order_id IN (${Prisma.join(tableOrderIds)})
      ` : [];
      const archivedOrderItemsMap = new Map();
      for (const row of archivedOrderItemRows) {
        const list = archivedOrderItemsMap.get(row.orderId) ?? [];
        list.push(row);
        archivedOrderItemsMap.set(row.orderId, list);
      }
      for (const archivedOrder of tableOrders) {
        const orderItemMeta = archivedOrderItemsMap.get(archivedOrder.id) ?? [];
        const payloadData = {
          ...archivedOrder,
          items: archivedOrder.items.map((item) => {
            const match = orderItemMeta.find((row) => row.id === item.id);
            const selectedOptions = match?.selectedOptions ?? item.selectedOptions ?? null;
            const itemType = match?.itemType ?? item.itemType ?? (String(selectedOptions?.itemType ?? '').toLowerCase() === 'offer' ? 'offer' : 'product');
            const offerId = match?.offerId ?? item.offerId ?? selectedOptions?.offerId ?? null;
            const displayNameAr = match?.displayNameAr ?? item.displayNameAr ?? selectedOptions?.displayNameAr ?? selectedOptions?.offerNameAr ?? null;
            const displayNameEn = match?.displayNameEn ?? item.displayNameEn ?? selectedOptions?.displayNameEn ?? selectedOptions?.offerNameEn ?? null;
            const displayImageUrl = match?.displayImageUrl ?? item.displayImageUrl ?? selectedOptions?.displayImageUrl ?? selectedOptions?.offerImageUrl ?? null;
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
          })
        };
        await prisma.$executeRaw`
          INSERT INTO archived_orders (
            order_id,
            table_id,
            table_number,
            table_color,
            session_uuid,
            order_number,
            status,
            source,
            total_amount,
            created_at,
            archived_at,
            payload
          )
          VALUES (
            ${archivedOrder.id},
            ${archivedOrder.tableId},
            ${archivedOrder.table?.tableNumber ?? null},
            ${archivedOrder.table?.tableColor ?? null},
            ${archivedOrder.table?.sessionUuid ?? null},
            ${archivedOrder.orderNumber ?? null},
            ${String(archivedOrder.status ?? '')},
            ${String(archivedOrder.source ?? '')},
            ${archivedOrder.totalAmount},
            ${archivedOrder.createdAt},
            NOW(),
            ${JSON.stringify(payloadData)}::jsonb
          )
          ON CONFLICT (order_id) DO UPDATE SET
            payload = EXCLUDED.payload,
            archived_at = NOW(),
            table_number = EXCLUDED.table_number,
            table_color = EXCLUDED.table_color,
            session_uuid = EXCLUDED.session_uuid,
            order_number = EXCLUDED.order_number,
            status = EXCLUDED.status,
            source = EXCLUDED.source,
            total_amount = EXCLUDED.total_amount,
            created_at = EXCLUDED.created_at
        `;
      }
    } catch (archiveError) {
      console.error('[closeTable] Archive failed', archiveError);
    }
    const nextSessionUuid = createQrUuid();
    try {
      await prisma.$transaction(async (tx) => {
        const [lockedTable] = await tx.$queryRaw`
          SELECT id
          FROM tables
          WHERE id = ${ensuredTable.id}
          FOR UPDATE
        `;
        if (!lockedTable) {
          throw new Error('Table not found during close operation');
        }

        await tx.$executeRaw`
          UPDATE tables
          SET
            session_uuid = ${nextSessionUuid},
            current_phone = NULL,
            opened_at = NULL,
            invoice_requested_at = NULL,
            active_order_number = NULL
          WHERE id = ${ensuredTable.id}
        `;

        if (closingPhone) {
          await tx.$executeRaw`
            UPDATE vip_customer_visits
            SET
              visit_count = 0,
              amount_total = 0,
              reward_status = 'expired',
              reward_visit_count = 0,
              reward_session_uuid = NULL,
              reward_awarded_at = NULL,
              reward_consumed_at = NULL,
              reward_consumed_session_uuid = NULL,
              updated_at = NOW()
            WHERE phone = ${closingPhone}
          `;
        }
      });
    } catch (closeError) {
      console.error('[closeTable] Close transaction failed', closeError);
      await prisma.$executeRaw`
        UPDATE tables
        SET
          session_uuid = ${nextSessionUuid},
          current_phone = NULL,
          opened_at = NULL,
          invoice_requested_at = NULL,
          active_order_number = NULL
        WHERE id = ${ensuredTable.id}
      `;
    }
    const updated = await resolveTableByUuid(payload.uuid) ?? {
      ...ensuredTable,
      sessionUuid: nextSessionUuid,
      currentPhone: null,
      openedAt: null,
      invoiceRequestedAt: null,
      activeOrderNumber: null
    };
    emitDataChanged(req.app.get('io'), { entity: 'table', action: 'close' });
    sendOk(res, {
      id: updated.id,
      name: updated.name,
      tableNumber: updated.tableNumber,
      qrCodeUuid: updated.qrCodeUuid,
      sessionUuid: updated.sessionUuid,
      tableColor: updated.tableColor,
      activeOrderNumber: updated.activeOrderNumber,
      status: updated.status,
      invoiceRequestedAt: updated.invoiceRequestedAt,
      vip
    });
  } catch (error) {
    next(error);
  }
});

publicRouter.post('/orders', async (req, res, next) => {
  try {
    const payload = orderCreateSchema.parse(req.body);
    const table = await resolveTableByUuid(payload.tableUuid);
    if (!table) return sendError(res, 403, 'A valid table QR is required to place an order');
    if (!sessionIsValid(table, payload.session)) {
      console.warn('[public/orders] session mismatch, continuing with tableUuid only', {
        tableUuid: payload.tableUuid,
        tableId: table.id,
        session: payload.session,
        currentPhone: table.currentPhone
      });
    }

    const productIds = payload.items.map((item) => item.productId);
    const uniqueProductIds = [...new Set(productIds)];
    let vipDiscountAmount = 0;
    const products = await prisma.$queryRaw`
      SELECT
        id,
        category_id AS "categoryId",
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
      WHERE id IN (${Prisma.join(uniqueProductIds)})
        AND scope = 'menu'::"MenuScope"
        AND is_available = true
    `;
    if (products.length !== uniqueProductIds.length) {
      return sendError(res, 400, 'One or more products are unavailable');
    }

    const order = await prisma.$transaction(async (tx) => {
      const [lockedTable] = await tx.$queryRaw`
        SELECT id, active_order_number AS "activeOrderNumber"
        FROM tables
        WHERE id = ${table.id}
        FOR UPDATE
      `;
      let orderNumber = Number(lockedTable?.activeOrderNumber ?? 0);
      if (!orderNumber) {
        const [{ nextOrderNumber }] = await tx.$queryRaw`
          SELECT COALESCE(MAX(order_number), 0) + 1 AS "nextOrderNumber"
          FROM orders
        `;
        orderNumber = Number(nextOrderNumber) || 1;
        await tx.$executeRaw`
          UPDATE tables
          SET active_order_number = ${orderNumber}
          WHERE id = ${table.id} AND active_order_number IS NULL
        `;
      }

      const totalAmount = payload.items.reduce((sum, item) => {
        const product = products.find((candidate) => candidate.id === item.productId);
        const selectedOptions = item.selectedOptions ?? {};
        const unitPrice = Number.isFinite(Number(item.unitPrice))
          ? Number(item.unitPrice)
          : calculateProductUnitPrice(product, selectedOptions);
        return sum + (unitPrice * item.quantity);
      }, 0);
      const vipDiscount = table.currentPhone
        ? await loadVipInvoiceDiscount(table.currentPhone, totalAmount)
        : { campaign: null, progress: null, discountAmount: 0, label: '' };
      vipDiscountAmount = Math.max(0, Number(vipDiscount?.discountAmount ?? 0));
      const vipDiscountType = String(vipDiscount?.campaign?.financialDiscountType ?? '');
      const vipDiscountPercentage = Number(vipDiscount?.campaign?.percentage ?? 0);
      const vipDiscountFixedAmount = Number(vipDiscount?.campaign?.fixedAmount ?? 0);
      const discountedTotalAmount = Math.max(0, Number((totalAmount - vipDiscountAmount).toFixed(2)));
      const vipDiscountMeta = vipDiscountAmount > 0
        ? {
            vipDiscountAmount,
            vipDiscountLabel: vipDiscount?.label ?? 'خصم العملاء المميزين',
            vipDiscountType,
            vipDiscountPercentage,
            vipDiscountFixedAmount,
            vipDiscountBaseAmount: totalAmount
          }
        : null;

      const [created] = await tx.$queryRaw`
        INSERT INTO orders (table_id, branch_id, total_amount, source, order_number)
        VALUES (${table.id}, ${table.branchId ?? null}, ${discountedTotalAmount}, 'qr'::"OrderSource", ${orderNumber})
        RETURNING id, order_number AS "orderNumber"
      `;

        for (const [index, item] of payload.items.entries()) {
          const product = products.find((candidate) => candidate.id === item.productId);
          const selectedOptions = item.selectedOptions ?? {};
          const selectedOptionsToSave = index === 0 && vipDiscountMeta
            ? { ...selectedOptions, ...vipDiscountMeta }
            : selectedOptions;
          const unitPrice = Number.isFinite(Number(item.unitPrice))
            ? Number(item.unitPrice)
            : calculateProductUnitPrice(product, selectedOptions);
          const displayMeta = resolveOrderItemDisplay(selectedOptions);
          await tx.$executeRaw`
            INSERT INTO order_items (
              order_id,
              product_id,
              offer_id,
              quantity,
              price_at_sale,
              item_type,
              display_name_ar,
              display_name_en,
              display_image_url,
              selected_options
            )
            VALUES (
              ${created.id},
              ${product.id},
              ${displayMeta.offerId ?? null},
              ${item.quantity},
              ${unitPrice},
              ${displayMeta.itemType},
              ${displayMeta.displayNameAr || null},
              ${displayMeta.displayNameEn || null},
              ${displayMeta.displayImageUrl || null},
              ${JSON.stringify(selectedOptionsToSave ?? {})}::jsonb
            )
          `;
        }

      return created;
    });

    if (table.currentPhone) {
      const vipCampaign = await loadVipCampaign();
      const rewardProductId = Number(vipCampaign?.productRewardId ?? 0);
      const rewardConsumed = Boolean(
        vipCampaign?.isActive
        && vipCampaign?.rewardType === 'product'
        && rewardProductId
        && payload.items.some((item) => Number(item.productId) === rewardProductId && Number(item.unitPrice ?? 0) === 0)
      );
      if (rewardConsumed || vipDiscountAmount > 0) {
        await resetVipCycleByPhone(table.currentPhone);
      }
    }

    req.app.get('io')?.emit('order:new', { tableId: table.id, tableNumber: table.tableNumber, orderId: order.id, orderNumber: order.orderNumber });
    emitDataChanged(req.app.get('io'), { entity: 'order', action: 'create' });
    sendOk(res, { orderId: order.id, orderNumber: order.orderNumber });
  } catch (error) {
    next(error);
  }
});

async function handleInvoiceRequest(req, res, next) {
  try {
    const payload = invoiceRequestSchema.parse(req.body);
    const table = await resolveTableByUuid(payload.tableUuid);
    if (!table) return sendError(res, 403, 'A valid table QR is required to request the bill');
    if (!sessionIsValid(table, payload.session)) {
      return sendError(res, 403, 'QR session expired');
    }

    await prisma.$executeRaw`
      UPDATE tables
      SET invoice_requested_at = NOW()
      WHERE id = ${table.id}
    `;

    req.app.get('io')?.emit('invoice:request:new', {
      tableId: table.id,
      tableNumber: table.tableNumber,
      invoiceRequestedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    });
    emitDataChanged(req.app.get('io'), { entity: 'invoice', action: 'request' });

    sendOk(res, { success: true });
  } catch (error) {
    next(error);
  }
}

async function handleCustomerReview(req, res, next) {
  try {
    const payload = customerReviewSchema.parse(req.body);
    const table = await resolveTableByUuid(payload.tableUuid);
    if (!table) return sendError(res, 403, 'A valid table QR is required to send a review');
    if (!sessionIsValid(table, payload.session)) {
      return sendError(res, 403, 'QR session expired');
    }

    const phone = String(table.currentPhone ?? '').trim();
    if (!phone) {
      return sendError(res, 403, 'Open table phone is required');
    }

    const customerName = String(payload.customerName ?? '').trim();
    const comment = String(payload.comment ?? '').trim();
    const [review] = await prisma.$queryRaw`
      INSERT INTO customer_reviews (
        table_id,
        table_uuid,
        session_uuid,
        table_number,
        table_color,
        phone,
        customer_name,
        rating_mode,
        rating_value,
        comment,
        created_at
      )
      VALUES (
        ${table.id},
        ${table.qrCodeUuid},
        ${table.sessionUuid},
        ${table.tableNumber},
        ${table.tableColor ?? null},
        ${phone},
        ${customerName},
        ${payload.ratingMode},
        ${payload.ratingValue},
        ${comment},
        NOW()
      )
      RETURNING
        id,
        table_id AS "tableId",
        table_uuid AS "tableUuid",
        session_uuid AS "sessionUuid",
        table_number AS "tableNumber",
        table_color AS "tableColor",
        phone,
        customer_name AS "customerName",
        rating_mode AS "ratingMode",
        rating_value AS "ratingValue",
        comment,
        created_at AS "createdAt"
    `;

    req.app.get('io')?.emit('customer:review:new', review);
    emitDataChanged(req.app.get('io'), { entity: 'customer-review', action: 'create' });
    sendOk(res, review);
  } catch (error) {
    next(error);
  }
}

publicRouter.post('/invoice-requests', handleInvoiceRequest);
publicRouter.post('/invoice-request', handleInvoiceRequest);
publicRouter.post('/request-invoice', handleInvoiceRequest);
publicRouter.post('/customer-reviews', handleCustomerReview);

publicRouter.post('/waiter-calls', async (req, res, next) => {
  try {
    const payload = waiterCallCreateSchema.parse(req.body);
    const table = await resolveTableByUuid(payload.tableUuid);
    if (!table) return sendError(res, 403, 'A valid table QR is required to call the waiter');
    if (!sessionIsValid(table, payload.session)) {
      return sendError(res, 403, 'QR session expired');
    }

    const call = await prisma.waiterCall.create({
      data: {
        tableId: table.id
      }
    });

    req.app.get('io')?.emit('waiter:call:new', {
      id: call.id,
      tableId: table.id,
      tableNumber: table.tableNumber,
      status: call.status,
      createdAt: call.createdAt
    });
    emitDataChanged(req.app.get('io'), { entity: 'waiter-call', action: 'create' });

    sendOk(res, { id: call.id });
  } catch (error) {
    next(error);
  }
});

publicRouter.post('/product-views', async (req, res, next) => {
  try {
    const payload = productViewCreateSchema.parse(req.body);
    const table = payload.tableUuid ? await resolveTableByUuid(payload.tableUuid) : null;
    if (table && !sessionIsValid(table, payload.session)) {
      return sendError(res, 403, 'QR session expired');
    }
    const view = await prisma.productView.create({
      data: {
        productId: payload.productId,
        tableId: table?.id ?? null,
        branchId: table?.branchId ?? null,
        customerId: payload.customerId ?? null
      }
    });
    emitDataChanged(req.app.get('io'), { entity: 'product-view', action: 'create' });
    sendOk(res, view);
  } catch (error) {
    next(error);
  }
});
