/**
 * Seed danh mục hành chính 2 cấp: 34 Tỉnh/Thành và 3.321 Xã/Phường/Đặc khu.
 *
 * Nguồn: thanglequoc/vietnamese-provinces-database (MIT) — xem prisma/data/metadata.json.
 * Chạy lại an toàn: chỉ thêm bản ghi mới và cập nhật bản ghi có thay đổi.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  type CommuneType,
  type ProvinceType,
} from '../src/generated/prisma/client.js';

interface ProvinceRow {
  code: string;
  name: string;
  nameEn: string;
  fullName: string;
  fullNameEn: string;
  codeName: string;
  type: ProvinceType;
}

interface CommuneRow extends Omit<ProvinceRow, 'type'> {
  type: CommuneType;
  provinceCode: string;
}

const dataDir = join(import.meta.dirname, 'data');
const readJson = <T>(file: string): T => JSON.parse(readFileSync(join(dataDir, file), 'utf8')) as T;

const FIELDS = ['name', 'nameEn', 'fullName', 'fullNameEn', 'codeName', 'type'] as const;

function changed<T extends ProvinceRow | CommuneRow>(a: T, b: T): boolean {
  if ('provinceCode' in a && 'provinceCode' in b && a.provinceCode !== b.provinceCode) return true;
  return FIELDS.some((field) => a[field] !== b[field]);
}

async function syncProvinces(prisma: PrismaClient, rows: ProvinceRow[]) {
  const existing = new Map(
    (await prisma.province.findMany()).map((p) => [p.code, p as unknown as ProvinceRow]),
  );
  const toCreate = rows.filter((r) => !existing.has(r.code));
  const toUpdate = rows.filter((r) => existing.has(r.code) && changed(existing.get(r.code)!, r));

  await prisma.province.createMany({ data: toCreate });
  await prisma.$transaction(
    toUpdate.map(({ code, ...data }) => prisma.province.update({ where: { code }, data })),
  );
  return { created: toCreate.length, updated: toUpdate.length };
}

async function syncCommunes(prisma: PrismaClient, rows: CommuneRow[]) {
  const existing = new Map(
    (await prisma.commune.findMany()).map((c) => [c.code, c as unknown as CommuneRow]),
  );
  const toCreate = rows.filter((r) => !existing.has(r.code));
  const toUpdate = rows.filter((r) => existing.has(r.code) && changed(existing.get(r.code)!, r));

  const CHUNK = 1000;
  for (let i = 0; i < toCreate.length; i += CHUNK) {
    await prisma.commune.createMany({ data: toCreate.slice(i, i + CHUNK) });
  }
  await prisma.$transaction(
    toUpdate.map(({ code, ...data }) => prisma.commune.update({ where: { code }, data })),
  );

  const datasetCodes = new Set(rows.map((r) => r.code));
  const stale = [...existing.keys()].filter((code) => !datasetCodes.has(code));
  if (stale.length > 0) {
    console.warn(
      `⚠️  ${stale.length} xã trong DB không còn trong bộ dữ liệu (giữ nguyên để không phá liên kết): ${stale.slice(0, 10).join(', ')}`,
    );
  }
  return { created: toCreate.length, updated: toUpdate.length };
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Thiếu biến môi trường DATABASE_URL');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const provinces = readJson<ProvinceRow[]>('provinces.json');
    const communes = readJson<CommuneRow[]>('communes.json');

    const p = await syncProvinces(prisma, provinces);
    console.log(`✔ Tỉnh/Thành: ${provinces.length} (thêm ${p.created}, cập nhật ${p.updated})`);

    const c = await syncCommunes(prisma, communes);
    console.log(
      `✔ Xã/Phường/Đặc khu: ${communes.length} (thêm ${c.created}, cập nhật ${c.updated})`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
