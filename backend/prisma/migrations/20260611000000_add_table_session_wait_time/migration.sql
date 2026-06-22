ALTER TABLE "tables" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE "tables" ADD COLUMN IF NOT EXISTS "current_phone" text;
ALTER TABLE "tables" ADD COLUMN IF NOT EXISTS "opened_at" timestamp(3);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "average_wait_time" integer;
