DO $$
BEGIN
  CREATE TYPE "MenuScope" AS ENUM ('menu', 'studio');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS scope "MenuScope" NOT NULL DEFAULT 'menu';

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS scope "MenuScope" NOT NULL DEFAULT 'menu';

UPDATE categories
SET scope = 'menu'
WHERE scope IS NULL;

UPDATE products
SET scope = 'menu'
WHERE scope IS NULL;
