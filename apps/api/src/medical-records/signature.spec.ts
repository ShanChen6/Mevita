import { computeRecordSignature, type SignableRecord } from './signature.js';

const base: SignableRecord = {
  id: 'r1',
  patientId: 'p1',
  doctorId: 'd1',
  facilityId: 'f1',
  visitAt: new Date('2026-12-01T01:00:00Z'),
  chiefComplaint: 'Đau đầu',
  pulse: 88,
  diagnoses: [
    { icdCode: 'I10', isPrimary: true },
    { icdCode: 'R51', isPrimary: false },
  ],
  prescriptionItems: [
    { drugName: 'Amlodipin 5mg', quantity: 30, unit: 'viên', instructions: '1 viên/ngày' },
  ],
};

describe('computeRecordSignature', () => {
  it('ổn định với thứ tự khoá và thứ tự chẩn đoán', () => {
    const reordered = { ...base, diagnoses: [...base.diagnoses].reverse() };
    expect(computeRecordSignature(reordered)).toBe(computeRecordSignature(base));
    expect(computeRecordSignature(base)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('thay đổi khi nội dung chuyên môn thay đổi', () => {
    expect(computeRecordSignature({ ...base, pulse: 90 })).not.toBe(computeRecordSignature(base));
    expect(
      computeRecordSignature({
        ...base,
        prescriptionItems: [{ ...base.prescriptionItems[0], quantity: 60 }],
      }),
    ).not.toBe(computeRecordSignature(base));
  });
});
