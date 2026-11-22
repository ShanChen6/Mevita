import type { AppointmentStatus } from '../generated/prisma/enums.js';

export type AppointmentAction = 'confirm' | 'check-in' | 'cancel' | 'no-show' | 'complete';

/** Trạng thái được phép chuyển tới theo từng thao tác. */
const TRANSITIONS: Record<AppointmentAction, { from: AppointmentStatus[]; to: AppointmentStatus }> =
  {
    confirm: { from: ['PENDING'], to: 'CONFIRMED' },
    // Tiếp đón được cả lịch chưa duyệt (bệnh nhân đến quầy sớm)
    'check-in': { from: ['PENDING', 'CONFIRMED'], to: 'CHECKED_IN' },
    cancel: { from: ['PENDING', 'CONFIRMED'], to: 'CANCELLED' },
    'no-show': { from: ['PENDING', 'CONFIRMED'], to: 'NO_SHOW' },
    // Khi bác sĩ ký hoàn tất hồ sơ khám (Task 3.2)
    complete: { from: ['CHECKED_IN'], to: 'COMPLETED' },
  };

/** Trạng thái mới, hoặc null nếu không được chuyển. */
export function nextStatus(
  current: AppointmentStatus,
  action: AppointmentAction,
): AppointmentStatus | null {
  const t = TRANSITIONS[action];
  return t.from.includes(current) ? t.to : null;
}
