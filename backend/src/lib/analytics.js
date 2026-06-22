export async function getTopSellingProducts(prisma, from, to) {
  return prisma.$queryRaw`
    SELECT
      p.id,
      p.name_en,
      p.name_ar,
      SUM(oi.quantity)::int AS total_quantity
    FROM order_items oi
    INNER JOIN orders o ON o.id = oi.order_id
    INNER JOIN products p ON p.id = oi.product_id
    WHERE o.created_at >= ${from}
      AND o.created_at <= ${to}
      AND o.status <> 'cancelled'
      AND COALESCE(oi.item_type, 'product') <> 'offer'
    GROUP BY p.id, p.name_en, p.name_ar
    ORDER BY total_quantity DESC
    LIMIT 10
  `;
}

export async function getPeakOrderingHours(prisma, from, to) {
  return prisma.$queryRaw`
    SELECT
      EXTRACT(HOUR FROM o.created_at)::int AS hour_of_day,
      COUNT(*)::int AS order_count,
      COALESCE(SUM(o.total_amount), 0)::numeric(10,2) AS gross_sales
    FROM orders o
    WHERE o.created_at >= ${from}
      AND o.created_at <= ${to}
      AND o.status <> 'cancelled'
    GROUP BY hour_of_day
    ORDER BY hour_of_day
  `;
}

export async function getRevenueAnalytics(prisma, from, to, bucket) {
  return prisma.$queryRaw`
    SELECT
      DATE_TRUNC(${bucket}, o.created_at) AS period,
      COALESCE(SUM(o.total_amount), 0)::numeric(10,2) AS gross_sales,
      ROUND(AVG(o.total_amount)::numeric, 2) AS average_order_value,
      COUNT(*)::int AS order_count
    FROM orders o
    WHERE o.created_at >= ${from}
      AND o.created_at <= ${to}
      AND o.status <> 'cancelled'
    GROUP BY period
    ORDER BY period
  `;
}
