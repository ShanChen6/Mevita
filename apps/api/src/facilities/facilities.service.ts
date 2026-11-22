import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { addDays, addMinutes, vnDateOf, vnStartOfDay } from '../common/vn-time.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BOOKING_RULES, generateSlots, type Slot } from '../scheduling/slots.js';
import type { ListFacilitiesQuery, SlotsQuery } from './facilities.schemas.js';

/** Trạng thái lịch hẹn còn giữ chỗ */
export const ACTIVE_APPOINTMENT_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'CHECKED_IN',
  'COMPLETED',
] as const;

@Injectable()
export class FacilitiesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Cơ sở y tế đang hoạt động, có ít nhất một chuyên khoa nhận đặt lịch. */
  list({ provinceCode, communeCode, specialtyCode, q }: ListFacilitiesQuery) {
    const where: Prisma.HealthFacilityWhereInput = {
      isActive: true,
      specialties: {
        some: { isBookable: true, ...(specialtyCode && { specialty: { code: specialtyCode } }) },
      },
      ...(communeCode && { communeCode }),
      ...(provinceCode && { commune: { provinceCode } }),
      ...(q && { name: { contains: q, mode: 'insensitive' } }),
    };
    return this.prisma.healthFacility.findMany({
      where,
      select: {
        id: true,
        name: true,
        type: true,
        level: true,
        addressDetail: true,
        phone: true,
        commune: {
          select: {
            code: true,
            fullName: true,
            province: { select: { code: true, fullName: true } },
          },
        },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      take: 100,
    });
  }

  async get(id: string) {
    const facility = await this.prisma.healthFacility.findFirst({
      where: { id, isActive: true },
      select: {
        id: true,
        name: true,
        type: true,
        level: true,
        addressDetail: true,
        phone: true,
        slotDurationMinutes: true,
        commune: {
          select: {
            code: true,
            fullName: true,
            province: { select: { code: true, fullName: true } },
          },
        },
        specialties: {
          where: { isBookable: true },
          select: { specialty: { select: { id: true, code: true, name: true } } },
          orderBy: { specialty: { name: 'asc' } },
        },
        staff: {
          where: { position: 'DOCTOR', user: { isActive: true } },
          select: {
            userId: true,
            academicTitle: true,
            specialtyId: true,
            user: { select: { fullName: true } },
          },
          orderBy: { user: { fullName: 'asc' } },
        },
        openingHours: {
          select: { dayOfWeek: true, startMinute: true, endMinute: true },
          orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
        },
      },
    });
    if (!facility) throw new NotFoundException('Không tìm thấy cơ sở y tế');
    const { specialties, staff, ...rest } = facility;
    return {
      ...rest,
      specialties: specialties.map((s) => s.specialty),
      doctors: staff.map((d) => ({
        id: d.userId,
        fullName: d.user.fullName,
        academicTitle: d.academicTitle,
        specialtyId: d.specialtyId,
      })),
    };
  }

  /**
   * Khung giờ của một ngày cho chuyên khoa (và bác sĩ nếu chọn).
   * Sức chứa: chọn bác sĩ → 1 chỗ/khung; không chọn → số bác sĩ của chuyên khoa (tối thiểu 1).
   */
  async slots(
    { date, specialtyId, doctorId }: SlotsQuery,
    facilityId: string,
    now = new Date(),
  ): Promise<Slot[]> {
    const today = vnDateOf(now);
    if (date < today || date > addDays(today, BOOKING_RULES.maxDaysAhead)) {
      throw new BadRequestException(
        `Chỉ đặt lịch từ hôm nay đến ${BOOKING_RULES.maxDaysAhead} ngày tới`,
      );
    }
    const ctx = await this.bookingContext(facilityId, specialtyId, doctorId);

    const dayStart = vnStartOfDay(date);
    const booked = await this.prisma.appointment.groupBy({
      by: ['startAt'],
      where: {
        facilityId,
        status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
        startAt: { gte: dayStart, lt: addMinutes(dayStart, 24 * 60) },
        ...(doctorId ? { doctorId } : { specialtyId }),
      },
      _count: { _all: true },
    });

    return generateSlots({
      date,
      sessions: ctx.openingHours,
      slotMinutes: ctx.slotDurationMinutes,
      capacity: ctx.capacity,
      booked: new Map(booked.map((b) => [b.startAt.toISOString(), b._count._all])),
      now,
    });
  }

  /** Kiểm tra cơ sở/chuyên khoa/bác sĩ hợp lệ để đặt lịch; dùng chung cho tra khung giờ và tạo lịch. */
  async bookingContext(facilityId: string, specialtyId: string, doctorId?: string | null) {
    const facility = await this.prisma.healthFacility.findFirst({
      where: { id: facilityId, isActive: true },
      select: {
        slotDurationMinutes: true,
        openingHours: { select: { dayOfWeek: true, startMinute: true, endMinute: true } },
        specialties: { where: { specialtyId, isBookable: true }, select: { specialtyId: true } },
      },
    });
    if (!facility) throw new NotFoundException('Không tìm thấy cơ sở y tế');
    if (facility.specialties.length === 0) {
      throw new BadRequestException('Cơ sở không nhận đặt lịch cho chuyên khoa này');
    }

    if (doctorId) {
      const doctor = await this.prisma.staffProfile.findFirst({
        where: { userId: doctorId, facilityId, position: 'DOCTOR', user: { isActive: true } },
        select: { userId: true },
      });
      if (!doctor) throw new BadRequestException('Bác sĩ không làm việc tại cơ sở này');
      return { ...facility, capacity: 1 };
    }

    const doctors = await this.prisma.staffProfile.count({
      where: { facilityId, specialtyId, position: 'DOCTOR', user: { isActive: true } },
    });
    return { ...facility, capacity: Math.max(1, doctors) };
  }
}
