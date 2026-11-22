import { createHash } from 'node:crypto';

/** Nội dung chuyên môn của hồ sơ được "ký" — thay đổi bất kỳ trường nào sau khi ký sẽ làm lệch mã băm. */
export interface SignableRecord {
  id: string;
  patientId: string;
  doctorId: string;
  facilityId: string;
  visitAt: Date;
  chiefComplaint: string;
  symptoms?: string | null;
  physicalExamination?: string | null;
  pulse?: number | null;
  temperature?: number | null;
  systolicBp?: number | null;
  diastolicBp?: number | null;
  respiratoryRate?: number | null;
  spo2?: number | null;
  diagnosisNote?: string | null;
  treatmentPlan?: string | null;
  diagnoses: { icdCode: string; isPrimary: boolean }[];
  prescriptionItems: { drugName: string; quantity: number; unit: string; instructions: string }[];
}

/** JSON với khoá được sắp xếp — cùng nội dung luôn cho cùng chuỗi. */
function canonical(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * SHA-256 của nội dung hồ sơ tại thời điểm bác sĩ ký xác nhận.
 * Chỉ lấy đúng các trường chuyên môn — các trường hệ thống (status, updatedAt, signedAt…)
 * thay đổi khi ký nên không được đưa vào, nếu không mã băm sẽ không bao giờ khớp lại.
 */
export function computeRecordSignature(r: SignableRecord): string {
  const normalized = {
    id: r.id,
    patientId: r.patientId,
    doctorId: r.doctorId,
    facilityId: r.facilityId,
    visitAt: r.visitAt,
    chiefComplaint: r.chiefComplaint,
    symptoms: r.symptoms ?? null,
    physicalExamination: r.physicalExamination ?? null,
    pulse: r.pulse ?? null,
    temperature: r.temperature ?? null,
    systolicBp: r.systolicBp ?? null,
    diastolicBp: r.diastolicBp ?? null,
    respiratoryRate: r.respiratoryRate ?? null,
    spo2: r.spo2 ?? null,
    diagnosisNote: r.diagnosisNote ?? null,
    treatmentPlan: r.treatmentPlan ?? null,
    diagnoses: r.diagnoses
      .map((d) => ({ icdCode: d.icdCode, isPrimary: d.isPrimary }))
      .sort((a, b) => a.icdCode.localeCompare(b.icdCode)),
    prescriptionItems: r.prescriptionItems.map((p) => ({
      drugName: p.drugName,
      quantity: p.quantity,
      unit: p.unit,
      instructions: p.instructions,
    })),
  };
  return createHash('sha256').update(canonical(normalized)).digest('hex');
}
