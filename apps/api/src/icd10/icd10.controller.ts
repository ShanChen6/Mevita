import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { toSearchText } from '../common/vietnamese.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { PrismaService } from '../prisma/prisma.service.js';

const searchSchema = z.object({
  q: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

@Controller('icd10')
export class Icd10Controller {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tra cứu nhanh mã ICD-10: theo mã (VD "S06", "i10") hoặc tên có dấu/không dấu (VD "tang huyet ap").
   * Thứ tự ưu tiên: (1) mã khớp tiền tố, (2) tên chứa nguyên cụm từ khoá, (3) tên chứa đủ các từ.
   */
  @Get()
  async search(
    @Query(new ZodValidationPipe(searchSchema)) { q, limit }: z.infer<typeof searchSchema>,
  ) {
    const phrase = toSearchText(q);
    const tokens = [...new Set(phrase.split(' ').filter(Boolean))];
    const select = { code: true, nameVi: true, nameEn: true, chapter: true } as const;
    const results: {
      code: string;
      nameVi: string;
      nameEn: string | null;
      chapter: string | null;
    }[] = [];

    const take = async (where: object) => {
      if (results.length >= limit) return;
      results.push(
        ...(await this.prisma.icd10Code.findMany({
          where: { isActive: true, code: { notIn: results.map((r) => r.code) }, ...where },
          select,
          orderBy: { code: 'asc' },
          take: limit - results.length,
        })),
      );
    };

    if (/^[a-z]\d/i.test(q.trim())) await take({ code: { startsWith: q.trim().toUpperCase() } });
    await take({ searchText: { contains: ` ${phrase}` } }); // cụm từ đứng đầu một từ
    if (tokens.length > 1)
      await take({ AND: tokens.map((t) => ({ searchText: { contains: t } })) });
    return results;
  }
}
