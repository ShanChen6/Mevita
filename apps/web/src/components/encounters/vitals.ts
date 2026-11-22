/** Ngưỡng bình thường ở người lớn — dùng để tô màu cảnh báo khi nhập. */
export type VitalKey =
  'pulse' | 'temperature' | 'systolicBp' | 'diastolicBp' | 'respiratoryRate' | 'spo2';

export const VITALS: {
  key: VitalKey;
  label: string;
  unit: string;
  step: string;
  normal: [number, number];
  danger?: [number, number];
}[] = [
  {
    key: 'pulse',
    label: 'Mạch',
    unit: 'lần/phút',
    step: '1',
    normal: [50, 100],
    danger: [40, 130],
  },
  {
    key: 'temperature',
    label: 'Nhiệt độ',
    unit: '°C',
    step: '0.1',
    normal: [36, 37.5],
    danger: [35, 39.5],
  },
  {
    key: 'systolicBp',
    label: 'HA tâm thu',
    unit: 'mmHg',
    step: '1',
    normal: [90, 139],
    danger: [80, 180],
  },
  {
    key: 'diastolicBp',
    label: 'HA tâm trương',
    unit: 'mmHg',
    step: '1',
    normal: [60, 89],
    danger: [50, 110],
  },
  {
    key: 'respiratoryRate',
    label: 'Nhịp thở',
    unit: 'lần/phút',
    step: '1',
    normal: [12, 20],
    danger: [8, 30],
  },
  { key: 'spo2', label: 'SpO2', unit: '%', step: '1', normal: [95, 100], danger: [90, 100] },
];

export type VitalLevel = 'normal' | 'warning' | 'danger';

export function vitalLevel(key: VitalKey, value: number | null | undefined): VitalLevel | null {
  if (value == null || Number.isNaN(value)) return null;
  const v = VITALS.find((x) => x.key === key)!;
  if (v.danger && (value < v.danger[0] || value > v.danger[1])) return 'danger';
  if (value < v.normal[0] || value > v.normal[1]) return 'warning';
  return 'normal';
}
