import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { readSiteSettings } from './siteSettings.js';

const defaultVipCampaign = {
  isActive: false,
  targetMode: 'visits',
  targetTrigger: 10,
  targetAmount: 0,
  rewardType: 'product',
  productRewardId: '',
  productRewardTitleAr: '',
  productRewardTitleEn: '',
  financialDiscountType: 'percent',
  percentage: 10,
  fixedAmount: 50,
  popupTitleAr: 'شكراً لزيارتك المتكررة!',
  popupTitleEn: 'Thank you for returning!',
  popupBodyAr: 'في مرتك القادمة ستحصل على هدية خاصة للعملاء المميزين.',
  popupBodyEn: 'On your next visit, you will receive a special VIP reward.'
};

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

function normalizeRewardStatus(value) {
  const status = normalizeText(value).toLowerCase();
  if (!status) return 'available';
  if (['available', 'eligible_and_active', 'expired', 'claimed'].includes(status)) {
    return status;
  }
  return 'available';
}

function isRewardOpenStatus(value) {
  const status = normalizeRewardStatus(value);
  return status === 'available' || status === 'eligible_and_active';
}

export function normalizeVipCampaign(value) {
  const campaign = value && typeof value === 'object' ? value : {};
  const rewardType = normalizeText(campaign.rewardType) === 'financial' ? 'financial' : 'product';
  const financialDiscountType = normalizeText(campaign.financialDiscountType) === 'fixed' ? 'fixed' : 'percent';
  const targetMode = 'visits';
  return {
    isActive: toBoolean(campaign.isActive),
    targetMode,
    targetTrigger: Math.max(1, Math.floor(toNumber(campaign.targetTrigger, defaultVipCampaign.targetTrigger))),
    targetAmount: 0,
    rewardType,
    productRewardId: normalizeText(campaign.productRewardId),
    productRewardTitleAr: normalizeText(campaign.productRewardTitleAr),
    productRewardTitleEn: normalizeText(campaign.productRewardTitleEn),
    financialDiscountType,
    percentage: Math.max(0, toNumber(campaign.percentage, defaultVipCampaign.percentage)),
    fixedAmount: Math.max(0, toNumber(campaign.fixedAmount, defaultVipCampaign.fixedAmount)),
    popupTitleAr: normalizeText(campaign.popupTitleAr) || defaultVipCampaign.popupTitleAr,
    popupTitleEn: normalizeText(campaign.popupTitleEn) || defaultVipCampaign.popupTitleEn,
    popupBodyAr: normalizeText(campaign.popupBodyAr) || defaultVipCampaign.popupBodyAr,
    popupBodyEn: normalizeText(campaign.popupBodyEn) || defaultVipCampaign.popupBodyEn
  };
}

async function getLatestReviewName(phone) {
  const [row] = await prisma.$queryRaw`
    SELECT customer_name AS "customerName"
    FROM customer_reviews
    WHERE phone = ${phone}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return normalizeText(row?.customerName ?? '');
}

export async function loadLatestCustomerNameByPhone(phone) {
  const normalizedPhone = normalizeText(phone);
  if (!normalizedPhone) return '';
  return getLatestReviewName(normalizedPhone);
}

async function getRewardProduct(productId) {
  const numericId = Number(productId);
  if (!Number.isFinite(numericId) || numericId <= 0) return null;
  const [product] = await prisma.$queryRaw`
    SELECT
      id,
      name_ar AS "nameAr",
      name_en AS "nameEn",
      description_ar AS "descriptionAr",
      description_en AS "descriptionEn",
      cover_media_url AS "coverMediaUrl",
      media_type AS "mediaType",
      price,
      discount_price AS "discountPrice",
      is_discounted AS "isDiscounted"
    FROM products
    WHERE id = ${numericId}
    LIMIT 1
  `;
  return product ?? null;
}

export async function loadVipCampaign() {
  const settings = await readSiteSettings();
  return normalizeVipCampaign(settings.vipCampaign ?? defaultVipCampaign);
}

export async function resetVipCycleByPhone(phone) {
  const normalizedPhone = normalizeText(phone);
  if (!normalizedPhone) return;
  await prisma.$executeRaw`
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
    WHERE phone = ${normalizedPhone}
  `;
}

export async function recordVipAmountSpend({ phone, tableId, tableNumber, branchId, subtotal }) {
  const normalizedPhone = normalizeText(phone);
  if (!normalizedPhone) return null;
  const customerName = await getLatestReviewName(normalizedPhone);
  const spendAmount = Math.max(0, Number(subtotal ?? 0));
  await prisma.$executeRaw`
    INSERT INTO vip_customer_visits (
      phone,
      visit_count,
      amount_total,
      reward_status,
      reward_visit_count,
      reward_session_uuid,
      reward_awarded_at,
      reward_consumed_at,
      reward_consumed_session_uuid,
      last_table_id,
      last_table_number,
      last_branch_id,
      customer_name,
      last_visit_at
    )
    VALUES (
      ${normalizedPhone},
      0,
      ${spendAmount},
      'available',
      0,
      NULL,
      NULL,
      NULL,
      NULL,
      ${tableId ?? null},
      ${normalizeText(tableNumber) || null},
      ${branchId ?? null},
      ${customerName || null},
      NOW()
    )
    ON DUPLICATE KEY UPDATE
      amount_total = vip_customer_visits.amount_total + VALUES(amount_total),
      reward_status = CASE
        WHEN COALESCE(vip_customer_visits.reward_status, '') = ''
          OR vip_customer_visits.reward_status IN ('expired', 'claimed')
          OR COALESCE(vip_customer_visits.amount_total, 0) = 0
        THEN 'available'
        ELSE vip_customer_visits.reward_status
      END,
      reward_visit_count = vip_customer_visits.reward_visit_count,
      reward_session_uuid = vip_customer_visits.reward_session_uuid,
      reward_awarded_at = vip_customer_visits.reward_awarded_at,
      reward_consumed_at = vip_customer_visits.reward_consumed_at,
      reward_consumed_session_uuid = vip_customer_visits.reward_consumed_session_uuid,
      last_table_id = VALUES(last_table_id),
      last_table_number = VALUES(last_table_number),
      last_branch_id = VALUES(last_branch_id),
      customer_name = COALESCE(NULLIF(VALUES(customer_name), ''), vip_customer_visits.customer_name),
      last_visit_at = NOW(),
      updated_at = NOW()
  `;
  const [visit] = await prisma.$queryRaw`
    SELECT
      id,
      phone,
      visit_count AS "visitCount",
      amount_total AS "amountTotal",
      reward_status AS "rewardStatus",
      reward_visit_count AS "rewardVisitCount",
      reward_session_uuid AS "rewardSessionUuid",
      reward_awarded_at AS "rewardAwardedAt",
      reward_consumed_at AS "rewardConsumedAt",
      reward_consumed_session_uuid AS "rewardConsumedSessionUuid",
      last_table_id AS "lastTableId",
      last_table_number AS "lastTableNumber",
      last_branch_id AS "lastBranchId",
      customer_name AS "customerName",
      last_visit_at AS "lastVisitAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM vip_customer_visits
    WHERE phone = ${normalizedPhone}
    LIMIT 1
  `;
  return visit ?? null;
}

export async function recordVipVisit({ phone, tableId, tableNumber, branchId }) {
  const normalizedPhone = normalizeText(phone);
  if (!normalizedPhone) return null;
  const customerName = await getLatestReviewName(normalizedPhone);
  await prisma.$executeRaw`
    INSERT INTO vip_customer_visits (
      phone,
      visit_count,
      reward_status,
      reward_visit_count,
      reward_session_uuid,
      reward_awarded_at,
      reward_consumed_at,
      reward_consumed_session_uuid,
      last_table_id,
      last_table_number,
      last_branch_id,
      customer_name,
      last_visit_at
    )
    VALUES (
      ${normalizedPhone},
      1,
      'available',
      0,
      NULL,
      NULL,
      NULL,
      NULL,
      ${tableId ?? null},
      ${normalizeText(tableNumber) || null},
      ${branchId ?? null},
      ${customerName || null},
      NOW()
    )
    ON DUPLICATE KEY UPDATE
      visit_count = vip_customer_visits.visit_count + 1,
      reward_status = CASE
        WHEN COALESCE(vip_customer_visits.visit_count, 0) = 0 THEN 'available'
        WHEN NULLIF(vip_customer_visits.reward_status, '') IS NULL THEN 'available'
        WHEN vip_customer_visits.reward_status IN ('expired', 'claimed') THEN 'available'
        ELSE vip_customer_visits.reward_status
      END,
      reward_visit_count = vip_customer_visits.reward_visit_count,
      reward_session_uuid = vip_customer_visits.reward_session_uuid,
      reward_awarded_at = vip_customer_visits.reward_awarded_at,
      reward_consumed_at = vip_customer_visits.reward_consumed_at,
      reward_consumed_session_uuid = vip_customer_visits.reward_consumed_session_uuid,
      last_table_id = VALUES(last_table_id),
      last_table_number = VALUES(last_table_number),
      last_branch_id = VALUES(last_branch_id),
      customer_name = COALESCE(NULLIF(VALUES(customer_name), ''), vip_customer_visits.customer_name),
      last_visit_at = NOW(),
      updated_at = NOW()
  `;
  const [visit] = await prisma.$queryRaw`
    SELECT
      id,
      phone,
      visit_count AS "visitCount",
      amount_total AS "amountTotal",
      reward_status AS "rewardStatus",
      reward_visit_count AS "rewardVisitCount",
      reward_session_uuid AS "rewardSessionUuid",
      reward_awarded_at AS "rewardAwardedAt",
      reward_consumed_at AS "rewardConsumedAt",
      reward_consumed_session_uuid AS "rewardConsumedSessionUuid",
      last_table_id AS "lastTableId",
      last_table_number AS "lastTableNumber",
      last_branch_id AS "lastBranchId",
      customer_name AS "customerName",
      last_visit_at AS "lastVisitAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM vip_customer_visits
    WHERE phone = ${normalizedPhone}
    LIMIT 1
  `;
  return visit ?? null;
}

export async function loadVipSummary(phone, { sessionUuid = '', subtotal = 0 } = {}) {
  const campaign = await loadVipCampaign();
  const normalizedPhone = normalizeText(phone);
  if (!normalizedPhone) {
    return {
      campaign,
      progress: null,
      rewardProduct: null
    };
  }

  const [visit] = await prisma.$queryRaw`
    SELECT
      id,
      phone,
      visit_count AS "visitCount",
      amount_total AS "amountTotal",
      reward_status AS "rewardStatus",
      reward_visit_count AS "rewardVisitCount",
      reward_session_uuid AS "rewardSessionUuid",
      reward_awarded_at AS "rewardAwardedAt",
      reward_consumed_at AS "rewardConsumedAt",
      reward_consumed_session_uuid AS "rewardConsumedSessionUuid",
      last_table_id AS "lastTableId",
      last_table_number AS "lastTableNumber",
      last_branch_id AS "lastBranchId",
      customer_name AS "customerName",
      last_visit_at AS "lastVisitAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM vip_customer_visits
    WHERE phone = ${normalizedPhone}
    LIMIT 1
  `;

  if (!visit) {
    const targetMode = normalizeText(campaign.targetMode) === 'amount' ? 'amount' : 'visits';
    const target = Math.max(1, Number(campaign.targetTrigger ?? 10));
    const targetAmount = Math.max(0, Number(campaign.targetAmount ?? 0));
    const numericSubtotal = Math.max(0, Number(subtotal ?? 0));
    const rewardUnlocked = targetMode === 'amount'
      ? numericSubtotal >= targetAmount && targetAmount > 0
      : false;
    return {
      campaign,
      progress: {
        phone: normalizedPhone,
        visitCount: 0,
        amountTotal: 0,
        targetTrigger: target,
        targetMode,
        targetAmount,
        remaining: targetMode === 'amount'
          ? Math.max(0, targetAmount - numericSubtotal)
          : target,
        stage: rewardUnlocked ? 'reward' : 'none',
        isNearTarget: false,
        isRewardActive: rewardUnlocked,
        rewardType: campaign.rewardType,
        rewardStatus: rewardUnlocked ? 'eligible_and_active' : 'available',
        rewardSessionUuid: '',
        rewardConsumedAt: null,
        rewardConsumedSessionUuid: '',
        discount: rewardUnlocked && campaign.rewardType === 'financial'
          ? {
            type: campaign.financialDiscountType,
            percentage: Number(campaign.percentage ?? 0),
            fixedAmount: Number(campaign.fixedAmount ?? 0)
          }
          : null
      },
      rewardProduct: rewardUnlocked && campaign.rewardType === 'product'
        ? await getRewardProduct(campaign.productRewardId)
        : null
    };
  }

  const target = Math.max(1, Number(campaign.targetTrigger ?? 10));
  const targetAmount = Math.max(0, Number(campaign.targetAmount ?? 0));
  const targetMode = normalizeText(campaign.targetMode) === 'amount' ? 'amount' : 'visits';
  const visitCount = Number(visit.visitCount ?? 0);
  const amountTotal = Math.max(0, Number(visit.amountTotal ?? 0));
  const rewardStatus = normalizeRewardStatus(visit.rewardStatus ?? 'available');
  const rewardVisitCount = Number(visit.rewardVisitCount ?? 0);
  const rewardSessionUuid = normalizeText(visit.rewardSessionUuid ?? '');
  const rewardConsumedSessionUuid = normalizeText(visit.rewardConsumedSessionUuid ?? '');
  const rewardConsumedAt = visit.rewardConsumedAt ?? null;
  const numericSubtotal = Math.max(0, Number(subtotal ?? 0));
  const amountProgress = amountTotal + numericSubtotal;
  const remaining = targetMode === 'amount'
    ? Math.max(0, targetAmount - amountProgress)
    : Math.max(0, target - visitCount);
  const currentSessionUuid = normalizeText(sessionUuid);
  const isRewardUnlocked = targetMode === 'amount'
    ? amountProgress >= targetAmount && targetAmount > 0
    : visitCount >= target;
  const canShowReward = campaign.isActive && isRewardOpenStatus(rewardStatus) && isRewardUnlocked;
  const isStaleCycle = targetMode === 'amount'
    ? false
    : visitCount > target || (!isRewardOpenStatus(rewardStatus) && visitCount >= target);

  if (isStaleCycle) {
    await resetVipCycleByPhone(normalizedPhone);
    return {
      campaign,
      progress: {
        phone: normalizedPhone,
        visitCount: 0,
        targetTrigger: target,
        targetMode,
        targetAmount,
        remaining: targetMode === 'amount' ? targetAmount : target,
        stage: 'none',
        isNearTarget: false,
        isRewardActive: false,
        rewardType: campaign.rewardType,
        rewardStatus: 'expired',
        rewardSessionUuid: '',
        rewardConsumedAt: null,
        rewardConsumedSessionUuid: '',
        discount: null
      },
      rewardProduct: null
    };
  }

  let stage = 'none';
  if (campaign.isActive) {
    if (canShowReward) {
      stage = 'reward';
      if (currentSessionUuid && rewardSessionUuid !== currentSessionUuid) {
        await prisma.$executeRaw`
          UPDATE vip_customer_visits
          SET
            reward_status = 'eligible_and_active',
            reward_visit_count = ${visitCount},
            reward_session_uuid = ${currentSessionUuid},
            reward_awarded_at = NOW(),
            reward_consumed_at = NULL,
            reward_consumed_session_uuid = NULL,
            updated_at = NOW()
          WHERE phone = ${normalizedPhone}
        `;
      }
    } else if (visitCount >= target) {
      stage = isRewardOpenStatus(rewardStatus) ? 'reward' : 'none';
    } else if (visitCount < target && remaining <= 2) {
      stage = isRewardOpenStatus(rewardStatus) ? 'near' : 'none';
    }
  }

  const rewardProduct = canShowReward && campaign.rewardType === 'product'
    ? await getRewardProduct(campaign.productRewardId)
    : null;
  const discount = canShowReward && campaign.rewardType === 'financial'
    ? {
      type: campaign.financialDiscountType,
      percentage: Number(campaign.percentage ?? 0),
      fixedAmount: Number(campaign.fixedAmount ?? 0)
    }
    : null;

  return {
    campaign,
    progress: {
      phone: normalizedPhone,
      visitCount,
      amountTotal,
      targetTrigger: target,
      targetMode,
      targetAmount,
      remaining,
      stage,
      isNearTarget: targetMode === 'amount'
        ? amountProgress >= Math.max(0, targetAmount - Math.min(100, targetAmount * 0.1))
        : visitCount >= Math.max(1, target - 2),
      isRewardActive: canShowReward,
      rewardType: campaign.rewardType,
      rewardStatus,
      rewardSessionUuid,
      rewardConsumedAt,
      rewardConsumedSessionUuid,
      discount
    },
    rewardProduct
  };
}

export async function loadVipCustomers() {
  const campaign = await loadVipCampaign();
  const targetMode = normalizeText(campaign.targetMode) === 'amount' ? 'amount' : 'visits';
  const target = Math.max(1, Number(campaign.targetTrigger ?? 10));
  const targetAmount = Math.max(0, Number(campaign.targetAmount ?? 0));
  const threshold = targetMode === 'amount' ? Math.max(0, targetAmount * 0.9) : Math.max(1, target - 2);

  async function readVipCustomersSnapshot() {
    return Promise.all([
      prisma.$queryRaw`
        SELECT
          v.id,
          v.phone,
          v.visit_count AS "visitCount",
          v.amount_total AS "amountTotal",
          v.reward_status AS "rewardStatus",
          v.last_table_number AS "lastTableNumber",
          v.last_visit_at AS "lastVisitAt",
          COALESCE(
            NULLIF(v.customer_name, ''),
            (
              SELECT cr.customer_name
              FROM customer_reviews cr
              WHERE cr.phone = v.phone
              ORDER BY cr.created_at DESC
              LIMIT 1
            ),
            ''
          ) AS "customerName"
        FROM vip_customer_visits v
        WHERE ${targetMode === 'amount' ? Prisma.sql`v.amount_total > 0` : Prisma.sql`v.visit_count > 0`}
        ORDER BY ${targetMode === 'amount' ? Prisma.sql`v.amount_total` : Prisma.sql`v.visit_count`} DESC, v.last_visit_at DESC
      `,
      prisma.$queryRaw`
        SELECT COUNT(*) AS value
        FROM vip_customer_visits
        WHERE ${targetMode === 'amount' ? Prisma.sql`amount_total > 0` : Prisma.sql`visit_count > 0`}
      `,
      prisma.$queryRaw`
        SELECT COUNT(*) AS value
        FROM vip_customer_visits
        WHERE ${targetMode === 'amount' ? Prisma.sql`amount_total >= ${threshold}` : Prisma.sql`visit_count >= ${threshold}`}
      `,
      prisma.$queryRaw`
        SELECT COUNT(*) AS value
        FROM vip_customer_visits
        WHERE ${targetMode === 'amount' ? Prisma.sql`amount_total >= ${targetAmount}` : Prisma.sql`visit_count > ${target}`}
      `
    ]);
  }

  let [customers, totalRows, eligibleRows, rewardedRows] = await readVipCustomersSnapshot();

  const stalePhones = customers
    .filter((row) => {
      const visitCount = Number(row.visitCount ?? 0);
      const amountTotal = Math.max(0, Number(row.amountTotal ?? 0));
      const rewardStatus = normalizeRewardStatus(row.rewardStatus ?? 'available');
      return targetMode === 'amount'
        ? false
        : (visitCount > target || (!isRewardOpenStatus(rewardStatus) && visitCount >= target));
    })
    .map((row) => row.phone)
    .filter(Boolean);

  if (stalePhones.length) {
    await Promise.all(stalePhones.map((phone) => resetVipCycleByPhone(phone)));
    [customers, totalRows, eligibleRows, rewardedRows] = await readVipCustomersSnapshot();
  }

  return {
    campaign,
    stats: {
      totalCustomers: Number(totalRows[0]?.value ?? 0),
      eligibleCustomers: Number(eligibleRows[0]?.value ?? 0),
      rewardedCustomers: Number(rewardedRows[0]?.value ?? 0)
    },
    customers: customers.map((row) => {
      const visitCount = Number(row.visitCount ?? 0);
      const amountTotal = Math.max(0, Number(row.amountTotal ?? 0));
      const rewardStatus = normalizeRewardStatus(row.rewardStatus ?? 'available');
      const isAmountMode = targetMode === 'amount';
      const currentMetric = isAmountMode ? amountTotal : visitCount;
      const goalMetric = isAmountMode ? targetAmount : target;
      const isRewardReady = currentMetric >= goalMetric && isRewardOpenStatus(rewardStatus) && goalMetric > 0;
      const isStaleCycle = isAmountMode
        ? false
        : currentMetric > goalMetric || (!isRewardOpenStatus(rewardStatus) && currentMetric >= goalMetric);
      const displayVisitCount = isAmountMode ? amountTotal : (isRewardReady ? 0 : (isStaleCycle ? 0 : visitCount));
      return {
        id: Number(row.id),
        phone: row.phone,
        customerName: normalizeText(row.customerName),
        visitCount: displayVisitCount,
        amountTotal,
        lastTableNumber: row.lastTableNumber ?? '',
        lastVisitAt: row.lastVisitAt ?? null,
        isNearTarget: isAmountMode
          ? !isStaleCycle && !isRewardReady && amountTotal >= Math.max(0, targetAmount * 0.9)
          : !isStaleCycle && !isRewardReady && visitCount >= threshold,
        isRewardReady: isRewardReady,
        remaining: isAmountMode
          ? (isRewardReady || isStaleCycle ? targetAmount : Math.max(0, targetAmount - amountTotal))
          : (isRewardReady || isStaleCycle ? target : Math.max(0, target - visitCount)),
        rewardStage: isStaleCycle
          ? 'none'
          : isRewardReady
            ? 'reward'
            : isAmountMode
              ? 'near'
              : visitCount >= target
              ? 'reward'
              : visitCount >= threshold
                ? 'near'
                : 'none'
      };
    })
  };
}

export async function loadVipInvoiceDiscount(phone, subtotal = 0) {
  const summary = await loadVipSummary(phone, { subtotal });
  const { campaign, progress } = summary;
  if (!campaign.isActive || !progress || campaign.rewardType !== 'financial') {
    return { campaign, progress, discountAmount: 0, label: '' };
  }
  const targetMode = String(progress.targetMode ?? campaign.targetMode ?? 'visits');
  const targetTrigger = Math.max(1, Number(progress.targetTrigger ?? campaign.targetTrigger ?? 10));
  const targetAmount = Math.max(0, Number(progress.targetAmount ?? campaign.targetAmount ?? 0));
  const subtotalAmount = Math.max(0, Number(subtotal ?? 0));
  const amountTotal = Math.max(0, Number(progress.amountTotal ?? 0));
  const eligible = targetMode === 'amount'
    ? (amountTotal + subtotalAmount) >= targetAmount && targetAmount > 0
    : Number(progress.visitCount ?? 0) >= targetTrigger;
  if (!eligible) {
    return { campaign, progress, discountAmount: 0, label: '' };
  }
  const baseSubtotal = Math.max(0, Number(subtotal ?? 0));
  const discountAmount = campaign.financialDiscountType === 'fixed'
    ? Math.min(Number(campaign.fixedAmount ?? 0), baseSubtotal)
    : Math.min(Number(((baseSubtotal * Number(campaign.percentage ?? 0)) / 100).toFixed(2)), baseSubtotal);
  return {
    campaign,
    progress,
    discountAmount,
    label: 'خصم العملاء المميزين'
  };
}
