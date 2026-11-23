/**
 * Dựng lại dữ liệu demo trước mỗi buổi diễn tập / bảo vệ (Task 6.2):
 *
 *   pnpm --filter @mevita/api demo:reset
 *
 * Xoá phiếu chuyển tuyến, hồ sơ, lịch hẹn phát sinh ở các cơ sở & bệnh nhân demo; chạy lại seed demo
 * (tài khoản, xe, số giường) và dựng kịch bản với mốc thời gian tính từ bây giờ. Ở production cần
 * `SEED_DEMO=true` như seed demo.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { seedDemo } from './seeds/demo.js';
import { resetDemoScenarios } from './seeds/demo-scenarios.js';

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_DEMO !== 'true')
    throw new Error('Đặt SEED_DEMO=true để dựng lại dữ liệu demo ở production');
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Thiếu biến môi trường DATABASE_URL');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const removed = await resetDemoScenarios(prisma);
    console.log(
      `✔ Đã xoá ${removed.referrals} phiếu chuyển tuyến, ${removed.records} hồ sơ, ${removed.appointments} lịch hẹn phát sinh`,
    );
    await seedDemo(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
