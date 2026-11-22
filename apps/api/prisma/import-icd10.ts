/**
 * Nhập danh mục ICD-10 từ file CSV (VD bảng chính thức theo QĐ 4469/QĐ-BYT xuất ra CSV UTF-8).
 *
 *   pnpm --filter @mevita/api icd10:import duong/dan/icd10.csv
 *
 * Cột bắt buộc: mã (code / Mã bệnh) và tên tiếng Việt (name_vi / Tên bệnh).
 * Cột tuỳ chọn: tên tiếng Anh, chương. Phân tách bằng dấu phẩy, chấm phẩy hoặc tab.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { parseCsv, toIcd10Rows } from '../src/icd10/icd10-csv.js';
import { upsertIcd10 } from './seeds/icd10.js';

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('Cách dùng: pnpm icd10:import <file.csv>');
  if (!process.env.DATABASE_URL) throw new Error('Thiếu DATABASE_URL');

  const { rows, skipped } = toIcd10Rows(parseCsv(readFileSync(file, 'utf8')));
  if (rows.length === 0) throw new Error('Không có mã hợp lệ nào trong file');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const r = await upsertIcd10(prisma, rows);
    console.log(
      `✔ Đã nhập ${rows.length} mã ICD-10 (thêm ${r.created}, cập nhật ${r.updated}, bỏ qua ${skipped} dòng)`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
