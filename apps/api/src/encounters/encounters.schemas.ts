import { z } from 'zod';
import { EncounterType } from '../generated/prisma/enums.js';

/** Bắt đầu khám trực tiếp (bệnh nhân không đặt lịch / cấp cứu). */
export const startEncounterSchema = z.object({
  patientId: z.uuid(),
  chiefComplaint: z.string().trim().min(2, 'Nhập lý do đến khám').max(500),
  specialtyId: z.uuid().nullish(),
  encounterType: z.enum(EncounterType).default('OUTPATIENT'),
});
export type StartEncounterInput = z.infer<typeof startEncounterSchema>;
