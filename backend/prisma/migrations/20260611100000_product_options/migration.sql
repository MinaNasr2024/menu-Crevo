ALTER TABLE products
  ADD COLUMN IF NOT EXISTS size_options jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS side_dish_options jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS addon_options jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS selected_options jsonb;
