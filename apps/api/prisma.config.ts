import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Không dùng env() để `prisma generate` (postinstall, CI) chạy được khi chưa có DATABASE_URL.
    // Các lệnh cần DB (migrate, seed) sẽ báo lỗi kết nối rõ ràng nếu biến này trống.
    // Neon/Supabase: ứng dụng dùng chuỗi kết nối qua pooler (DATABASE_URL), còn migrate cần kết nối
    // trực tiếp — đặt DIRECT_DATABASE_URL nếu hai chuỗi khác nhau.
    url: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL ?? '',
  },
});
