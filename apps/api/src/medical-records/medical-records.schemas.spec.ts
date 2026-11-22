import { updateRecordSchema } from './medical-records.schemas.js';

describe('updateRecordSchema', () => {
  it('chuẩn hoá mã ICD và chuỗi rỗng', () => {
    const v = updateRecordSchema.parse({
      diagnoses: [{ icdCode: ' i10 ', isPrimary: true }],
      symptoms: '',
      followUpDate: '',
    });
    expect(v).toEqual({
      diagnoses: [{ icdCode: 'I10', isPrimary: true, note: null }],
      symptoms: null,
      followUpDate: null,
    });
  });

  it.each([
    [{ pulse: 400 }, 'Mạch'],
    [{ spo2: 101 }, 'SpO2'],
    [{ temperature: 50 }, 'Nhiệt độ'],
    [{ systolicBp: 80, diastolicBp: 90 }, 'tâm thu'],
    [
      {
        diagnoses: [
          { icdCode: 'I10', isPrimary: true },
          { icdCode: 'R51', isPrimary: true },
        ],
      },
      'một bệnh chính',
    ],
    [{ diagnoses: [{ icdCode: 'I10' }, { icdCode: 'i10' }] }, 'trùng'],
    [{ diagnoses: [{ icdCode: 'XYZ' }] }, 'ICD-10'],
    [
      { prescriptionItems: [{ drugName: 'A', quantity: 0, unit: 'viên', instructions: 'x' }] },
      'Số lượng',
    ],
  ])('từ chối %j', (input, message) => {
    const r = updateRecordSchema.safeParse(input);
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.message).join(' ')).toContain(message);
  });
});
