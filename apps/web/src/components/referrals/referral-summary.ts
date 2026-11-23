import type { MedicalRecordDetail } from '@/lib/data/types';
import { ageAt, formatDecimal } from '@/lib/format';
import { gender } from '@/lib/labels';

/** Soạn sẵn tóm tắt bệnh án từ phiếu khám để bác sĩ chỉ cần kiểm tra lại khi chuyển tuyến. */
export function buildClinicalSummary(r: MedicalRecordDetail, now: string): string {
  const p = r.patient;
  const vitals = [
    r.pulse != null && `mạch ${r.pulse} l/p`,
    r.systolicBp != null && r.diastolicBp != null && `HA ${r.systolicBp}/${r.diastolicBp} mmHg`,
    r.temperature != null && `nhiệt độ ${formatDecimal(r.temperature)}°C`,
    r.respiratoryRate != null && `nhịp thở ${r.respiratoryRate} l/p`,
    r.spo2 != null && `SpO2 ${r.spo2}%`,
  ].filter(Boolean);
  const dx = r.diagnoses.map((d) => `${d.icdCode} ${d.name}${d.isPrimary ? ' (chính)' : ''}`);
  return [
    `Bệnh nhân ${gender[p.gender].toLowerCase()}, ${ageAt(p.dateOfBirth, now)} tuổi. Lý do vào: ${r.chiefComplaint}.`,
    r.symptoms && `Bệnh sử: ${r.symptoms}`,
    r.physicalExamination && `Khám: ${r.physicalExamination}`,
    vitals.length > 0 && `Sinh tồn: ${vitals.join(', ')}.`,
    dx.length > 0 && `Chẩn đoán: ${dx.join('; ')}.`,
    r.diagnosisNote && `Kết luận: ${r.diagnosisNote}`,
    p.allergies && `Dị ứng: ${p.allergies}.`,
    p.chronicConditions && `Tiền sử: ${p.chronicConditions}.`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Thuốc đã dùng tại tuyến dưới — gợi ý cho ô "Xử trí sơ cứu". */
export function buildInitialTreatment(r: MedicalRecordDetail): string {
  return r.prescriptionItems
    .map((p) => `${p.drugName}${p.strength ? ` ${p.strength}` : ''}: ${p.instructions}`)
    .join('\n');
}
