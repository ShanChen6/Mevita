import { Injectable } from '@nestjs/common';
import type { SocketUser } from './realtime.events.js';

export interface OnDutyStaff {
  userId: string;
  fullName: string;
  academicTitle: string | null;
  connections: number;
}

/**
 * Nhân viên đang trực (đang kết nối) theo cơ sở. Một người có thể mở nhiều tab — đếm số kết nối.
 * Lưu trong bộ nhớ (một tiến trình API); chạy nhiều instance cần Socket.io Redis adapter (Task 5.3).
 */
@Injectable()
export class PresenceService {
  private readonly byFacility = new Map<string, Map<string, OnDutyStaff>>();

  /** Trả true nếu đây là kết nối đầu tiên của người này (danh sách trực thay đổi). */
  join(user: SocketUser): boolean {
    if (!user.facilityId) return false;
    const staff = this.byFacility.get(user.facilityId) ?? new Map<string, OnDutyStaff>();
    this.byFacility.set(user.facilityId, staff);
    const current = staff.get(user.id);
    if (current) {
      current.connections++;
      return false;
    }
    staff.set(user.id, {
      userId: user.id,
      fullName: user.fullName,
      academicTitle: user.academicTitle,
      connections: 1,
    });
    return true;
  }

  /** Trả true nếu người này không còn kết nối nào. */
  leave(user: SocketUser): boolean {
    const staff = user.facilityId ? this.byFacility.get(user.facilityId) : undefined;
    const current = staff?.get(user.id);
    if (!staff || !current) return false;
    if (--current.connections > 0) return false;
    staff.delete(user.id);
    if (staff.size === 0) this.byFacility.delete(user.facilityId!);
    return true;
  }

  onDuty(facilityId: string): OnDutyStaff[] {
    return [...(this.byFacility.get(facilityId)?.values() ?? [])].sort((a, b) =>
      a.fullName.localeCompare(b.fullName, 'vi'),
    );
  }

  isStaffed(facilityId: string): boolean {
    return (this.byFacility.get(facilityId)?.size ?? 0) > 0;
  }
}
