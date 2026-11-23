import { z } from 'zod';
import { ClinicalImageType } from '../generated/prisma/enums.js';

export const uploadTicketSchema = z.object({ type: z.enum(ClinicalImageType) });

export const confirmImageSchema = z.object({
  publicId: z.string().min(10).max(255),
  type: z.enum(ClinicalImageType),
  description: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((v) => v || null),
  takenAt: z.iso
    .datetime({ offset: true })
    .nullish()
    .transform((v) => (v ? new Date(v) : null)),
});
export type ConfirmImageInput = z.infer<typeof confirmImageSchema>;
