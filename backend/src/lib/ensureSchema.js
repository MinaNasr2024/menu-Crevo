import { prisma } from './prisma.js';
import { createQrUuid } from './qr.js';

async function tableExists(tableName) {
  const rows = await prisma.$queryRaw`
    SELECT COUNT(*) AS count
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${tableName}
  `;
  return Number(rows?.[0]?.count ?? 0) > 0;
}

async function columnExists(tableName, columnName) {
  const rows = await prisma.$queryRaw`
    SELECT COUNT(*) AS count
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${tableName}
      AND COLUMN_NAME = ${columnName}
  `;
  return Number(rows?.[0]?.count ?? 0) > 0;
}

async function indexExists(tableName, indexName) {
  const rows = await prisma.$queryRaw`
    SELECT COUNT(*) AS count
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${tableName}
      AND INDEX_NAME = ${indexName}
  `;
  return Number(rows?.[0]?.count ?? 0) > 0;
}

async function ensureColumn(tableName, columnName, definition) {
  if (!(await tableExists(tableName))) return;
  if (await columnExists(tableName, columnName)) return;
  await prisma.$executeRawUnsafe(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
}

async function ensureIndex(tableName, indexName, columns) {
  if (!(await tableExists(tableName))) return;
  if (await indexExists(tableName, indexName)) return;
  await prisma.$executeRawUnsafe(`CREATE INDEX \`${indexName}\` ON \`${tableName}\` (${columns})`);
}

export async function ensureSchema() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`site_settings\` (
      \`key\` varchar(191) NOT NULL,
      \`value\` json NOT NULL,
      \`created_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updated_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`key\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await ensureColumn('tables', 'name', 'text');
  await ensureColumn('tables', 'session_uuid', 'text');
  await ensureColumn('tables', 'current_phone', 'text');
  await ensureColumn('tables', 'table_color', 'text');
  await ensureColumn('tables', 'active_order_number', 'integer');
  await ensureColumn('tables', 'opened_at', 'timestamp(3) NULL');
  await ensureColumn('tables', 'invoice_requested_at', 'timestamp(3) NULL');

  await ensureColumn('orders', 'order_number', 'integer');
  await ensureColumn('orders', 'cancel_reason', 'text');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE \`orders\`
    MODIFY COLUMN \`updated_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
  `).catch(() => {});

  await ensureColumn('order_items', 'offer_id', 'integer');
  await ensureColumn('order_items', 'item_type', "varchar(20) NOT NULL DEFAULT 'product'");
  await ensureColumn('order_items', 'display_name_ar', 'text');
  await ensureColumn('order_items', 'display_name_en', 'text');
  await ensureColumn('order_items', 'display_image_url', 'text');

  await ensureColumn('products', 'average_wait_time', 'integer');
  await ensureColumn('products', 'custom_choice_groups', 'json NULL');

  await ensureColumn('archived_orders', 'session_uuid', 'text');

  await ensureIndex('categories', 'idx_categories_scope_active_sort', '`scope`, `is_active`, `sort_order`, `id`');
  await ensureIndex('products', 'idx_products_scope_active_category_sort', '`scope`, `is_available`, `category_id`, `sort_order`, `id`');
  await ensureIndex('products', 'idx_products_featured_scope_sort', '`scope`, `is_featured`, `sort_order`, `id`');
  await ensureIndex('orders', 'idx_orders_table_created', '`table_id`, `created_at`, `id`');
  await ensureIndex('orders', 'idx_orders_status_created', '`status`, `created_at`, `id`');
  await ensureIndex('order_items', 'idx_order_items_order_product', '`order_id`, `product_id`');
  await ensureIndex('tables', 'idx_tables_qr_session', '`qr_code_uuid`, `session_uuid`(191), `status`');
  await ensureIndex('waiter_calls', 'idx_waiter_calls_table_status_created', '`table_id`, `status`, `created_at`');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`offers\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`name_ar\` text NOT NULL,
      \`name_en\` text NOT NULL,
      \`note_ar\` varchar(1000) NOT NULL DEFAULT '',
      \`note_en\` varchar(1000) NOT NULL DEFAULT '',
      \`total_price\` decimal(10,2) NOT NULL DEFAULT 0,
      \`image_url\` varchar(2048) NOT NULL DEFAULT '',
      \`is_active\` boolean NOT NULL DEFAULT true,
      \`created_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updated_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await ensureColumn('offers', 'note_ar', "varchar(1000) NOT NULL DEFAULT ''");
  await ensureColumn('offers', 'note_en', "varchar(1000) NOT NULL DEFAULT ''");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`offer_groups\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`offer_id\` int NOT NULL,
      \`title_ar\` text NOT NULL,
      \`title_en\` text NOT NULL,
      \`selection_mode\` varchar(20) NOT NULL DEFAULT 'checkbox',
      \`min_select\` int NOT NULL DEFAULT 1,
      \`max_select\` int NOT NULL DEFAULT 1,
      \`sort_order\` int NOT NULL DEFAULT 0,
      \`required\` boolean NOT NULL DEFAULT false,
      \`created_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updated_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      CONSTRAINT \`offer_groups_offer_fk\` FOREIGN KEY (\`offer_id\`) REFERENCES \`offers\`(\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`offer_groups_min_le_max\` CHECK (\`min_select\` >= 0 AND \`max_select\` >= \`min_select\`),
      CONSTRAINT \`offer_groups_selection_mode_check\` CHECK (\`selection_mode\` IN ('radio', 'checkbox'))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await ensureColumn('offer_groups', 'selection_mode', "varchar(20) NOT NULL DEFAULT 'checkbox'");
  await ensureColumn('offer_groups', 'required', 'boolean NOT NULL DEFAULT false');
  await ensureIndex('offer_groups', 'idx_offer_groups_offer_sort', '`offer_id`, `sort_order`, `id`');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`offer_group_products\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`group_id\` int NOT NULL,
      \`product_id\` int NOT NULL,
      \`extra_price\` decimal(10,2) NOT NULL DEFAULT 0,
      \`include_product_options\` boolean NOT NULL DEFAULT false,
      \`sort_order\` int NOT NULL DEFAULT 0,
      \`created_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updated_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`offer_group_products_unique\` (\`group_id\`, \`product_id\`),
      CONSTRAINT \`offer_group_products_group_fk\` FOREIGN KEY (\`group_id\`) REFERENCES \`offer_groups\`(\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`offer_group_products_product_fk\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON DELETE RESTRICT,
      CONSTRAINT \`offer_group_products_extra_price_non_negative\` CHECK (\`extra_price\` >= 0)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await ensureColumn('offer_group_products', 'include_product_options', 'boolean NOT NULL DEFAULT false');
  await ensureIndex('offer_group_products', 'idx_offer_group_products_group_sort', '`group_id`, `sort_order`, `id`');
  await ensureIndex('offers', 'idx_offers_active_sort', '`is_active`, `id`');

  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE VIEW \`analytics_product_performance_v\` AS
    SELECT
      p.id AS product_id,
      p.name_ar,
      p.name_en,
      COALESCE(o.order_count, 0) AS order_count,
      COALESCE(o.quantity_sold, 0) AS quantity_sold,
      COALESCE(o.revenue, 0) AS revenue,
      COALESCE(v.view_count, 0) AS view_count,
      COALESCE(r.like_count, 0) AS like_count,
      COALESCE(r.dislike_count, 0) AS dislike_count,
      COALESCE(r.share_count, 0) AS share_count
    FROM products p
    LEFT JOIN (
      SELECT
        product_id,
        COUNT(DISTINCT order_id) AS order_count,
        COALESCE(SUM(quantity), 0) AS quantity_sold,
        COALESCE(SUM(quantity * price_at_sale), 0) AS revenue
      FROM order_items
      WHERE COALESCE(item_type, 'product') <> 'offer'
      GROUP BY product_id
    ) o ON o.product_id = p.id
    LEFT JOIN (
      SELECT product_id, COUNT(*) AS view_count
      FROM product_views
      GROUP BY product_id
    ) v ON v.product_id = p.id
    LEFT JOIN (
      SELECT
        product_id,
        SUM(CASE WHEN reaction = 'liked' THEN 1 ELSE 0 END) AS like_count,
        SUM(CASE WHEN reaction = 'disliked' THEN 1 ELSE 0 END) AS dislike_count,
        SUM(CASE WHEN reaction = 'shared' THEN 1 ELSE 0 END) AS share_count
      FROM product_reactions
      GROUP BY product_id
    ) r ON r.product_id = p.id
  `);

  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE VIEW \`analytics_category_performance_v\` AS
    SELECT
      c.id AS category_id,
      c.name_ar,
      c.name_en,
      COALESCE(pa.product_count, 0) AS product_count,
      COALESCE(oa.revenue, 0) AS revenue,
      COALESCE(oa.quantity_sold, 0) AS quantity_sold,
      COALESCE(va.view_count, 0) AS view_count
    FROM categories c
    LEFT JOIN (
      SELECT category_id, COUNT(*) AS product_count
      FROM products
      GROUP BY category_id
    ) pa ON pa.category_id = c.id
    LEFT JOIN (
      SELECT
        p.category_id,
        COALESCE(SUM(oi.quantity * oi.price_at_sale), 0) AS revenue,
        COALESCE(SUM(oi.quantity), 0) AS quantity_sold
      FROM order_items oi
      INNER JOIN products p ON p.id = oi.product_id
      WHERE COALESCE(oi.item_type, 'product') <> 'offer'
      GROUP BY p.category_id
    ) oa ON oa.category_id = c.id
    LEFT JOIN (
      SELECT
        p.category_id,
        COUNT(*) AS view_count
      FROM product_views pv
      INNER JOIN products p ON p.id = pv.product_id
      GROUP BY p.category_id
    ) va ON va.category_id = c.id
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE order_items
    SET
      item_type = CASE
        WHEN NULLIF(JSON_UNQUOTE(JSON_EXTRACT(selected_options, '$.itemType')), '') IS NOT NULL
          THEN LOWER(JSON_UNQUOTE(JSON_EXTRACT(selected_options, '$.itemType')))
        WHEN item_type IS NULL OR item_type = '' THEN 'product'
        ELSE item_type
      END,
      offer_id = COALESCE(
        offer_id,
        CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(selected_options, '$.offerId')), '') AS SIGNED)
      ),
      display_name_ar = COALESCE(
        NULLIF(display_name_ar, ''),
        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(selected_options, '$.displayNameAr')), ''),
        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(selected_options, '$.offerNameAr')), '')
      ),
      display_name_en = COALESCE(
        NULLIF(display_name_en, ''),
        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(selected_options, '$.displayNameEn')), ''),
        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(selected_options, '$.offerNameEn')), '')
      ),
      display_image_url = COALESCE(
        NULLIF(display_image_url, ''),
        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(selected_options, '$.displayImageUrl')), ''),
        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(selected_options, '$.offerImageUrl')), '')
      )
    WHERE
      display_name_ar IS NULL
      OR display_name_ar = ''
      OR display_name_en IS NULL
      OR display_name_en = ''
      OR display_image_url IS NULL
      OR display_image_url = ''
      OR item_type IS NULL
      OR item_type = ''
      OR item_type = 'product'
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`waiter_complaints\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`table_number\` text NOT NULL,
      \`complaint\` text NOT NULL,
      \`created_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updated_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`customer_reviews\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`table_id\` int NULL,
      \`table_uuid\` text NOT NULL,
      \`session_uuid\` text NULL,
      \`table_number\` text NOT NULL,
      \`table_color\` text NULL,
      \`phone\` text NOT NULL,
      \`customer_name\` text NOT NULL,
      \`rating_mode\` text NOT NULL,
      \`rating_value\` int NOT NULL,
      \`comment\` varchar(1000) NOT NULL DEFAULT '',
      \`created_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      CONSTRAINT \`customer_reviews_rating_mode_check\` CHECK (\`rating_mode\` IN ('stars', 'emoji')),
      CONSTRAINT \`customer_reviews_rating_value_check\` CHECK (\`rating_value\` BETWEEN 1 AND 5),
      CONSTRAINT \`customer_reviews_table_fk\` FOREIGN KEY (\`table_id\`) REFERENCES \`tables\`(\`id\`) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`vip_customer_visits\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`phone\` varchar(191) NOT NULL,
      \`visit_count\` int NOT NULL DEFAULT 0,
      \`amount_total\` decimal(10,2) NOT NULL DEFAULT 0,
      \`reward_status\` varchar(32) NOT NULL DEFAULT 'available',
      \`reward_visit_count\` int NOT NULL DEFAULT 0,
      \`reward_session_uuid\` text NULL,
      \`reward_awarded_at\` timestamp(3) NULL,
      \`reward_consumed_at\` timestamp(3) NULL,
      \`reward_consumed_session_uuid\` text NULL,
      \`last_table_id\` int NULL,
      \`last_table_number\` text NULL,
      \`last_branch_id\` int NULL,
      \`customer_name\` text NULL,
      \`last_visit_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`created_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updated_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`vip_customer_visits_phone_unique\` (\`phone\`),
      CONSTRAINT \`vip_customer_visits_last_table_fk\` FOREIGN KEY (\`last_table_id\`) REFERENCES \`tables\`(\`id\`) ON DELETE SET NULL,
      CONSTRAINT \`vip_customer_visits_last_branch_fk\` FOREIGN KEY (\`last_branch_id\`) REFERENCES \`branches\`(\`id\`) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await ensureColumn('vip_customer_visits', 'reward_visit_count', 'int NOT NULL DEFAULT 0');
  await ensureColumn('vip_customer_visits', 'amount_total', 'decimal(10,2) NOT NULL DEFAULT 0');
  await ensureColumn('vip_customer_visits', 'reward_status', "varchar(32) NOT NULL DEFAULT 'available'");
  await ensureColumn('vip_customer_visits', 'reward_session_uuid', 'text NULL');
  await ensureColumn('vip_customer_visits', 'reward_awarded_at', 'timestamp(3) NULL');
  await ensureColumn('vip_customer_visits', 'reward_consumed_at', 'timestamp(3) NULL');
  await ensureColumn('vip_customer_visits', 'reward_consumed_session_uuid', 'text NULL');
  await ensureIndex('vip_customer_visits', 'idx_vip_customer_visits_visit_count', '`visit_count`, `last_visit_at`');
  await ensureIndex('vip_customer_visits', 'idx_vip_customer_visits_reward_visit_count', '`reward_visit_count`, `last_visit_at`');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`archived_orders\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`order_id\` int NOT NULL,
      \`table_id\` int NULL,
      \`table_number\` text NULL,
      \`table_color\` text NULL,
      \`session_uuid\` text NULL,
      \`order_number\` int NULL,
      \`status\` text NULL,
      \`source\` text NULL,
      \`total_amount\` decimal(10,2) NULL,
      \`created_at\` timestamp(3) NULL,
      \`archived_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`payload\` json NOT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`archived_orders_order_id_unique\` (\`order_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await ensureIndex('archived_orders', 'idx_archived_orders_session_created', '`session_uuid`(191), `archived_at`, `order_id`');
  await ensureIndex('archived_orders', 'idx_archived_orders_table_created', '`table_id`, `archived_at`, `order_id`');
  await ensureIndex('customer_reviews', 'idx_customer_reviews_created', '`created_at`, `id`');
  await ensureIndex('customer_reviews', 'idx_customer_reviews_table_phone', '`table_id`, `phone`(191), `created_at`');
  await ensureIndex('waiter_complaints', 'idx_waiter_complaints_created', '`created_at`, `id`');

  const missingSessionTables = await prisma.$queryRaw`
    SELECT id
    FROM tables
    WHERE session_uuid IS NULL OR session_uuid = ''
  `;
  for (const row of missingSessionTables) {
    await prisma.$executeRaw`
      UPDATE tables
      SET session_uuid = ${createQrUuid()}
      WHERE id = ${row.id}
    `;
  }

  const [{ archivedCount }] = await prisma.$queryRaw`
    SELECT COUNT(*) AS archivedCount
    FROM archived_orders
  `;
  if (Number(archivedCount) === 0) {
    const orders = await prisma.order.findMany({
      orderBy: [{ createdAt: 'asc' }],
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

    for (const order of orders) {
      const payload = {
        ...order,
        items: order.items
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
          ${order.id},
          ${order.tableId},
          ${order.table?.tableNumber ?? null},
          ${order.table?.tableColor ?? null},
          ${order.table?.sessionUuid ?? null},
          ${order.orderNumber ?? null},
          ${String(order.status ?? '')},
          ${String(order.source ?? '')},
          ${order.totalAmount},
          ${order.createdAt},
          NOW(3),
          JSON_EXTRACT(${JSON.stringify(payload)}, '$')
        )
        ON DUPLICATE KEY UPDATE
          payload = VALUES(payload),
          archived_at = VALUES(archived_at),
          table_number = VALUES(table_number),
          table_color = VALUES(table_color),
          session_uuid = VALUES(session_uuid),
          order_number = VALUES(order_number),
          status = VALUES(status),
          source = VALUES(source),
          total_amount = VALUES(total_amount),
          created_at = VALUES(created_at)
      `;
    }
  }
}
