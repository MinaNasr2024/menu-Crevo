CREATE TYPE "OrderStatus" AS ENUM ('pending', 'completed', 'cancelled');
CREATE TYPE "OrderSource" AS ENUM ('qr', 'app', 'phone', 'walk_in');
CREATE TYPE "EmployeeRole" AS ENUM ('manager', 'waiter', 'cashier', 'admin');
CREATE TYPE "ProductReactionType" AS ENUM ('liked', 'disliked', 'shared');
CREATE TYPE "ExpenseCategory" AS ENUM ('operational', 'food', 'employee', 'marketing', 'utility', 'maintenance', 'other');
CREATE TYPE "ReportFrequency" AS ENUM ('daily', 'weekly', 'monthly');
CREATE TYPE "ActorType" AS ENUM ('admin', 'employee', 'system');
CREATE TYPE "AuditAction" AS ENUM ('create', 'update', 'delete', 'approve', 'refresh', 'export');

ALTER TABLE "tables" ADD COLUMN IF NOT EXISTS "branch_id" INTEGER;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "branch_id" INTEGER;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_id" INTEGER;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "waiter_id" INTEGER;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "status" "OrderStatus" NOT NULL DEFAULT 'pending';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "source" "OrderSource" NOT NULL DEFAULT 'qr';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "waiter_calls" ADD COLUMN IF NOT EXISTS "waiter_id" INTEGER;
ALTER TABLE "waiter_calls" ADD COLUMN IF NOT EXISTS "responded_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "branches" (
    "id" SERIAL NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "branches_code_key" ON "branches"("code");

CREATE TABLE IF NOT EXISTS "employees" (
    "id" SERIAL NOT NULL,
    "branch_id" INTEGER,
    "full_name" TEXT NOT NULL,
    "role" "EmployeeRole" NOT NULL DEFAULT 'waiter',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "customers" (
    "id" SERIAL NOT NULL,
    "full_name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "customers_phone_key" ON "customers"("phone");
CREATE UNIQUE INDEX IF NOT EXISTS "customers_email_key" ON "customers"("email");

CREATE TABLE IF NOT EXISTS "attendance_logs" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "checked_in_at" TIMESTAMP(3),
    "checked_out_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendance_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "qr_scans" (
    "id" SERIAL NOT NULL,
    "branch_id" INTEGER,
    "table_id" INTEGER NOT NULL,
    "customer_id" INTEGER,
    "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "qr_scans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "product_views" (
    "id" SERIAL NOT NULL,
    "branch_id" INTEGER,
    "table_id" INTEGER,
    "customer_id" INTEGER,
    "product_id" INTEGER NOT NULL,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_views_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "product_reactions" (
    "id" SERIAL NOT NULL,
    "branch_id" INTEGER,
    "table_id" INTEGER,
    "customer_id" INTEGER,
    "product_id" INTEGER NOT NULL,
    "reaction" "ProductReactionType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_reactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "inventory_items" (
    "id" SERIAL NOT NULL,
    "branch_id" INTEGER,
    "product_id" INTEGER NOT NULL,
    "stock_level" INTEGER NOT NULL DEFAULT 0,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 10,
    "wasted_quantity" INTEGER NOT NULL DEFAULT 0,
    "expired_quantity" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_items_product_id_key" ON "inventory_items"("product_id");

CREATE TABLE IF NOT EXISTS "expenses" (
    "id" SERIAL NOT NULL,
    "branch_id" INTEGER,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "expense_date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" SERIAL NOT NULL,
    "branch_id" INTEGER,
    "employee_id" INTEGER,
    "actor_type" "ActorType" NOT NULL DEFAULT 'system',
    "action" "AuditAction" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "report_schedules" (
    "id" SERIAL NOT NULL,
    "branch_id" INTEGER,
    "name" TEXT NOT NULL,
    "frequency" "ReportFrequency" NOT NULL,
    "delivery_type" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "next_run_at" TIMESTAMP(3),
    "last_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "tables" ADD CONSTRAINT "tables_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_waiter_id_fkey" FOREIGN KEY ("waiter_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "waiter_calls" ADD CONSTRAINT "waiter_calls_waiter_id_fkey" FOREIGN KEY ("waiter_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "qr_scans" ADD CONSTRAINT "qr_scans_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "qr_scans" ADD CONSTRAINT "qr_scans_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "qr_scans" ADD CONSTRAINT "qr_scans_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_views" ADD CONSTRAINT "product_views_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_views" ADD CONSTRAINT "product_views_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_views" ADD CONSTRAINT "product_views_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_views" ADD CONSTRAINT "product_views_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_reactions" ADD CONSTRAINT "product_reactions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_reactions" ADD CONSTRAINT "product_reactions_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_reactions" ADD CONSTRAINT "product_reactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_reactions" ADD CONSTRAINT "product_reactions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "orders_branch_id_created_at_idx" ON "orders"("branch_id", "created_at");
CREATE INDEX IF NOT EXISTS "orders_status_idx" ON "orders"("status");
CREATE INDEX IF NOT EXISTS "orders_customer_id_idx" ON "orders"("customer_id");
CREATE INDEX IF NOT EXISTS "orders_waiter_id_idx" ON "orders"("waiter_id");
CREATE INDEX IF NOT EXISTS "product_views_product_id_viewed_at_idx" ON "product_views"("product_id", "viewed_at");
CREATE INDEX IF NOT EXISTS "product_reactions_product_id_created_at_idx" ON "product_reactions"("product_id", "created_at");
CREATE INDEX IF NOT EXISTS "qr_scans_scanned_at_idx" ON "qr_scans"("scanned_at");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at");
CREATE INDEX IF NOT EXISTS "expenses_expense_date_idx" ON "expenses"("expense_date");

CREATE MATERIALIZED VIEW "analytics_daily_sales_mv" AS
SELECT
  DATE_TRUNC('day', o.created_at) AS report_date,
  o.branch_id,
  COUNT(*)::int AS total_orders,
  COUNT(*) FILTER (WHERE o.status = 'completed')::int AS completed_orders,
  COUNT(*) FILTER (WHERE o.status = 'cancelled')::int AS cancelled_orders,
  COALESCE(SUM(o.total_amount), 0)::numeric(10,2) AS gross_sales,
  ROUND(AVG(o.total_amount)::numeric, 2) AS average_order_value
FROM orders o
GROUP BY report_date, o.branch_id;

CREATE UNIQUE INDEX "analytics_daily_sales_mv_report_date_branch_id_idx"
  ON "analytics_daily_sales_mv" ("report_date", "branch_id");

CREATE OR REPLACE VIEW "analytics_product_performance_v" AS
WITH order_agg AS (
  SELECT
    product_id,
    COUNT(DISTINCT order_id)::int AS order_count,
    COALESCE(SUM(quantity), 0)::int AS quantity_sold,
    COALESCE(SUM(quantity * price_at_sale), 0)::numeric(10,2) AS revenue
  FROM order_items
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
LEFT JOIN reaction_agg r ON r.product_id = p.id;

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
LEFT JOIN view_agg va ON va.category_id = c.id;

CREATE OR REPLACE VIEW "analytics_customer_summary_v" AS
WITH order_agg AS (
  SELECT
    customer_id,
    COUNT(*)::int AS order_count,
    COALESCE(SUM(total_amount), 0)::numeric(10,2) AS lifetime_value,
    MAX(created_at) AS last_order_at
  FROM orders
  WHERE customer_id IS NOT NULL
  GROUP BY customer_id
),
view_agg AS (
  SELECT customer_id, COUNT(*)::int AS view_count
  FROM product_views
  WHERE customer_id IS NOT NULL
  GROUP BY customer_id
)
SELECT
  cu.id AS customer_id,
  COALESCE(cu.full_name, 'Guest') AS customer_name,
  COALESCE(oa.order_count, 0)::int AS order_count,
  COALESCE(oa.lifetime_value, 0)::numeric(10,2) AS lifetime_value,
  oa.last_order_at,
  COALESCE(va.view_count, 0)::int AS view_count
FROM customers cu
LEFT JOIN order_agg oa ON oa.customer_id = cu.id
LEFT JOIN view_agg va ON va.customer_id = cu.id;

CREATE OR REPLACE VIEW "analytics_table_usage_v" AS
WITH order_agg AS (
  SELECT
    table_id,
    COUNT(*)::int AS order_count,
    COALESCE(EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / 60.0, 0)::numeric(10,2) AS avg_session_minutes
  FROM orders
  GROUP BY table_id
),
call_agg AS (
  SELECT table_id, COUNT(*)::int AS waiter_call_count
  FROM waiter_calls
  GROUP BY table_id
)
SELECT
  t.id AS table_id,
  t.table_number,
  COALESCE(oa.order_count, 0)::int AS order_count,
  COALESCE(ca.waiter_call_count, 0)::int AS waiter_call_count,
  COALESCE(oa.avg_session_minutes, 0)::numeric(10,2) AS avg_session_minutes
FROM tables t
LEFT JOIN order_agg oa ON oa.table_id = t.id
LEFT JOIN call_agg ca ON ca.table_id = t.id;

CREATE OR REPLACE VIEW "analytics_employee_performance_v" AS
WITH order_agg AS (
  SELECT waiter_id, COUNT(*)::int AS orders_handled
  FROM orders
  WHERE waiter_id IS NOT NULL
  GROUP BY waiter_id
),
call_agg AS (
  SELECT
    waiter_id,
    COUNT(*)::int AS calls_handled,
    COALESCE(AVG(EXTRACT(EPOCH FROM (responded_at - created_at))) FILTER (WHERE responded_at IS NOT NULL), 0)::numeric(10,2) AS avg_response_seconds
  FROM waiter_calls
  WHERE waiter_id IS NOT NULL
  GROUP BY waiter_id
),
attendance_agg AS (
  SELECT employee_id, COUNT(*)::int AS attendance_records
  FROM attendance_logs
  GROUP BY employee_id
)
SELECT
  e.id AS employee_id,
  e.full_name,
  e.role,
  COALESCE(oa.orders_handled, 0)::int AS orders_handled,
  COALESCE(ca.calls_handled, 0)::int AS calls_handled,
  COALESCE(ca.avg_response_seconds, 0)::numeric(10,2) AS avg_response_seconds,
  COALESCE(aa.attendance_records, 0)::int AS attendance_records
FROM employees e
LEFT JOIN order_agg oa ON oa.waiter_id = e.id
LEFT JOIN call_agg ca ON ca.waiter_id = e.id
LEFT JOIN attendance_agg aa ON aa.employee_id = e.id;
