/**
 * Seed dữ liệu danh mục. Chạy lại an toàn (idempotent): `pnpm db:seed`.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { seedAdministrativeUnits } from './seeds/administrative-units.js';
import { seedSpecialties } from './seeds/specialties.js';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Thiếu biến môi trường DATABASE_URL');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await seedAdministrativeUnits(prisma);
    await seedSpecialties(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
