/** Danh mục chuyên khoa dùng chung cho mọi cơ sở y tế. */
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { readSeedJson } from './utils.js';

interface SpecialtyRow {
  code: string;
  name: string;
}

export async function seedSpecialties(prisma: PrismaClient) {
  const rows = readSeedJson<SpecialtyRow[]>('specialties.json');
  await prisma.$transaction(
    rows.map(({ code, name }) =>
      prisma.specialty.upsert({ where: { code }, create: { code, name }, update: { name } }),
    ),
  );
  console.log(`✔ Chuyên khoa: ${rows.length}`);
}
