ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "custom_choice_groups" jsonb DEFAULT '[]'::jsonb;
