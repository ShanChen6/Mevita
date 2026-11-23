import type { Prisma } from '../generated/prisma/client.js';

/** Dạng trả về của một lần đo sinh tồn trên xe (tách riêng để tránh phụ thuộc vòng giữa các service). */
export const vitalSelect = {
  id: true,
  clientId: true,
  recordedAt: true,
  receivedAt: true,
  pulse: true,
  systolicBp: true,
  diastolicBp: true,
  spo2: true,
  respiratoryRate: true,
  temperature: true,
  consciousness: true,
  gcs: true,
  note: true,
  recordedBy: { select: { fullName: true, staffProfile: { select: { academicTitle: true } } } },
} satisfies Prisma.ReferralVitalLogSelect;

type VitalRow = Prisma.ReferralVitalLogGetPayload<{ select: typeof vitalSelect }>;

export function toVitalDto({ recordedBy, ...v }: VitalRow) {
  return {
    ...v,
    recordedBy: recordedBy.staffProfile?.academicTitle
      ? `${recordedBy.staffProfile.academicTitle}. ${recordedBy.fullName}`
      : recordedBy.fullName,
  };
}
