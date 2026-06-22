import { prisma } from '../backend/src/lib/prisma.js';

const statements = [
  'ALTER TABLE "tables" ADD COLUMN IF NOT EXISTS "name" text',
  'ALTER TABLE "tables" ADD COLUMN IF NOT EXISTS "current_phone" text',
  'ALTER TABLE "tables" ADD COLUMN IF NOT EXISTS "opened_at" timestamp(3)',
  'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "average_wait_time" integer'
];

for (const sql of statements) {
  await prisma.$executeRawUnsafe(sql);
}

await prisma.$disconnect();
console.log('schema-updated');
