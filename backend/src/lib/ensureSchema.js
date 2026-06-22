import { prisma } from './prisma.js';
import { createQrUuid } from './qr.js';

export async function ensureSchema() {
  const statements = [
    'CREATE TABLE IF NOT EXISTS "site_settings" ("key" text PRIMARY KEY, "value" jsonb NOT NULL DEFAULT \'{}\'::jsonb, "created_at" timestamp(3) NOT NULL DEFAULT NOW(), "updated_at" timestamp(3) NOT NULL DEFAULT NOW())',
    'ALTER TABLE "tables" ADD COLUMN IF NOT EXISTS "name" text',
    'ALTER TABLE "tables" ADD COLUMN IF NOT EXISTS "session_uuid" text',
    'ALTER TABLE "tables" ADD COLUMN IF NOT EXISTS "current_phone" text',
    'ALTER TABLE "tables" ADD COLUMN IF NOT EXISTS "table_color" text',
    'ALTER TABLE "tables" ADD COLUMN IF NOT EXISTS "active_order_number" integer',
    'ALTER TABLE "tables" ADD COLUMN IF NOT EXISTS "opened_at" timestamp(3)',
    'ALTER TABLE "tables" ADD COLUMN IF NOT EXISTS "invoice_requested_at" timestamp(3)',
    'ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "order_number" integer',
    'ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cancel_reason" text',
    'ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "offer_id" integer',
    'ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "item_type" text NOT NULL DEFAULT \'product\'',
    'ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "display_name_ar" text',
    'ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "display_name_en" text',
    'ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "display_image_url" text',
    'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "average_wait_time" integer',
    'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "custom_choice_groups" jsonb DEFAULT \'[]\'::jsonb',
    'ALTER TABLE "products" ALTER COLUMN "custom_choice_groups" SET DEFAULT \'[]\'::jsonb',
    'UPDATE "products" SET "custom_choice_groups" = \'[]\'::jsonb WHERE "custom_choice_groups" IS NULL',
    'ALTER TABLE "archived_orders" ADD COLUMN IF NOT EXISTS "session_uuid" text',
    'CREATE INDEX IF NOT EXISTS "idx_categories_scope_active_sort" ON "categories" ("scope", "is_active", "sort_order", "id")',
    'CREATE INDEX IF NOT EXISTS "idx_products_scope_active_category_sort" ON "products" ("scope", "is_available", "category_id", "sort_order", "id")',
    'CREATE INDEX IF NOT EXISTS "idx_products_featured_scope_sort" ON "products" ("scope", "is_featured", "sort_order", "id")',
    'CREATE INDEX IF NOT EXISTS "idx_orders_table_created" ON "orders" ("table_id", "created_at", "id")',
    'CREATE INDEX IF NOT EXISTS "idx_orders_status_created" ON "orders" ("status", "created_at", "id")',
    'CREATE INDEX IF NOT EXISTS "idx_order_items_order_product" ON "order_items" ("order_id", "product_id")',
    'CREATE INDEX IF NOT EXISTS "idx_tables_qr_session" ON "tables" ("qr_code_uuid", "session_uuid", "status")',
    'CREATE INDEX IF NOT EXISTS "idx_waiter_calls_table_status_created" ON "waiter_calls" ("table_id", "status", "created_at")',
    'CREATE TABLE IF NOT EXISTS "offers" ("id" SERIAL PRIMARY KEY, "name_ar" text NOT NULL, "name_en" text NOT NULL, "note_ar" text NOT NULL DEFAULT \'\', "note_en" text NOT NULL DEFAULT \'\', "total_price" numeric(10,2) NOT NULL DEFAULT 0, "image_url" text NOT NULL DEFAULT \'\', "is_active" boolean NOT NULL DEFAULT true, "created_at" timestamp(3) NOT NULL DEFAULT NOW(), "updated_at" timestamp(3) NOT NULL DEFAULT NOW())',
    'ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "note_ar" text NOT NULL DEFAULT \'\'',
    'ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "note_en" text NOT NULL DEFAULT \'\'',
    `CREATE TABLE IF NOT EXISTS "offer_groups" ("id" SERIAL PRIMARY KEY, "offer_id" integer NOT NULL REFERENCES "offers"("id") ON DELETE CASCADE, "title_ar" text NOT NULL, "title_en" text NOT NULL, "selection_mode" text NOT NULL DEFAULT 'checkbox', "min_select" integer NOT NULL DEFAULT 1, "max_select" integer NOT NULL DEFAULT 1, "sort_order" integer NOT NULL DEFAULT 0, "required" boolean NOT NULL DEFAULT false, "created_at" timestamp(3) NOT NULL DEFAULT NOW(), "updated_at" timestamp(3) NOT NULL DEFAULT NOW(), CONSTRAINT "offer_groups_min_le_max" CHECK ("min_select" >= 0 AND "max_select" >= "min_select"), CONSTRAINT "offer_groups_selection_mode_check" CHECK ("selection_mode" IN ('radio', 'checkbox')))`,
    'ALTER TABLE "offer_groups" ADD COLUMN IF NOT EXISTS "selection_mode" text NOT NULL DEFAULT \'checkbox\'',
    'ALTER TABLE "offer_groups" ADD COLUMN IF NOT EXISTS "required" boolean NOT NULL DEFAULT false',
    'CREATE TABLE IF NOT EXISTS "offer_group_products" ("id" SERIAL PRIMARY KEY, "group_id" integer NOT NULL REFERENCES "offer_groups"("id") ON DELETE CASCADE, "product_id" integer NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT, "extra_price" numeric(10,2) NOT NULL DEFAULT 0, "include_product_options" boolean NOT NULL DEFAULT false, "sort_order" integer NOT NULL DEFAULT 0, "created_at" timestamp(3) NOT NULL DEFAULT NOW(), "updated_at" timestamp(3) NOT NULL DEFAULT NOW(), CONSTRAINT "offer_group_products_unique" UNIQUE ("group_id", "product_id"), CONSTRAINT "offer_group_products_extra_price_non_negative" CHECK ("extra_price" >= 0))',
    'ALTER TABLE "offer_group_products" ADD COLUMN IF NOT EXISTS "include_product_options" boolean NOT NULL DEFAULT false',
    'CREATE INDEX IF NOT EXISTS "idx_offers_active_sort" ON "offers" ("is_active", "id")',
    'CREATE INDEX IF NOT EXISTS "idx_offer_groups_offer_sort" ON "offer_groups" ("offer_id", "sort_order", "id")',
    'CREATE INDEX IF NOT EXISTS "idx_offer_group_products_group_sort" ON "offer_group_products" ("group_id", "sort_order", "id")',
  ];

  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
  }

  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE VIEW "analytics_product_performance_v" AS
    WITH order_agg AS (
      SELECT
        product_id,
        COUNT(DISTINCT order_id)::int AS order_count,
        COALESCE(SUM(quantity), 0)::int AS quantity_sold,
        COALESCE(SUM(quantity * price_at_sale), 0)::numeric(10,2) AS revenue
      FROM order_items
      WHERE COALESCE(item_type, 'product') <> 'offer'
      GROUP BY product_id
    ),
    view_agg AS (
      SELECT product_id, COUNT(*)::int AS view_count
      FROM product_views
      GROUP BY product_id
    ),
    reaction_agg AS (
      SELECT
        product_id,
        COUNT(*) FILTER (WHERE reaction = 'liked')::int AS like_count,
        COUNT(*) FILTER (WHERE reaction = 'disliked')::int AS dislike_count,
        COUNT(*) FILTER (WHERE reaction = 'shared')::int AS share_count
      FROM product_reactions
      GROUP BY product_id
    )
    SELECT
      p.id AS product_id,
      p.name_ar,
      p.name_en,
      COALESCE(o.order_count, 0)::int AS order_count,
      COALESCE(o.quantity_sold, 0)::int AS quantity_sold,
      COALESCE(o.revenue, 0)::numeric(10,2) AS revenue,
      COALESCE(v.view_count, 0)::int AS view_count,
      COALESCE(r.like_count, 0)::int AS like_count,
      COALESCE(r.dislike_count, 0)::int AS dislike_count,
      COALESCE(r.share_count, 0)::int AS share_count
    FROM products p
    LEFT JOIN order_agg o ON o.product_id = p.id
    LEFT JOIN view_agg v ON v.product_id = p.id
    LEFT JOIN reaction_agg r ON r.product_id = p.id
  `);

  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE VIEW "analytics_category_performance_v" AS
    WITH product_base AS (
      SELECT id, category_id FROM products
    ),
    order_agg AS (
      SELECT
        p.category_id,
        COALESCE(SUM(oi.quantity * oi.price_at_sale), 0)::numeric(10,2) AS revenue,
        COALESCE(SUM(oi.quantity), 0)::int AS quantity_sold
      FROM order_items oi
      INNER JOIN products p ON p.id = oi.product_id
      WHERE COALESCE(oi.item_type, 'product') <> 'offer'
      GROUP BY p.category_id
    ),
    view_agg AS (
      SELECT
        p.category_id,
        COUNT(*)::int AS view_count
      FROM product_views pv
      INNER JOIN products p ON p.id = pv.product_id
      GROUP BY p.category_id
    ),
    product_agg AS (
      SELECT category_id, COUNT(*)::int AS product_count
      FROM product_base
      GROUP BY category_id
    )
    SELECT
      c.id AS category_id,
      c.name_ar,
      c.name_en,
      COALESCE(pa.product_count, 0)::int AS product_count,
      COALESCE(oa.revenue, 0)::numeric(10,2) AS revenue,
      COALESCE(oa.quantity_sold, 0)::int AS quantity_sold,
      COALESCE(va.view_count, 0)::int AS view_count
    FROM categories c
    LEFT JOIN product_agg pa ON pa.category_id = c.id
    LEFT JOIN order_agg oa ON oa.category_id = c.id
    LEFT JOIN view_agg va ON va.category_id = c.id
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE "order_items"
    SET
      "item_type" = CASE
        WHEN NULLIF(("selected_options"->>'itemType'), '') IS NOT NULL THEN LOWER(("selected_options"->>'itemType'))
        WHEN "item_type" IS NULL OR "item_type" = '' THEN 'product'
        ELSE "item_type"
      END,
      "offer_id" = COALESCE(
        "offer_id",
        NULLIF(("selected_options"->>'offerId'), '')::integer
      ),
      "display_name_ar" = COALESCE(
        NULLIF("display_name_ar", ''),
        NULLIF(("selected_options"->>'displayNameAr'), ''),
        NULLIF(("selected_options"->>'offerNameAr'), '')
      ),
      "display_name_en" = COALESCE(
        NULLIF("display_name_en", ''),
        NULLIF(("selected_options"->>'displayNameEn'), ''),
        NULLIF(("selected_options"->>'offerNameEn'), '')
      ),
      "display_image_url" = COALESCE(
        NULLIF("display_image_url", ''),
        NULLIF(("selected_options"->>'displayImageUrl'), ''),
        NULLIF(("selected_options"->>'offerImageUrl'), '')
      )
    WHERE
      ("display_name_ar" IS NULL OR "display_name_ar" = '')
      OR ("display_name_en" IS NULL OR "display_name_en" = '')
      OR ("display_image_url" IS NULL OR "display_image_url" = '')
      OR ("item_type" IS NULL OR "item_type" = '' OR "item_type" = 'product')
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "waiter_complaints" (
      "id" SERIAL PRIMARY KEY,
      "table_number" text NOT NULL,
      "complaint" text NOT NULL,
      "created_at" timestamp(3) NOT NULL DEFAULT NOW(),
      "updated_at" timestamp(3) NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "customer_reviews" (
      "id" SERIAL PRIMARY KEY,
      "table_id" integer REFERENCES "tables"("id") ON DELETE SET NULL,
      "table_uuid" text NOT NULL,
      "session_uuid" text,
      "table_number" text NOT NULL,
      "table_color" text,
      "phone" text NOT NULL,
      "customer_name" text NOT NULL,
      "rating_mode" text NOT NULL,
      "rating_value" integer NOT NULL,
      "comment" text NOT NULL DEFAULT '',
      "created_at" timestamp(3) NOT NULL DEFAULT NOW(),
      CONSTRAINT "customer_reviews_rating_mode_check" CHECK ("rating_mode" IN ('stars', 'emoji')),
      CONSTRAINT "customer_reviews_rating_value_check" CHECK ("rating_value" BETWEEN 1 AND 5)
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "vip_customer_visits" (
      "id" SERIAL PRIMARY KEY,
      "phone" text NOT NULL UNIQUE,
      "visit_count" integer NOT NULL DEFAULT 0,
      "amount_total" numeric(10,2) NOT NULL DEFAULT 0,
      "reward_status" text NOT NULL DEFAULT 'available',
      "reward_visit_count" integer NOT NULL DEFAULT 0,
      "reward_session_uuid" text,
      "reward_awarded_at" timestamp(3),
      "reward_consumed_at" timestamp(3),
      "reward_consumed_session_uuid" text,
      "last_table_id" integer REFERENCES "tables"("id") ON DELETE SET NULL,
      "last_table_number" text,
      "last_branch_id" integer REFERENCES "branches"("id") ON DELETE SET NULL,
      "customer_name" text,
      "last_visit_at" timestamp(3) NOT NULL DEFAULT NOW(),
      "created_at" timestamp(3) NOT NULL DEFAULT NOW(),
      "updated_at" timestamp(3) NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe('ALTER TABLE "vip_customer_visits" ADD COLUMN IF NOT EXISTS "reward_visit_count" integer NOT NULL DEFAULT 0');
  await prisma.$executeRawUnsafe('ALTER TABLE "vip_customer_visits" ADD COLUMN IF NOT EXISTS "amount_total" numeric(10,2) NOT NULL DEFAULT 0');
  await prisma.$executeRawUnsafe('ALTER TABLE "vip_customer_visits" ADD COLUMN IF NOT EXISTS "reward_status" text NOT NULL DEFAULT \'available\'');
  await prisma.$executeRawUnsafe('ALTER TABLE "vip_customer_visits" ADD COLUMN IF NOT EXISTS "reward_session_uuid" text');
  await prisma.$executeRawUnsafe('ALTER TABLE "vip_customer_visits" ADD COLUMN IF NOT EXISTS "reward_awarded_at" timestamp(3)');
  await prisma.$executeRawUnsafe('ALTER TABLE "vip_customer_visits" ADD COLUMN IF NOT EXISTS "reward_consumed_at" timestamp(3)');
  await prisma.$executeRawUnsafe('ALTER TABLE "vip_customer_visits" ADD COLUMN IF NOT EXISTS "reward_consumed_session_uuid" text');

  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "idx_archived_orders_session_created" ON "archived_orders" ("session_uuid", "archived_at", "order_id")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "idx_archived_orders_table_created" ON "archived_orders" ("table_id", "archived_at", "order_id")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "idx_waiter_complaints_created" ON "waiter_complaints" ("created_at", "id")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "idx_customer_reviews_created" ON "customer_reviews" ("created_at", "id")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "idx_customer_reviews_table_phone" ON "customer_reviews" ("table_id", "phone", "created_at")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "idx_vip_customer_visits_visit_count" ON "vip_customer_visits" ("visit_count", "last_visit_at")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "idx_vip_customer_visits_reward_visit_count" ON "vip_customer_visits" ("reward_visit_count", "last_visit_at")');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "archived_orders" (
      "id" SERIAL PRIMARY KEY,
      "order_id" integer NOT NULL UNIQUE,
      "table_id" integer,
      "table_number" text,
      "table_color" text,
      "session_uuid" text,
      "order_number" integer,
      "status" text,
      "source" text,
      "total_amount" numeric(10,2),
      "created_at" timestamp(3),
      "archived_at" timestamp(3) NOT NULL DEFAULT NOW(),
      "payload" jsonb NOT NULL
    )
  `);

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
    SELECT COUNT(*)::int AS "archivedCount"
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
          NOW(),
          ${JSON.stringify(payload)}::jsonb
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
  }
}
