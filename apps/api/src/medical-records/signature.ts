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

/** SHA-256 của nội dung hồ sơ tại thời điểm bác sĩ ký xác nhận. */
export function computeRecordSignature(record: SignableRecord): string {
  const normalized = {
    ...record,
    diagnoses: [...record.diagnoses].sort((a, b) => a.icdCode.localeCompare(b.icdCode)),
  };
  return createHash('sha256').update(canonical(normalized)).digest('hex');
}
