/** Danh mục ICD-10: nạp danh mục rút gọn của dự án (prisma/data/icd10-curated.csv). */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { parseCsv, toIcd10Rows, type Icd10Row } from '../../src/icd10/icd10-csv.js';

/** Thêm mới / cập nhật theo lô. Không xoá mã cũ (có thể đang được dùng trong chẩn đoán). */
export async function upsertIcd10(prisma: PrismaClient, rows: Icd10Row[]) {
  const existing = new Set(
    (await prisma.icd10Code.findMany({ select: { code: true } })).map((r) => r.code),
  );
  const toCreate = rows.filter((r) => !existing.has(r.code));
  const toUpdate = rows.filter((r) => existing.has(r.code));
  for (let i = 0; i < toCreate.length; i += 1000) {
    await prisma.icd10Code.createMany({ data: toCreate.slice(i, i + 1000), skipDuplicates: true });
  }
  for (let i = 0; i < toUpdate.length; i += 500) {
    await prisma.$transaction(
      toUpdate
        .slice(i, i + 500)
        .map(({ code, ...data }) =>
          prisma.icd10Code.update({ where: { code }, data: { ...data, isActive: true } }),
        ),
    );
  }
  return { created: toCreate.length, updated: toUpdate.length };
}

export async function seedIcd10(prisma: PrismaClient) {
  const csv = readFileSync(join(import.meta.dirname, '..', 'data', 'icd10-curated.csv'), 'utf8');
  const { rows } = toIcd10Rows(parseCsv(csv));
  // Không ghi đè tên của bảng chính thức nếu đã nhập (nhiều mã hơn danh mục rút gọn)
  if ((await prisma.icd10Code.count()) > rows.length * 2) {
    console.log('↷ ICD-10: đã có danh mục đầy đủ, bỏ qua danh mục rút gọn');
    return;
  }
  const r = await upsertIcd10(prisma, rows);
  console.log(`✔ ICD-10 (rút gọn): ${rows.length} mã (thêm ${r.created}, cập nhật ${r.updated})`);
}
