/**
 * Đặt lịch khám (Task 2.3): khung giờ trống, đặt lịch, chống đặt trùng, duyệt/huỷ/tiếp đón.
 * Cơ sở test mở cửa mọi ngày 07:00–17:00, khung 30 phút, 1 bác sĩ/chuyên khoa → sức chứa 1.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/auth/password.js';
import { addDays, vnDateOf, vnStartOfDay } from '../src/common/vn-time.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const PASSWORD = 'TestPass123';
const tag = `ap${Date.now().toString(36)}`;
const tomorrow = addDays(vnDateOf(new Date()), 1);
/** Thời điểm hh:mm giờ VN ngày mai, dạng ISO */
const at = (hh: number, mm = 0, date = tomorrow) =>
  new Date(vnStartOfDay(date).getTime() + (hh * 60 + mm) * 60_000).toISOString();

interface Appt {
  id: string;
  code: string;
  status: string;
  medicalRecord: { id: string; status: string } | null;
}

describe('Đặt lịch khám (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let dbReady = false;
  const ids = { users: [] as string[], patients: [] as string[], facilities: [] as string[] };
  const t = {} as Record<'patientA' | 'patientB' | 'patientC' | 'staff' | 'otherStaff', string>;
  let facilityId = '';
  let otherFacilityId = '';
  let specialtyId = '';
  let unofferedSpecialtyId = '';
  let otherDoctorId = '';

  const http = () => request(app.getHttpServer());
  const bearer = (who: keyof typeof t) => ({ Authorization: `Bearer ${t[who]}` });
  const book = (who: keyof typeof t, startAt: string, extra: Record<string, unknown> = {}) =>
    http()
      .post('/api/appointments')
      .set(bearer(who))
      .send({ facilityId, specialtyId, startAt, reason: 'Khám tổng quát', ...extra });
  const slotsOf = async (date = tomorrow) =>
    (
      await http()
        .get(`/api/facilities/${facilityId}/slots?date=${date}&specialtyId=${specialtyId}`)
        .expect(200)
    ).body as { startAt: string; remaining: number; available: boolean }[];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    dbReady = (await prisma.isHealthy()) && (await prisma.specialty.count()) > 0;
    if (!dbReady) return console.warn('⚠️  Bỏ qua e2e đặt lịch: DB chưa sẵn sàng hoặc chưa seed.');

    const [spec, unoffered] = await Promise.all([
      prisma.specialty.findUniqueOrThrow({ where: { code: 'GENERAL_INTERNAL' } }),
      prisma.specialty.findUniqueOrThrow({ where: { code: 'ONCOLOGY' } }),
    ]);
    specialtyId = spec.id;
    unofferedSpecialtyId = unoffered.id;
    const allDay = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
      dayOfWeek: d,
      startMinute: 7 * 60,
      endMinute: 17 * 60,
    }));
    const mkFacility = (k: string) =>
      prisma.healthFacility.create({
        data: {
          code: `E2E-${k}-${tag}`,
          name: `Trạm ${k} ${tag}`,
          type: 'COMMUNE_HEALTH_STATION',
          level: 'PRIMARY',
          communeCode: '02761',
          slotDurationMinutes: 30,
          openingHours: { create: allDay },
          specialties: { create: { specialtyId } },
        },
      });
    const [facility, other] = await Promise.all([mkFacility('A'), mkFacility('B')]);
    facilityId = facility.id;
    otherFacilityId = other.id;
    ids.facilities.push(facilityId, otherFacilityId);

    const passwordHash = await hashPassword(PASSWORD);
    const mkStaff = (k: string, fid: string) =>
      prisma.user.create({
        data: {
          email: `${k}-${tag}@e2e.test`,
          passwordHash,
          fullName: k,
          role: 'COMMUNE_STAFF',
          staffProfile: { create: { facilityId: fid, position: 'DOCTOR', specialtyId } },
        },
      });
    const [staff, otherStaff] = await Promise.all([
      mkStaff('staff', facilityId),
      mkStaff('other', otherFacilityId),
    ]);
    otherDoctorId = otherStaff.id;
    ids.users.push(staff.id, otherStaff.id);

    for (const k of ['patientA', 'patientB', 'patientC'] as const) {
      const u = await prisma.user.create({
        data: {
          email: `${k.toLowerCase()}-${tag}@e2e.test`,
          passwordHash,
          fullName: k,
          role: 'PATIENT',
          patient: { create: { fullName: k, dateOfBirth: new Date('1990-01-01'), gender: 'MALE' } },
        },
        include: { patient: true },
      });
      ids.users.push(u.id);
      ids.patients.push(u.patient!.id);
    }

    const login = async (email: string) =>
      (
        (
          await http()
            .post('/api/auth/login')
            .send({ identifier: email, password: PASSWORD })
            .expect(200)
        ).body as {
          accessToken: string;
        }
      ).accessToken;
    for (const k of ['patientA', 'patientB', 'patientC', 'staff'] as const)
      t[k] = await login(`${k.toLowerCase()}-${tag}@e2e.test`);
    t.otherStaff = await login(`other-${tag}@e2e.test`);
  });

  afterAll(async () => {
    if (dbReady) {
      await prisma.auditLog.deleteMany({ where: { userId: { in: ids.users } } });
      await prisma.medicalRecord.deleteMany({ where: { patientId: { in: ids.patients } } });
      await prisma.appointment.deleteMany({ where: { patientId: { in: ids.patients } } });
      await prisma.patient.deleteMany({ where: { id: { in: ids.patients } } });
      await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
      await prisma.healthFacility.deleteMany({ where: { id: { in: ids.facilities } } });
    }
    await app.close();
  });

  it('danh sách cơ sở và chi tiết (công khai)', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const list = (await http().get('/api/facilities?communeCode=02761').expect(200)).body as {
      id: string;
    }[];
    expect(list.map((f) => f.id)).toContain(facilityId);
    const detail = await http().get(`/api/facilities/${facilityId}`).expect(200);
    expect(detail.body).toMatchObject({
      specialties: [{ id: specialtyId }],
      doctors: [{ fullName: 'staff' }],
    });
  });

  it('khung giờ trống: 20 khung 30 phút từ 07:00 đến 17:00', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const slots = await slotsOf();
    expect(slots).toHaveLength(20);
    expect(slots[0]).toMatchObject({ startAt: at(7), remaining: 1, available: true });
  });

  it('đặt lịch thành công, khung giờ hết chỗ, người sau bị từ chối', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const res = await book('patientA', at(9)).expect(201);
    expect(res.body).toMatchObject({
      status: 'PENDING',
      code: expect.stringMatching(/^LH[A-Z2-9]{6}$/),
    });

    const slot = (await slotsOf()).find((s) => s.startAt === at(9));
    expect(slot).toMatchObject({ remaining: 0, available: false });
    const conflict = await book('patientB', at(9)).expect(409);
    expect((conflict.body as { message: string }).message).toMatch(/hết chỗ/);
  });

  it('hai bệnh nhân đặt cùng lúc khung cuối cùng: chỉ một người được', async (ctx) => {
    if (!dbReady) return ctx.skip();
    // patientA và patientB tranh nhau; patientC giữ nguyên để dùng cho test giới hạn số lịch
    const results = await Promise.all([book('patientA', at(10)), book('patientB', at(10))]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });

  it('từ chối khung lệch lưới, giờ đã qua, quá 30 ngày, chuyên khoa không nhận, bác sĩ cơ sở khác', async (ctx) => {
    if (!dbReady) return ctx.skip();
    await book('patientC', at(9, 7)).expect(400);
    await book('patientC', at(9, 0, addDays(tomorrow, -2))).expect(400);
    await book('patientC', at(9, 0, addDays(tomorrow, 40))).expect(400);
    await book('patientC', at(11), { specialtyId: unofferedSpecialtyId }).expect(400);
    await book('patientC', at(11), { doctorId: otherDoctorId }).expect(400);
    await http()
      .get(
        `/api/facilities/${facilityId}/slots?date=${addDays(tomorrow, 40)}&specialtyId=${specialtyId}`,
      )
      .expect(400);
  });

  it('bệnh nhân không đặt hai lịch trùng giờ ở hai nơi', async (ctx) => {
    if (!dbReady) return ctx.skip();
    // Cùng giờ 09:00 nhưng tại cơ sở B (còn chỗ) — patientA đã có lịch 09:00 ở cơ sở A
    const res = await http()
      .post('/api/appointments')
      .set(bearer('patientA'))
      .send({ facilityId: otherFacilityId, specialtyId, startAt: at(9), reason: 'Khám lại' })
      .expect(409);
    expect((res.body as { message: string }).message).toMatch(/lịch hẹn khác/);
  });

  it('giới hạn 5 lịch hẹn chưa khám mỗi bệnh nhân', async (ctx) => {
    if (!dbReady) return ctx.skip();
    // patientC chưa có lịch nào còn hiệu lực
    for (const h of [12, 13, 14, 15, 16]) await book('patientC', at(h)).expect(201);
    const res = await book('patientC', at(16, 30)).expect(400);
    expect((res.body as { message: string }).message).toMatch(/5 lịch hẹn/);
  });

  it('bệnh nhân xem và tự huỷ lịch; khung giờ được trả lại', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const mine = (await http().get('/api/appointments/me').set(bearer('patientC')).expect(200))
      .body as Appt[];
    const target = mine[0];
    // Bệnh nhân khác không huỷ được (404 để không lộ lịch)
    await http()
      .post(`/api/appointments/${target.id}/cancel`)
      .set(bearer('patientA'))
      .send({ reason: 'Bận' })
      .expect(404);
    const cancelled = await http()
      .post(`/api/appointments/${target.id}/cancel`)
      .set(bearer('patientC'))
      .send({ reason: 'Có việc bận' })
      .expect(200);
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', cancelledByPatient: true });
    expect((await slotsOf()).find((s) => s.startAt === at(12))).toMatchObject({
      remaining: 1,
      available: true,
    });
    const past = (
      await http().get('/api/appointments/me?scope=past').set(bearer('patientC')).expect(200)
    ).body as Appt[];
    expect(past.map((a) => a.id)).toContain(target.id);
  });

  it('cơ sở: xem lịch trong ngày, duyệt, tiếp đón tạo phiếu khám nháp; cơ sở khác không thao tác được', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const day = (
      await http()
        .get(`/api/appointments/facility?date=${tomorrow}`)
        .set(bearer('staff'))
        .expect(200)
    ).body as (Appt & { patient: { fullName: string } })[];
    const a = day.find((x) => x.patient.fullName === 'patientA')!;
    expect(a.status).toBe('PENDING');

    await http().post(`/api/appointments/${a.id}/confirm`).set(bearer('otherStaff')).expect(404);
    await http().post(`/api/appointments/${a.id}/confirm`).set(bearer('patientA')).expect(403);
    await http().post(`/api/appointments/${a.id}/confirm`).set(bearer('staff')).expect(200);
    await http().post(`/api/appointments/${a.id}/confirm`).set(bearer('staff')).expect(409);
    await http().post(`/api/appointments/${a.id}/no-show`).set(bearer('staff')).expect(409); // chưa tới giờ

    const checkedIn = (
      await http().post(`/api/appointments/${a.id}/check-in`).set(bearer('staff')).expect(200)
    ).body as Appt;
    expect(checkedIn.status).toBe('CHECKED_IN');
    expect(checkedIn.medicalRecord).toMatchObject({ status: 'DRAFT' });
    const record = await prisma.medicalRecord.findUniqueOrThrow({
      where: { id: checkedIn.medicalRecord!.id },
    });
    expect(record).toMatchObject({
      appointmentId: a.id,
      facilityId,
      specialtyId,
      chiefComplaint: 'Khám tổng quát',
    });

    // Đã tiếp đón thì bệnh nhân không tự huỷ được nữa
    await http()
      .post(`/api/appointments/${a.id}/cancel`)
      .set(bearer('patientA'))
      .send({ reason: 'Bận' })
      .expect(409);
  });

  it('nhân viên không xem được lịch của cơ sở khác qua tham số', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const res = await http()
      .get(`/api/appointments/facility?date=${tomorrow}&facilityId=${facilityId}`)
      .set(bearer('otherStaff'))
      .expect(200);
    expect(res.body).toEqual([]); // tham số facilityId bị bỏ qua với nhân viên
  });
});
