import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { sendOk, sendError } from '../lib/http.js';
import { getCache, setCache } from '../lib/cache.js';

function getDateRange(query = {}) {
  const normalizeDate = (value, fallbackTime = 'start') => {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    const dateOnly = raw.includes('T') ? raw.slice(0, 10) : raw;
    const parsed = new Date(dateOnly);
    if (Number.isNaN(parsed.getTime())) return null;
    const suffix = fallbackTime === 'end' ? '23:59:59.999' : '00:00:00.000';
    return new Date(`${dateOnly}T${suffix}`);
  };
  const end = normalizeDate(query.to, 'end') ?? new Date();
  const start = normalizeDate(query.from, 'start') ?? new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
  return { start, end };
}

function getBranchFilter(branchId) {
  return branchId ? Prisma.sql`AND o.branch_id = ${Number(branchId)}` : Prisma.empty;
}

function getProductFilter(productId) {
  return productId ? Prisma.sql`AND oi.product_id = ${Number(productId)}` : Prisma.empty;
}

function getCustomerFilter(customerId) {
  return customerId ? Prisma.sql`AND o.customer_id = ${Number(customerId)}` : Prisma.empty;
}

function getCategoryFilter(categoryId) {
  return categoryId ? Prisma.sql`AND p.category_id = ${Number(categoryId)}` : Prisma.empty;
}

function toCsv(rows) {
  if (!rows?.length) return '';
  const keys = Object.keys(rows[0]);
  const escapeValue = (value) => {
    if (value === null || value === undefined) return '';
    const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return `"${str.replaceAll('"', '""')}"`;
  };
  return [keys.join(','), ...rows.map((row) => keys.map((key) => escapeValue(row[key])).join(','))].join('\n');
}

async function querySalesSeries(start, end, groupBy, branchId) {
  const dateExpr = groupBy === 'weekly'
    ? Prisma.sql`DATE_TRUNC('week', o.created_at)`
    : groupBy === 'monthly'
      ? Prisma.sql`DATE_TRUNC('month', o.created_at)`
      : groupBy === 'quarterly'
        ? Prisma.sql`DATE_TRUNC('quarter', o.created_at)`
        : groupBy === 'yearly'
          ? Prisma.sql`DATE_TRUNC('year', o.created_at)`
          : Prisma.sql`DATE_TRUNC('day', o.created_at)`;

  return prisma.$queryRaw`
    SELECT
      ${dateExpr} AS period,
      COUNT(*)::int AS total_orders,
      COUNT(*) FILTER (WHERE o.status = 'completed')::int AS completed_orders,
      COUNT(*) FILTER (WHERE o.status = 'cancelled')::int AS cancelled_orders,
      COALESCE(SUM(o.total_amount), 0)::numeric(10,2) AS gross_sales,
      ROUND(AVG(o.total_amount)::numeric, 2) AS average_order_value
    FROM orders o
    WHERE o.created_at BETWEEN ${start} AND ${end}
    ${branchId ? Prisma.sql`AND o.branch_id = ${Number(branchId)}` : Prisma.empty}
    GROUP BY period
    ORDER BY period
  `;
}

function comparePreviousRange(start, end) {
  const span = end.getTime() - start.getTime();
  return {
    previousStart: new Date(start.getTime() - span),
    previousEnd: new Date(start.getTime() - 1)
  };
}

function scoreFrom(value, max, weight = 100) {
  if (max === 0) return 0;
  return Math.max(0, Math.min(weight, Math.round((value / max) * weight)));
}

export const biRouter = Router();

biRouter.get('/executive', async (req, res, next) => {
  try {
    const cacheKey = `bi:executive:${JSON.stringify(req.query ?? {})}`;
    const cached = getCache(cacheKey);
    if (cached) return sendOk(res, cached);

    const { start, end } = getDateRange(req.query);
    const { previousStart, previousEnd } = comparePreviousRange(start, end);
    const [totalRevenueRow, todayRevenueRow, totalOrdersRow, activeOrdersRow, completedOrdersRow, cancelledOrdersRow, avgOrderValueRow, customersRow, returningRow, scansRow, viewsRow, revenueSeries, previousRevenueSeries, reactionCounts, branchRevenue, topProducts] = await Promise.all([
      prisma.$queryRaw`SELECT COALESCE(SUM(total_amount), 0)::numeric(10,2) AS value FROM orders WHERE status <> 'cancelled'`,
      prisma.$queryRaw`SELECT COALESCE(SUM(total_amount), 0)::numeric(10,2) AS value FROM orders WHERE created_at >= CURRENT_DATE AND status <> 'cancelled'`,
      prisma.order.count(),
      prisma.order.count({ where: { status: 'pending' } }),
      prisma.order.count({ where: { status: 'completed' } }),
      prisma.order.count({ where: { status: 'cancelled' } }),
      prisma.$queryRaw`SELECT COALESCE(ROUND(AVG(total_amount)::numeric, 2), 0)::numeric(10,2) AS value FROM orders WHERE status <> 'cancelled'`,
      prisma.customer.count(),
      prisma.$queryRaw`SELECT COUNT(*)::int AS value FROM (SELECT customer_id FROM orders WHERE customer_id IS NOT NULL GROUP BY customer_id HAVING COUNT(*) > 1) t`,
      prisma.qrScan.count(),
      prisma.productView.count(),
      querySalesSeries(start, end, 'daily'),
      querySalesSeries(previousStart, previousEnd, 'daily'),
      prisma.$queryRaw`
        SELECT
          COUNT(*) FILTER (WHERE reaction = 'liked')::int AS liked,
          COUNT(*) FILTER (WHERE reaction = 'disliked')::int AS disliked,
          COUNT(*) FILTER (WHERE reaction = 'shared')::int AS shared
        FROM product_reactions
      `,
      prisma.$queryRaw`
        SELECT COALESCE(b.name_en, 'Unassigned') AS branch_name, COALESCE(SUM(o.total_amount), 0)::numeric(10,2) AS revenue
        FROM orders o
        LEFT JOIN branches b ON b.id = o.branch_id
        WHERE o.created_at BETWEEN ${start} AND ${end}
          AND o.status <> 'cancelled'
        GROUP BY b.name_en
        ORDER BY revenue DESC
      `,
      prisma.$queryRaw`
        SELECT p.id, p.name_en, COALESCE(SUM(oi.quantity), 0)::int AS quantity_sold
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        INNER JOIN products p ON p.id = oi.product_id
        WHERE o.created_at BETWEEN ${start} AND ${end}
          AND o.status <> 'cancelled'
        GROUP BY p.id, p.name_en
        ORDER BY quantity_sold DESC
        LIMIT 5
      `
    ]);

    const totalRevenue = Number(totalRevenueRow[0]?.value ?? 0);
    const todayRevenue = Number(todayRevenueRow[0]?.value ?? 0);
    const totalOrders = Number(totalOrdersRow ?? 0);
    const activeOrders = Number(activeOrdersRow ?? 0);
    const completedOrders = Number(completedOrdersRow ?? 0);
    const cancelledOrders = Number(cancelledOrdersRow ?? 0);
    const averageOrderValue = Number(avgOrderValueRow[0]?.value ?? 0);
    const returningCustomers = Number(returningRow[0]?.value ?? 0);
    const qrScans = Number(scansRow ?? 0);
    const productViews = Number(viewsRow ?? 0);
    const conversionRate = qrScans > 0 ? Number(((totalOrders / qrScans) * 100).toFixed(2)) : 0;
    const retentionRate = customersRow > 0 ? Number(((returningCustomers / customersRow) * 100).toFixed(2)) : 0;

    const currentRevenueWindow = revenueSeries.reduce((sum, item) => sum + Number(item.gross_sales ?? 0), 0);
    const previousRevenueWindow = previousRevenueSeries.reduce((sum, item) => sum + Number(item.gross_sales ?? 0), 0);
    const revenueGrowth = previousRevenueWindow > 0
      ? Number((((currentRevenueWindow - previousRevenueWindow) / previousRevenueWindow) * 100).toFixed(2))
      : 0;

    const likeCount = Number(reactionCounts[0]?.liked ?? 0);
    const dislikeCount = Number(reactionCounts[0]?.disliked ?? 0);
    const satisfactionScore = likeCount + dislikeCount > 0 ? Number(((likeCount / (likeCount + dislikeCount)) * 100).toFixed(1)) : 0;

    const aiInsights = [
      topProducts[0] ? `Best selling product: ${topProducts[0].name_en}` : 'No sales data yet.',
      qrScans > totalOrders ? 'Improve conversion from QR scans to orders.' : 'Conversion rate is healthy.',
      satisfactionScore < 70 ? 'Consider improving product presentation and service speed.' : 'Customer sentiment is positive.',
      branchRevenue[0] ? `Top branch by revenue: ${branchRevenue[0].branch_name}` : 'Branch comparison data is not available yet.'
    ];

    const payload = {
      kpis: {
        totalRevenue,
        todayRevenue,
        weeklyRevenue: Number((await prisma.$queryRaw`SELECT COALESCE(SUM(total_amount), 0)::numeric(10,2) AS value FROM orders WHERE created_at >= NOW() - INTERVAL '7 days' AND status <> 'cancelled'`)[0]?.value ?? 0),
        monthlyRevenue: Number((await prisma.$queryRaw`SELECT COALESCE(SUM(total_amount), 0)::numeric(10,2) AS value FROM orders WHERE created_at >= DATE_TRUNC('month', NOW()) AND status <> 'cancelled'`)[0]?.value ?? 0),
        yearlyRevenue: Number((await prisma.$queryRaw`SELECT COALESCE(SUM(total_amount), 0)::numeric(10,2) AS value FROM orders WHERE created_at >= DATE_TRUNC('year', NOW()) AND status <> 'cancelled'`)[0]?.value ?? 0),
        totalOrders,
        activeOrders,
        completedOrders,
        cancelledOrders,
        averageOrderValue,
        totalCustomers: Number(customersRow ?? 0),
        returningCustomers,
        retentionRate,
        qrScans,
        productViews,
        conversionRate,
        revenueGrowth,
        satisfactionScore
      },
      charts: {
        revenueSeries,
        branchRevenue,
        topProducts
      },
      aiInsights,
      healthScores: {
        businessHealthScore: Number(((revenueGrowth + satisfactionScore + conversionRate) / 3).toFixed(1)),
        growthScore: revenueGrowth,
        revenueScore: scoreFrom(totalRevenue, Math.max(totalRevenue, 1)),
        customerSatisfactionScore: satisfactionScore,
        branchPerformanceScore: scoreFrom(Number(branchRevenue[0]?.revenue ?? 0), Math.max(totalRevenue, 1))
      }
    };
    setCache(cacheKey, payload, 15000);
    sendOk(res, payload);
  } catch (error) {
    next(error);
  }
});

biRouter.get('/sales', async (req, res, next) => {
  try {
    const cacheKey = `bi:sales:${JSON.stringify(req.query ?? {})}`;
    const cached = getCache(cacheKey);
    if (cached) return sendOk(res, cached);

    const { start, end } = getDateRange(req.query);
    const period = String(req.query.period ?? 'daily');
    const { previousStart, previousEnd } = comparePreviousRange(start, end);
    const [series, previousSeries] = await Promise.all([
      querySalesSeries(start, end, period),
      querySalesSeries(previousStart, previousEnd, period)
    ]);

    const currentRevenue = series.reduce((sum, item) => sum + Number(item.gross_sales ?? 0), 0);
    const previousRevenue = previousSeries.reduce((sum, item) => sum + Number(item.gross_sales ?? 0), 0);
    const revenueGrowth = previousRevenue > 0 ? Number((((currentRevenue - previousRevenue) / previousRevenue) * 100).toFixed(2)) : null;

    const payload = {
      period,
      comparison: {
        currentRevenue,
        previousRevenue,
        revenueGrowth,
        revenueDecline: revenueGrowth !== null && revenueGrowth < 0 ? Math.abs(revenueGrowth) : 0,
        profitMargin: currentRevenue > 0 ? Number((((currentRevenue - previousRevenue) / currentRevenue) * 100).toFixed(2)) : 0
      },
      series,
      previousSeries
    };
    setCache(cacheKey, payload, 15000);
    sendOk(res, payload);
  } catch (error) {
    next(error);
  }
});

biRouter.get('/products', async (req, res, next) => {
  try {
    const { start, end } = getDateRange(req.query);
    const [performance, neverOrdered, frequentPairs] = await Promise.all([
      prisma.$queryRaw`
        SELECT * FROM analytics_product_performance_v
        ORDER BY quantity_sold DESC, revenue DESC
      `,
      prisma.$queryRaw`
        SELECT p.id, p.name_en
        FROM products p
        LEFT JOIN order_items oi ON oi.product_id = p.id
        WHERE oi.id IS NULL
        ORDER BY p.id ASC
      `,
      prisma.$queryRaw`
        SELECT
          p1.name_en AS product_a,
          p2.name_en AS product_b,
          COUNT(*)::int AS times_ordered_together
        FROM order_items oi1
        INNER JOIN order_items oi2 ON oi1.order_id = oi2.order_id AND oi1.product_id < oi2.product_id
        INNER JOIN products p1 ON p1.id = oi1.product_id
        INNER JOIN products p2 ON p2.id = oi2.product_id
        INNER JOIN orders o ON o.id = oi1.order_id
        WHERE o.created_at BETWEEN ${start} AND ${end}
        GROUP BY p1.name_en, p2.name_en
        ORDER BY times_ordered_together DESC
        LIMIT 10
      `
    ]);

    const sorted = [...performance];
    const leastOrdered = [...performance].sort((a, b) => Number(a.quantity_sold) - Number(b.quantity_sold)).slice(0, 10);
    const leastViewed = [...performance].sort((a, b) => Number(a.view_count) - Number(b.view_count)).slice(0, 10);
    const mostViewed = [...performance].sort((a, b) => Number(b.view_count) - Number(a.view_count)).slice(0, 10);
    const mostProfitable = [...performance].sort((a, b) => Number(b.revenue) - Number(a.revenue)).slice(0, 10);
    const leastProfitable = [...performance].sort((a, b) => Number(a.revenue) - Number(b.revenue)).slice(0, 10);
    const mostLiked = [...performance].sort((a, b) => Number(b.like_count) - Number(a.like_count)).slice(0, 10);
    const mostDisliked = [...performance].sort((a, b) => Number(b.dislike_count) - Number(a.dislike_count)).slice(0, 10);
    const mostShared = [...performance].sort((a, b) => Number(b.share_count) - Number(a.share_count)).slice(0, 10);

    sendOk(res, {
      topSelling: sorted.slice(0, 10),
      leastOrdered,
      mostViewed,
      leastViewed,
      mostProfitable,
      leastProfitable,
      mostShared,
      mostLiked,
      mostDisliked,
      neverOrdered,
      frequentlyOrderedTogether: frequentPairs
    });
  } catch (error) {
    next(error);
  }
});

biRouter.get('/categories', async (req, res, next) => {
  try {
    const { start, end } = getDateRange(req.query);
    const categories = await prisma.$queryRaw`
      SELECT
        c.id,
        c.name_en,
        c.name_ar,
        COALESCE(SUM(oi.quantity), 0)::int AS quantity_sold,
        COALESCE(SUM(oi.quantity * oi.price_at_sale), 0)::numeric(10,2) AS revenue
      FROM orders o
        INNER JOIN order_items oi ON oi.order_id = o.id
        INNER JOIN products p ON p.id = oi.product_id
        INNER JOIN categories c ON c.id = p.category_id
        WHERE o.created_at BETWEEN ${start} AND ${end}
          AND o.status <> 'cancelled'
          AND COALESCE(oi.item_type, 'product') <> 'offer'
        GROUP BY c.id, c.name_en, c.name_ar
        ORDER BY revenue DESC, quantity_sold DESC
      `;
    const topCategories = [...categories].slice(0, 10);
    const worstCategories = [...categories].slice(-10).reverse();
    const trends = await prisma.$queryRaw`
      SELECT
        DATE_TRUNC('month', o.created_at) AS period,
        c.name_en,
        COALESCE(SUM(oi.quantity * oi.price_at_sale), 0)::numeric(10,2) AS revenue
      FROM orders o
      INNER JOIN order_items oi ON oi.order_id = o.id
      INNER JOIN products p ON p.id = oi.product_id
      INNER JOIN categories c ON c.id = p.category_id
      WHERE o.created_at BETWEEN ${start} AND ${end}
        AND o.status <> 'cancelled'
        AND COALESCE(oi.item_type, 'product') <> 'offer'
      GROUP BY period, c.name_en
      ORDER BY period ASC, revenue DESC
    `;
    sendOk(res, {
      topCategories,
      worstCategories,
      categoryRevenue: categories,
      categoryPopularity: categories.map((row) => ({ category: row.name_en, popularity: Number(row.quantity_sold ?? 0) })),
      performanceTrends: trends
    });
  } catch (error) {
    next(error);
  }
});

biRouter.get('/branches', async (req, res, next) => {
  try {
    const branches = await prisma.$queryRaw`
      WITH order_agg AS (
        SELECT
          branch_id,
          COUNT(*)::int AS branch_orders,
          COALESCE(SUM(total_amount), 0)::numeric(10,2) AS branch_revenue
        FROM orders
        GROUP BY branch_id
      ),
      visitor_agg AS (
        SELECT branch_id, COUNT(*)::int AS branch_visitors
        FROM qr_scans
        GROUP BY branch_id
      ),
      named_branches AS (
        SELECT
          COALESCE(b.name_en, 'Unassigned') AS branch_name,
          COALESCE(oa.branch_orders, 0)::int AS branch_orders,
          COALESCE(oa.branch_revenue, 0)::numeric(10,2) AS branch_revenue,
          COALESCE(va.branch_visitors, 0)::int AS branch_visitors
        FROM branches b
        LEFT JOIN order_agg oa ON oa.branch_id = b.id
        LEFT JOIN visitor_agg va ON va.branch_id = b.id
      ),
      unassigned AS (
        SELECT
          'Unassigned'::text AS branch_name,
          COALESCE((SELECT branch_orders FROM order_agg WHERE branch_id IS NULL), 0)::int AS branch_orders,
          COALESCE((SELECT branch_revenue FROM order_agg WHERE branch_id IS NULL), 0)::numeric(10,2) AS branch_revenue,
          COALESCE((SELECT branch_visitors FROM visitor_agg WHERE branch_id IS NULL), 0)::int AS branch_visitors
      )
      SELECT * FROM named_branches
      UNION ALL
      SELECT * FROM unassigned
      ORDER BY branch_revenue DESC NULLS LAST
    `;
    sendOk(res, {
      compareBranches: branches,
      branchRevenue: branches,
      branchOrders: branches.map((row) => ({ branch: row.branch_name, value: row.branch_orders })),
      branchVisitors: branches.map((row) => ({ branch: row.branch_name, value: row.branch_visitors })),
      branchPerformance: branches,
      branchGrowth: branches.map((row, index) => ({ branch: row.branch_name, growth: Math.max(0, 100 - index * 12) })),
      bestBranch: branches[0] ?? null,
      worstBranch: branches[branches.length - 1] ?? null
    });
  } catch (error) {
    next(error);
  }
});

biRouter.get('/tables', async (req, res, next) => {
  try {
    const tables = await prisma.$queryRaw`SELECT * FROM analytics_table_usage_v ORDER BY order_count DESC`;
    sendOk(res, {
      mostActiveTables: tables.slice(0, 10),
      leastActiveTables: [...tables].reverse().slice(0, 10),
      mostWaiterCalls: [...tables].sort((a, b) => Number(b.waiter_call_count) - Number(a.waiter_call_count)).slice(0, 10),
      averageTableUsage: tables,
      averageCustomerStayDuration: tables.map((row) => ({ table_number: row.table_number, minutes: Number(row.avg_session_minutes ?? 0) }))
    });
  } catch (error) {
    next(error);
  }
});

biRouter.get('/waiters', async (req, res, next) => {
  try {
    const waiters = await prisma.$queryRaw`
      SELECT
        e.id AS waiter_id,
        e.full_name,
        e.role,
        COUNT(DISTINCT o.id)::int AS total_orders,
        COUNT(DISTINCT wc.id)::int AS total_calls,
        COALESCE(AVG(EXTRACT(EPOCH FROM (wc.responded_at - wc.created_at))) FILTER (WHERE wc.responded_at IS NOT NULL), 0)::numeric(10,2) AS response_time_seconds,
        COALESCE(AVG(CASE WHEN wc.status = 'completed' THEN 100 ELSE 60 END), 0)::numeric(10,2) AS customer_satisfaction
      FROM employees e
      LEFT JOIN orders o ON o.waiter_id = e.id
      LEFT JOIN waiter_calls wc ON wc.waiter_id = e.id
      GROUP BY e.id, e.full_name, e.role
      ORDER BY total_orders DESC
    `;
    sendOk(res, {
      totalOrdersPerWaiter: waiters,
      totalCallsPerWaiter: waiters,
      responseTime: waiters.map((row) => ({ waiter: row.full_name, value: Number(row.response_time_seconds ?? 0) })),
      customerSatisfaction: waiters.map((row) => ({ waiter: row.full_name, value: Number(row.customer_satisfaction ?? 0) })),
      bestWaiter: waiters[0] ?? null,
      worstWaiter: waiters[waiters.length - 1] ?? null,
      waiterRanking: waiters
    });
  } catch (error) {
    next(error);
  }
});

biRouter.get('/employees', async (req, res, next) => {
  try {
    const employees = await prisma.$queryRaw`
      SELECT
        e.id AS employee_id,
        e.full_name,
        e.role,
        COALESCE(COUNT(DISTINCT a.id), 0)::int AS attendance,
        COALESCE(SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END), 0)::int AS late_arrivals,
        COALESCE(COUNT(DISTINCT o.id), 0)::int AS completed_tasks,
        COALESCE(SUM(o.total_amount), 0)::numeric(10,2) AS sales_contribution
      FROM employees e
      LEFT JOIN attendance_logs a ON a.employee_id = e.id
      LEFT JOIN orders o ON o.waiter_id = e.id AND o.status = 'completed'
      GROUP BY e.id, e.full_name, e.role
      ORDER BY sales_contribution DESC
    `;
    sendOk(res, {
      attendance: employees,
      lateArrivals: employees.map((row) => ({ employee: row.full_name, value: Number(row.late_arrivals ?? 0) })),
      completedTasks: employees.map((row) => ({ employee: row.full_name, value: Number(row.completed_tasks ?? 0) })),
      salesContribution: employees.map((row) => ({ employee: row.full_name, value: Number(row.sales_contribution ?? 0) })),
      performanceScore: employees.map((row) => ({
        employee: row.full_name,
        value: Math.max(0, 100 - Number(row.late_arrivals ?? 0) * 10 + Number(row.completed_tasks ?? 0))
      })),
      monthlyEvaluation: employees
    });
  } catch (error) {
    next(error);
  }
});

biRouter.get('/customers', async (req, res, next) => {
  try {
    const customers = await prisma.$queryRaw`SELECT * FROM analytics_customer_summary_v ORDER BY lifetime_value DESC`;
    const vipCustomers = customers.filter((row) => Number(row.lifetime_value) >= 1000);
    const topSpenders = [...customers].slice(0, 10);
    const newCustomers = customers.filter((row) => Number(row.order_count) <= 1);
    sendOk(res, {
      newCustomers,
      returningCustomers: customers.filter((row) => Number(row.order_count) > 1),
      vipCustomers,
      topSpendingCustomers: topSpenders,
      customerLifetimeValue: customers.map((row) => ({ customer: row.customer_name, value: Number(row.lifetime_value) })),
      favoriteProducts: [],
      visitFrequency: customers.map((row) => ({ customer: row.customer_name, visits: Number(row.order_count) }))
    });
  } catch (error) {
    next(error);
  }
});

biRouter.get('/time', async (req, res, next) => {
  try {
    const { start, end } = getDateRange(req.query);
    const hourly = await prisma.$queryRaw`
      SELECT EXTRACT(HOUR FROM created_at)::int AS hour, COUNT(*)::int AS orders
      FROM orders
      WHERE created_at BETWEEN ${start} AND ${end}
        AND status <> 'cancelled'
      GROUP BY hour
      ORDER BY hour
    `;
    const daily = await prisma.$queryRaw`
      SELECT TO_CHAR(created_at, 'Day') AS day_name, COUNT(*)::int AS orders
      FROM orders
      WHERE created_at BETWEEN ${start} AND ${end}
        AND status <> 'cancelled'
      GROUP BY day_name
      ORDER BY orders DESC
    `;
    const monthly = await prisma.$queryRaw`
      SELECT TO_CHAR(created_at, 'Mon') AS month_name, COUNT(*)::int AS orders
      FROM orders
      WHERE created_at BETWEEN ${start} AND ${end}
        AND status <> 'cancelled'
      GROUP BY month_name
      ORDER BY orders DESC
    `;
    sendOk(res, {
      orderVolume: hourly,
      peakOrderHours: hourly,
      peakOrderDays: daily,
      peakOrderMonths: monthly,
      peakSeasons: [],
      orderTrends: [],
      orderSources: [],
      mostBusyHour: hourly[0] ?? null,
      leastBusyHour: [...hourly].reverse()[0] ?? null,
      mostBusyDay: daily[0] ?? null,
      leastBusyDay: daily[daily.length - 1] ?? null,
      bestSellingTime: hourly[0] ?? null,
      worstSellingTime: hourly[hourly.length - 1] ?? null,
      customerActivityHeatmaps: hourly
    });
  } catch (error) {
    next(error);
  }
});

biRouter.get('/offers', async (req, res, next) => {
  try {
    const [discountUsage, campaignRevenue] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          COUNT(*)::int AS usage_count,
          COALESCE(SUM(oi.quantity), 0)::int AS qty
        FROM order_items oi
        INNER JOIN products p ON p.id = oi.product_id
        WHERE p.is_discounted = true
          AND COALESCE(oi.item_type, 'product') <> 'offer'
      `,
      prisma.$queryRaw`
        SELECT
          COALESCE(SUM(CASE WHEN p.is_discounted THEN oi.quantity * (p.price - COALESCE(p.discount_price, p.price)) ELSE 0 END), 0)::numeric(10,2) AS campaign_revenue,
          COALESCE(SUM(oi.quantity * oi.price_at_sale), 0)::numeric(10,2) AS gross_revenue
        FROM order_items oi
        INNER JOIN products p ON p.id = oi.product_id
        WHERE COALESCE(oi.item_type, 'product') <> 'offer'
      `
    ]);

    const usage = Number(discountUsage[0]?.usage_count ?? 0);
    const campaignRevenueValue = Number(campaignRevenue[0]?.campaign_revenue ?? 0);
    const grossRevenue = Number(campaignRevenue[0]?.gross_revenue ?? 0);
    sendOk(res, {
      offerUsage: usage,
      couponUsage: 0,
      discountUsage: usage,
      campaignRevenue: campaignRevenueValue,
      campaignROI: grossRevenue > 0 ? Number(((campaignRevenueValue / grossRevenue) * 100).toFixed(2)) : 0,
      bestPerformingPromotion: usage ? 'Product discounts' : null,
      worstPerformingPromotion: null
    });
  } catch (error) {
    next(error);
  }
});

biRouter.get('/inventory', async (req, res, next) => {
  try {
    const inventory = await prisma.$queryRaw`
      SELECT
        p.id AS product_id,
        p.name_en,
        i.stock_level,
        i.low_stock_threshold,
        i.wasted_quantity,
        i.expired_quantity
      FROM inventory_items i
      INNER JOIN products p ON p.id = i.product_id
      ORDER BY i.stock_level ASC
    `;
    sendOk(res, {
      stockLevels: inventory,
      lowStockItems: inventory.filter((item) => Number(item.stock_level) <= Number(item.low_stock_threshold)),
      outOfStockItems: inventory.filter((item) => Number(item.stock_level) <= 0),
      inventoryValue: inventory.reduce((sum, item) => sum + Number(item.stock_level ?? 0), 0),
      inventoryTurnover: inventory.map((item) => ({ product: item.name_en, turnover: Number(item.stock_level ?? 0) })),
      wastedProducts: inventory.map((item) => ({ product: item.name_en, wasted: Number(item.wasted_quantity ?? 0) })),
      expiredProducts: inventory.map((item) => ({ product: item.name_en, expired: Number(item.expired_quantity ?? 0) }))
    });
  } catch (error) {
    next(error);
  }
});

biRouter.get('/expenses', async (req, res, next) => {
  try {
    const expenses = await prisma.expense.findMany({ orderBy: { expenseDate: 'desc' } });
    const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
    const revenue = Number((await prisma.$queryRaw`SELECT COALESCE(SUM(total_amount),0)::numeric(10,2) AS value FROM orders`)[0]?.value ?? 0);
    const grossProfit = revenue;
    const netProfit = revenue - totalExpenses;
    sendOk(res, {
      operationalExpenses: expenses.filter((item) => item.category === 'operational'),
      foodCosts: expenses.filter((item) => item.category === 'food'),
      employeeCosts: expenses.filter((item) => item.category === 'employee'),
      marketingCosts: expenses.filter((item) => item.category === 'marketing'),
      utilityCosts: expenses.filter((item) => item.category === 'utility'),
      maintenanceCosts: expenses.filter((item) => item.category === 'maintenance'),
      netProfit,
      grossProfit,
      expenses
    });
  } catch (error) {
    next(error);
  }
});

biRouter.get('/financial', async (req, res, next) => {
  try {
    const { start, end } = getDateRange(req.query);
    const branchId = req.query.branchId ? Number(req.query.branchId) : null;
    const branchFilter = branchId ? Prisma.sql`AND o.branch_id = ${branchId}` : Prisma.empty;
    const expenseBranchFilter = branchId ? Prisma.sql`AND e.branch_id = ${branchId}` : Prisma.empty;
    const revenue = Number((await prisma.$queryRaw`
      SELECT COALESCE(SUM(o.total_amount),0)::numeric(10,2) AS value
      FROM orders o
      WHERE o.created_at BETWEEN ${start} AND ${end}
      ${branchFilter}
        AND o.status <> 'cancelled'
    `)[0]?.value ?? 0);
    const expenses = Number((await prisma.$queryRaw`
      SELECT COALESCE(SUM(e.amount),0)::numeric(10,2) AS value
      FROM expenses e
      WHERE e.expense_date BETWEEN ${start} AND ${end}
      ${expenseBranchFilter}
    `)[0]?.value ?? 0);
    const taxes = Number((revenue * 0.14).toFixed(2));
    sendOk(res, {
      profitAndLoss: { revenue, expenses, net: revenue - expenses },
      revenueReports: { revenue },
      expenseReports: { expenses },
      cashFlowReports: { inflow: revenue, outflow: expenses, net: revenue - expenses },
      taxReports: { estimatedTax: taxes },
      branchFinancialReports: [],
      grossProfit: revenue,
      netProfit: revenue - expenses
    });
  } catch (error) {
    next(error);
  }
});

biRouter.get('/audit', async (req, res, next) => {
  try {
    const audits = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    sendOk(res, {
      auditLogs: audits,
      whoChangedProductPrices: audits.filter((item) => item.entityType === 'Product' && item.action === 'update'),
      whoDeletedProducts: audits.filter((item) => item.entityType === 'Product' && item.action === 'delete'),
      whoModifiedCategories: audits.filter((item) => item.entityType === 'Category'),
      whoEditedOrders: audits.filter((item) => item.entityType === 'Order'),
      whoChangedPermissions: audits.filter((item) => item.entityType === 'Permission'),
      historicalAuditLogs: audits
    });
  } catch (error) {
    next(error);
  }
});

biRouter.get('/export/:report', async (req, res, next) => {
  try {
    const report = String(req.params.report);
    const format = String(req.query.format ?? 'csv');
    let rows = [];

    if (report === 'executive') {
      const data = await prisma.$queryRaw`SELECT * FROM analytics_daily_sales_mv ORDER BY report_date DESC LIMIT 31`;
      rows = data;
    } else if (report === 'products') {
      const data = await prisma.$queryRaw`SELECT * FROM analytics_product_performance_v ORDER BY quantity_sold DESC`;
      rows = data;
    } else if (report === 'categories') {
      const data = await prisma.$queryRaw`SELECT * FROM analytics_category_performance_v ORDER BY revenue DESC`;
      rows = data;
    } else if (report === 'customers') {
      const data = await prisma.$queryRaw`SELECT * FROM analytics_customer_summary_v ORDER BY lifetime_value DESC`;
      rows = data;
    } else {
      return sendError(res, 404, 'Unknown report');
    }

    if (format === 'print') {
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${report} report</title></head><body><pre>${JSON.stringify(rows, null, 2)}</pre></body></html>`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }

    const csv = toCsv(rows);
    const fileName = `${report}.${format === 'xlsx' ? 'xls' : 'csv'}`;
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', format === 'xlsx' ? 'application/vnd.ms-excel' : 'text/csv; charset=utf-8');
    return res.send(csv);
  } catch (error) {
    next(error);
  }
});
