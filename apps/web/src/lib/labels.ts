/**
 * Nhãn tiếng Việt và màu hiển thị cho các enum trong Prisma schema (apps/api/prisma/schema.prisma).
 * Giữ đồng bộ khi schema thay đổi.
 */

export type AppointmentStatus =
  'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export type ReferralPriority = 'CRITICAL' | 'URGENT' | 'ROUTINE';

export type ReferralStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'ARRIVED' | 'CANCELLED';

export type ConsciousnessLevel = 'ALERT' | 'VOICE' | 'PAIN' | 'UNRESPONSIVE';

export type FacilityType =
  | 'COMMUNE_HEALTH_STATION'
  | 'PROVINCIAL_GENERAL_HOSPITAL'
  | 'PROVINCIAL_SPECIALTY_HOSPITAL'
  | 'REGIONAL_HOSPITAL'
  | 'CENTRAL_HOSPITAL';

interface Display {
  label: string;
  className: string;
}

export const appointmentStatus: Record<AppointmentStatus, Display> = {
  PENDING: {
    label: 'Chờ duyệt',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
  },
  CONFIRMED: {
    label: 'Đã xác nhận',
    className: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300',
  },
  CHECKED_IN: {
    label: 'Đã tiếp đón',
    className: 'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-300',
  },
  COMPLETED: {
    label: 'Đã khám',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300',
  },
  CANCELLED: { label: 'Đã huỷ', className: 'bg-muted text-muted-foreground' },
  NO_SHOW: { label: 'Không đến', className: 'bg-muted text-muted-foreground' },
};

export const referralPriority: Record<ReferralPriority, Display> = {
  CRITICAL: { label: 'Cấp cứu tối khẩn', className: 'bg-red-600 text-white' },
  URGENT: { label: 'Khẩn', className: 'bg-orange-500 text-white' },
  ROUTINE: {
    label: 'Thường',
    className: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300',
  },
};

export const referralStatus: Record<ReferralStatus, Display> = {
  PENDING: {
    label: 'Chờ tiếp nhận',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
  },
  ACCEPTED: {
    label: 'Đã sẵn sàng ê-kíp',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300',
  },
  REJECTED: {
    label: 'Từ chối',
    className: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
  },
  ARRIVED: {
    label: 'Đã tới nơi',
    className: 'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-300',
  },
  CANCELLED: { label: 'Đã huỷ', className: 'bg-muted text-muted-foreground' },
};

export const consciousnessLevel: Record<ConsciousnessLevel, string> = {
  ALERT: 'A — Tỉnh táo',
  VOICE: 'V — Đáp ứng lời nói',
  PAIN: 'P — Đáp ứng kích thích đau',
  UNRESPONSIVE: 'U — Không đáp ứng',
};

export const facilityType: Record<FacilityType, string> = {
  COMMUNE_HEALTH_STATION: 'Trạm y tế xã',
  PROVINCIAL_GENERAL_HOSPITAL: 'Bệnh viện đa khoa tỉnh',
  PROVINCIAL_SPECIALTY_HOSPITAL: 'Bệnh viện chuyên khoa tỉnh',
  REGIONAL_HOSPITAL: 'Bệnh viện khu vực',
  CENTRAL_HOSPITAL: 'Bệnh viện Trung ương',
};

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type BloodType =
  | 'A_POSITIVE'
  | 'A_NEGATIVE'
  | 'B_POSITIVE'
  | 'B_NEGATIVE'
  | 'AB_POSITIVE'
  | 'AB_NEGATIVE'
  | 'O_POSITIVE'
  | 'O_NEGATIVE'
  | 'UNKNOWN';
export type EncounterType = 'OUTPATIENT' | 'EMERGENCY' | 'INPATIENT';
export type ClinicalImageType =
  'LAB_RESULT' | 'XRAY' | 'ULTRASOUND' | 'CT' | 'MRI' | 'ECG' | 'OTHER';

export const gender: Record<Gender, string> = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' };

export const bloodType: Record<BloodType, string> = {
  A_POSITIVE: 'A+',
  A_NEGATIVE: 'A−',
  B_POSITIVE: 'B+',
  B_NEGATIVE: 'B−',
  AB_POSITIVE: 'AB+',
  AB_NEGATIVE: 'AB−',
  O_POSITIVE: 'O+',
  O_NEGATIVE: 'O−',
  UNKNOWN: 'Chưa rõ',
};

export const encounterType: Record<EncounterType, string> = {
  OUTPATIENT: 'Khám ngoại trú',
  EMERGENCY: 'Cấp cứu',
  INPATIENT: 'Điều trị nội trú',
};

export const clinicalImageType: Record<ClinicalImageType, string> = {
  LAB_RESULT: 'Xét nghiệm',
  XRAY: 'X-quang',
  ULTRASOUND: 'Siêu âm',
  CT: 'CT',
  MRI: 'MRI',
  ECG: 'Điện tim',
  OTHER: 'Khác',
};

/** Chương ICD-10 (tên rút gọn cho bảng thống kê) */
export const icdChapter: Record<string, string> = {
  I: 'Nhiễm trùng & ký sinh trùng',
  II: 'U tân sinh',
  III: 'Máu & miễn dịch',
  IV: 'Nội tiết & chuyển hoá',
  V: 'Tâm thần & hành vi',
  VI: 'Thần kinh',
  VII: 'Mắt',
  VIII: 'Tai & xương chũm',
  IX: 'Tuần hoàn',
  X: 'Hô hấp',
  XI: 'Tiêu hoá',
  XII: 'Da & mô dưới da',
  XIII: 'Cơ xương khớp',
  XIV: 'Sinh dục – tiết niệu',
  XV: 'Thai nghén & sinh đẻ',
  XVI: 'Chu sinh',
  XVII: 'Dị tật bẩm sinh',
  XVIII: 'Triệu chứng bất thường',
  XIX: 'Chấn thương & ngộ độc',
  XX: 'Nguyên nhân bên ngoài',
  XXI: 'Yếu tố sức khoẻ',
  XXII: 'Mã đặc biệt',
};

export const vehicleType: Record<'ADVANCED_AMBULANCE' | 'BASIC_AMBULANCE' | 'TRANSPORT', string> = {
  ADVANCED_AMBULANCE: 'Xe cứu thương hồi sức',
  BASIC_AMBULANCE: 'Xe cứu thương cơ bản',
  TRANSPORT: 'Xe vận chuyển thường',
};

export const vehicleStatus: Record<'AVAILABLE' | 'ON_MISSION' | 'MAINTENANCE', Display> = {
  AVAILABLE: {
    label: 'Sẵn sàng',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300',
  },
  ON_MISSION: {
    label: 'Đang làm nhiệm vụ',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
  },
  MAINTENANCE: { label: 'Bảo trì', className: 'bg-muted text-muted-foreground' },
};

export const transportMode: Record<
  'FACILITY_VEHICLE' | 'PICKUP' | 'EMS_115' | 'FAMILY' | 'OTHER',
  string
> = {
  FACILITY_VEHICLE: 'Xe của cơ sở',
  PICKUP: 'Xe đón',
  EMS_115: 'Xe cấp cứu 115',
  FAMILY: 'Gia đình tự túc',
  OTHER: 'Phương tiện khác',
};
