export type LookupKind =
  'NATIONAL_ID' | 'HEALTH_INSURANCE' | 'APPOINTMENT_CODE' | 'PHONE_OR_INSURANCE' | 'NAME';

export interface ClassifiedQuery {
  kind: LookupKind;
  /** Giá trị đã chuẩn hoá để so khớp */
  value: string;
}

/**
 * Nhận diện từ khoá tra cứu bệnh nhân:
 * - 12 chữ số → CCCD
 * - LH + 6 ký tự → mã lịch hẹn
 * - 2 chữ cái + 13 chữ số → mã thẻ BHYT 15 ký tự (VD DN4010090001234)
 * - 10 chữ số → số điện thoại hoặc mã số BHXH 10 số
 * - còn lại → tên (chỉ tìm trong bệnh nhân đã liên hệ với cơ sở)
 */
export function classifyLookup(raw: string): ClassifiedQuery {
  const compact = raw.replace(/[\s.-]/g, '').toUpperCase();
  if (/^\d{12}$/.test(compact)) return { kind: 'NATIONAL_ID', value: compact };
  if (/^LH[A-Z0-9]{6}$/.test(compact)) return { kind: 'APPOINTMENT_CODE', value: compact };
  if (/^[A-Z]{2}\d{13}$/.test(compact)) return { kind: 'HEALTH_INSURANCE', value: compact };
  if (/^(\+?84)\d{9}$/.test(compact))
    return { kind: 'PHONE_OR_INSURANCE', value: `0${compact.replace(/^\+?84/, '')}` };
  if (/^\d{10}$/.test(compact)) return { kind: 'PHONE_OR_INSURANCE', value: compact };
  return { kind: 'NAME', value: raw.trim().replace(/\s+/g, ' ') };
}
