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
