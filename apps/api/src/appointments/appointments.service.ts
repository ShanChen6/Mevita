import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { generateCode } from '../common/codes.js';
import { addDays, addMinutes, vnDateOf, vnStartOfDay } from '../common/vn-time.js';
import {
  ACTIVE_APPOINTMENT_STATUSES,
  FacilitiesService,
} from '../facilities/facilities.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BOOKING_RULES, generateSlots } from '../scheduling/slots.js';
import { nextStatus, type AppointmentAction } from './appointment-status.js';
import type {
  CreateAppointmentInput,
  FacilityAppointmentsQuery,
  MyAppointmentsQuery,
} from './appointments.schemas.js';

const appointmentSelect = {
  id: true,
  code: true,
  startAt: true,
  endAt: true,
  status: true,
  reason: true,
  initialSymptoms: true,
  cancellationReason: true,
  cancelledByPatient: true,
  confirmedAt: true,
  checkedInAt: true,
  cancelledAt: true,
  createdAt: true,
  facility: {
    select: {
      id: true,
      name: true,
      type: true,
      addressDetail: true,
      phone: true,
      commune: { select: { fullName: true, province: { select: { fullName: true } } } },
    },
  },
  specialty: { select: { id: true, code: true, name: true } },
  doctor: {
    select: { id: true, fullName: true, staffProfile: { select: { academicTitle: true } } },
  },
  medicalRecord: { select: { id: true, code: true, status: true } },
} satisfies Prisma.AppointmentSelect;

const staffAppointmentSelect = {
  ...appointmentSelect,
  patient: {
    select: {
      id: true,
      fullName: true,
      dateOfBirth: true,
      gender: true,
      phone: true,
      nationalId: true,
      healthInsuranceNumber: true,
      allergies: true,
    },
  },
} satisfies Prisma.AppointmentSelect;

const isStaff = (u: AuthUser) => u.role === 'COMMUNE_STAFF' || u.role === 'PROVINCE_STAFF';

/** Lỗi trùng do ràng buộc DB → thông báo dễ hiểu (null nếu là trùng mã, cần sinh lại). */
function conflictMessage(error: Prisma.PrismaClientKnownRequestError): string | null {
  const meta = JSON.stringify(error.meta ?? {});
  if (meta.includes('doctor_active_slot'))
    return 'Bác sĩ đã kín lịch vào khung giờ này, vui lòng chọn giờ khác';
  if (meta.includes('patient_active_slot')) return 'Bạn đã có một lịch hẹn khác vào đúng giờ này';
  return null;
}

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly facilities: FacilitiesService,
    private readonly audit: AuditService,
  ) {}

  /** Bệnh nhân đặt lịch. Khung giờ phải đúng lưới khung của cơ sở và còn chỗ. */
  async create(
    user: AuthUser & { patientId: string },
    input: CreateAppointmentInput,
    now = new Date(),
  ) {
    const startAt = new Date(input.startAt);
    const date = vnDateOf(startAt);
    const today = vnDateOf(now);
    if (startAt < addMinutes(now, BOOKING_RULES.minLeadMinutes)) {
      throw new BadRequestException(
        `Cần đặt trước giờ khám ít nhất ${BOOKING_RULES.minLeadMinutes} phút`,
      );
    }
    if (date > addDays(today, BOOKING_RULES.maxDaysAhead)) {
      throw new BadRequestException(
        `Chỉ đặt lịch trong vòng ${BOOKING_RULES.maxDaysAhead} ngày tới`,
      );
    }

    const ctx = await this.facilities.bookingContext(
      input.facilityId,
      input.specialtyId,
      input.doctorId,
    );
    const slot = generateSlots({
      date,
      sessions: ctx.openingHours,
      slotMinutes: ctx.slotDurationMinutes,
      capacity: ctx.capacity,
      booked: new Map(),
      now,
    }).find((s) => s.startAt === startAt.toISOString());
    if (!slot) throw new BadRequestException('Khung giờ không nằm trong giờ làm việc của cơ sở');

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const created = await this.prisma.$transaction(async (tx) => {
          // Khoá theo khung giờ để hai người đặt cùng lúc không vượt quá sức chứa
          const lockKey = `appt:${input.facilityId}:${input.doctorId ?? input.specialtyId}:${slot.startAt}`;
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;

          const active = await tx.appointment.count({
            where: {
              patientId: user.patientId,
              status: { in: ['PENDING', 'CONFIRMED'] },
              startAt: { gte: now },
            },
          });
          if (active >= BOOKING_RULES.maxActivePerPatient) {
            throw new BadRequestException(
              `Bạn đang có ${active} lịch hẹn chưa khám. Vui lòng huỷ bớt trước khi đặt thêm.`,
            );
          }

          const taken = await tx.appointment.count({
            where: {
              facilityId: input.facilityId,
              startAt,
              status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
              ...(input.doctorId
                ? { doctorId: input.doctorId }
                : { specialtyId: input.specialtyId }),
            },
          });
          if (taken >= ctx.capacity)
            throw new ConflictException('Khung giờ này vừa hết chỗ, vui lòng chọn giờ khác');

          return tx.appointment.create({
            data: {
              code: generateCode('LH'),
              patientId: user.patientId,
              facilityId: input.facilityId,
              specialtyId: input.specialtyId,
              doctorId: input.doctorId ?? null,
              startAt,
              endAt: new Date(slot.endAt),
              reason: input.reason,
              initialSymptoms: input.initialSymptoms,
            },
            select: appointmentSelect,
          });
        });
        await this.audit.log({
          userId: user.id,
          action: 'CREATE',
          entityType: 'Appointment',
          entityId: created.id,
        });
        return created;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const message = conflictMessage(error);
          if (message) throw new ConflictException(message);
          continue; // trùng mã lịch hẹn ngẫu nhiên — thử lại
        }
        throw error;
      }
    }
    throw new ConflictException('Không tạo được mã lịch hẹn, vui lòng thử lại');
  }

  /** Lịch hẹn của bệnh nhân: sắp tới (gần nhất trước) hoặc đã qua (mới nhất trước). */
  listMine(patientId: string, { scope }: MyAppointmentsQuery, now = new Date()) {
    const upcoming = scope === 'upcoming';
    return this.prisma.appointment.findMany({
      where: upcoming
        ? {
            patientId,
            status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
            endAt: { gte: addMinutes(now, -12 * 60) },
          }
        : {
            patientId,
            OR: [
              { status: { in: ['COMPLETED', 'CANCELLED', 'NO_SHOW'] } },
              { endAt: { lt: addMinutes(now, -12 * 60) } },
            ],
          },
      select: appointmentSelect,
      orderBy: { startAt: upcoming ? 'asc' : 'desc' },
      take: 50,
    });
  }

  /** Danh sách lịch hẹn trong ngày của cơ sở (màn hình tiếp đón). */
  listForFacility(user: AuthUser, { date, status, facilityId }: FacilityAppointmentsQuery) {
    const targetFacility = user.role === 'ADMIN' ? facilityId : user.facilityId;
    if (!targetFacility) {
      throw new BadRequestException(
        user.role === 'ADMIN' ? 'Cần chọn cơ sở y tế' : 'Tài khoản chưa gắn cơ sở công tác',
      );
    }
    const dayStart = vnStartOfDay(date);
    return this.prisma.appointment.findMany({
      where: {
        facilityId: targetFacility,
        status,
        startAt: { gte: dayStart, lt: addMinutes(dayStart, 24 * 60) },
      },
      select: staffAppointmentSelect,
      orderBy: [{ startAt: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /** Lấy lịch hẹn và kiểm tra người thao tác có quyền: bệnh nhân chủ lịch hoặc nhân viên cơ sở. */
  private async loadForAction(id: string, user: AuthUser) {
    const appt = await this.prisma.appointment.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        startAt: true,
        facilityId: true,
        patientId: true,
        doctorId: true,
        specialtyId: true,
        reason: true,
        initialSymptoms: true,
      },
    });
    const allowed =
      appt &&
      (user.role === 'ADMIN' ||
        (user.role === 'PATIENT' && appt.patientId === user.patientId) ||
        (isStaff(user) && appt.facilityId === user.facilityId));
    // Không phân biệt "không tồn tại" và "không có quyền" để tránh dò mã
    if (!appt || !allowed) throw new NotFoundException('Không tìm thấy lịch hẹn');
    return appt;
  }

  private ensure(current: Parameters<typeof nextStatus>[0], action: AppointmentAction) {
    const to = nextStatus(current, action);
    if (!to) throw new ConflictException('Lịch hẹn không ở trạng thái cho phép thao tác này');
    return to;
  }

  async confirm(id: string, user: AuthUser) {
    const appt = await this.loadForAction(id, user);
    if (user.role === 'PATIENT')
      throw new ForbiddenException('Chỉ cơ sở y tế mới duyệt được lịch hẹn');
    const status = this.ensure(appt.status, 'confirm');
    return this.transition(
      id,
      user,
      appt.status,
      { status, confirmedAt: new Date(), handledById: user.id },
      'confirm',
    );
  }

  async cancel(id: string, user: AuthUser, reason: string, now = new Date()) {
    const appt = await this.loadForAction(id, user);
    const status = this.ensure(appt.status, 'cancel');
    const byPatient = user.role === 'PATIENT';
    if (byPatient && appt.startAt <= now)
      throw new ConflictException('Lịch hẹn đã tới giờ, không thể tự huỷ');
    return this.transition(
      id,
      user,
      appt.status,
      {
        status,
        cancelledAt: now,
        cancellationReason: reason,
        cancelledByPatient: byPatient,
        ...(!byPatient && { handledById: user.id }),
      },
      'cancel',
    );
  }

  async markNoShow(id: string, user: AuthUser, now = new Date()) {
    const appt = await this.loadForAction(id, user);
    if (user.role === 'PATIENT') throw new ForbiddenException('Không có quyền');
    const status = this.ensure(appt.status, 'no-show');
    if (appt.startAt > now) throw new ConflictException('Chưa tới giờ hẹn');
    return this.transition(id, user, appt.status, { status, handledById: user.id }, 'no-show');
  }

  /**
   * Tiếp đón: chuyển lịch hẹn thành phiếu khám (hồ sơ nháp) để bác sĩ khám (Task 3.2).
   * Bác sĩ của phiếu = bác sĩ bệnh nhân đã chọn, nếu không thì người tiếp đón
   * (bác sĩ thực khám được ghi lại khi ký hồ sơ).
   */
  async checkIn(id: string, user: AuthUser) {
    const appt = await this.loadForAction(id, user);
    if (user.role === 'PATIENT') throw new ForbiddenException('Không có quyền');
    const status = this.ensure(appt.status, 'check-in');

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await this.prisma.$transaction(async (tx) => {
          const { count } = await tx.appointment.updateMany({
            where: { id, status: appt.status },
            data: { status, checkedInAt: new Date(), handledById: user.id },
          });
          if (count === 0)
            throw new ConflictException('Lịch hẹn vừa được người khác cập nhật, vui lòng tải lại');
          await tx.medicalRecord.create({
            data: {
              code: generateCode('BA'),
              patientId: appt.patientId,
              facilityId: appt.facilityId,
              doctorId: appt.doctorId ?? user.id,
              specialtyId: appt.specialtyId,
              appointmentId: appt.id,
              chiefComplaint: appt.reason,
              symptoms: appt.initialSymptoms,
            },
          });
          return tx.appointment.findUniqueOrThrow({
            where: { id },
            select: staffAppointmentSelect,
          });
        });
        await this.audit.log({
          userId: user.id,
          action: 'UPDATE',
          entityType: 'Appointment',
          entityId: id,
          metadata: { action: 'check-in' },
        });
        return result;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
          continue;
        throw error;
      }
    }
    throw new ConflictException('Không tạo được phiếu khám, vui lòng thử lại');
  }

  /** Cập nhật trạng thái có điều kiện (chống hai người thao tác cùng lúc). */
  private async transition(
    id: string,
    user: AuthUser,
    from: Parameters<typeof nextStatus>[0],
    data: Prisma.AppointmentUncheckedUpdateManyInput,
    action: AppointmentAction,
  ) {
    const { count } = await this.prisma.appointment.updateMany({
      where: { id, status: from },
      data,
    });
    if (count === 0)
      throw new ConflictException('Lịch hẹn vừa được người khác cập nhật, vui lòng tải lại');
    await this.audit.log({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Appointment',
      entityId: id,
      metadata: { action },
    });
    return this.prisma.appointment.findUniqueOrThrow({
      where: { id },
      select: user.role === 'PATIENT' ? appointmentSelect : staffAppointmentSelect,
    });
  }
}
