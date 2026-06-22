-- Add employee contact and authentication fields
ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "password_hash" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Keep phone/email unique when they are present
CREATE UNIQUE INDEX IF NOT EXISTS "employees_phone_key" ON "employees" ("phone");
CREATE UNIQUE INDEX IF NOT EXISTS "employees_email_key" ON "employees" ("email");

-- SQL-backed site settings for logo and hero sliders
CREATE TABLE IF NOT EXISTS "site_settings" (
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "site_settings_pkey" PRIMARY KEY ("key")
);
