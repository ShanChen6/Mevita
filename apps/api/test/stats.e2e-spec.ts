/**
 * Thống kê & quản trị (Task 5.2). Dữ liệu riêng đặt ở tháng 1/2001 để số liệu tách biệt hoàn toàn.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const PASSWORD = 'TestPass123';
const tag = `st${Date.now().toString(36)}`;
const at = (d: number, h = 3) => new Date(Date.UTC(2001, 0, d, h)); // 10h giờ VN

interface Overview {
  range: { unit: string };
  kpis: Record<string, number | null>;
  appointmentsTrend: { bucket: string; status: string; n: number }[];
  stations: { name: string; visits: number; referrals: number; rate: number }[];
  provinces: { code: string; visits: number; referrals: number; rate: number }[];
  topDiagnoses: { code: string; n: number }[];
  diseasePattern: {
    chapters: string[];
    rows: { province: string; total: number; shares: number[] }[];
  };
  flows: { fromName: string; toName: string; inter: boolean; n: number }[];
  referralPriority: { priority: string; n: number }[];
}

describe('Thống kê & quản trị (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let dbReady = false;
  const ids = { users: [] as string[], patients: [] as string[], facilities: [] as string[] };
  const token = {} as Record<'admin' | 'staff' | 'victim', string>;
  let victimId = '';
  let adminId = '';
  let c1Id = '';
  let hospitalId = '';
  let patientId = '';
  let staffId = '';
  const http = () => request(app.getHttpServer());
  const as = (k: keyof typeof token) => ({ Authorization: `Bearer ${token[k]}` });
  const overview = async (q = '') =>
    (
      await http()
        .get(`/api/stats/overview?from=2001-01-01&to=2001-01-31${q}`)
        .set(as('admin'))
        .expect(200)
    ).body as Overview;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    dbReady =
      (await prisma.isHealthy()) &&
      (await prisma.icd10Code.count({ where: { code: { in: ['J18.9', 'I10', 'S06.5'] } } })) === 3;
    if (!dbReady) return console.warn('⚠️  Bỏ qua e2e thống kê: DB chưa sẵn sàng hoặc chưa seed.');

    const mk = (
      k: string,
      communeCode: string,
      type: 'COMMUNE_HEALTH_STATION' | 'PROVINCIAL_GENERAL_HOSPITAL',
    ) =>
      prisma.healthFacility.create({
        data: {
          code: `E${k}-${tag}`,
          name: `${k} ${tag}`,
          type,
          level: type === 'COMMUNE_HEALTH_STATION' ? 'PRIMARY' : 'BASIC',
          communeCode,
          acceptsReferrals: type !== 'COMMUNE_HEALTH_STATION',
        },
      });
    const [laoCai, hanoi, hospital] = await Promise.all([
      mk('TLC', '02761', 'COMMUNE_HEALTH_STATION'), // Lào Cai
      mk('THN', '00082', 'COMMUNE_HEALTH_STATION'), // Hà Nội
      mk('BHN', '00082', 'PROVINCIAL_GENERAL_HOSPITAL'), // Hà Nội
    ]);
    ids.facilities.push(laoCai.id, hanoi.id, hospital.id);
    const passwordHash = await hashPassword(PASSWORD);
    const user = (k: string, role: 'ADMIN' | 'COMMUNE_STAFF', facilityId?: string) =>
      prisma.user.create({
        data: {
          email: `${k}-${tag}@e2e.test`,
          passwordHash,
          fullName: `Người dùng ${k} ${tag}`,
          role,
          ...(facilityId && { staffProfile: { create: { facilityId, position: 'DOCTOR' } } }),
        },
      });
    const [admin, staff, victim] = await Promise.all([
      user('admin', 'ADMIN'),
      user('staff', 'COMMUNE_STAFF', laoCai.id),
      user('victim', 'COMMUNE_STAFF', hanoi.id),
    ]);
    ids.users.push(admin.id, staff.id, victim.id);
    adminId = admin.id;
    victimId = victim.id;
    const patient = await prisma.patient.create({
      data: { fullName: `BN ${tag}`, dateOfBirth: new Date('1980-01-01'), gender: 'MALE' },
    });
    ids.patients.push(patient.id);

    // Lịch hẹn ở trạm Lào Cai: 2 đã khám, 1 huỷ, 1 không đến
    let n = 0;
    for (const status of ['COMPLETED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const)
      await prisma.appointment.create({
        data: {
          code: `E2E${tag}A${++n}`,
          patientId: patient.id,
          facilityId: laoCai.id,
          startAt: at(10 + n),
          endAt: at(10 + n, 4),
          reason: 'Khám',
          status,
        },
      });
    // Lượt khám đã ký: Lào Cai 4 (3 viêm phổi, 1 chấn thương), Hà Nội 2 (tăng huyết áp), 1 nháp không tính
    const rec = (k: string, facilityId: string, icd: string, d: number, finalized = true) =>
      prisma.medicalRecord.create({
        data: {
          code: `E2E${tag}${k}`,
          patientId: patient.id,
          doctorId: staff.id,
          facilityId,
          visitAt: at(d),
          chiefComplaint: 'Khám',
          status: finalized ? 'FINALIZED' : 'DRAFT',
          signedAt: finalized ? at(d, 4) : null,
          signatureHash: finalized ? 'a'.repeat(64) : null,
          diagnoses: { create: { icdCode: icd, isPrimary: true } },
        },
      });
    const r1 = await rec('R1', laoCai.id, 'J18.9', 5);
    await rec('R2', laoCai.id, 'J18.9', 6);
    await rec('R3', laoCai.id, 'J18.9', 20);
    const r4 = await rec('R4', laoCai.id, 'S06.5', 21);
    await rec('R5', hanoi.id, 'I10', 7);
    await rec('R6', hanoi.id, 'I10', 8);
    await rec('R7', laoCai.id, 'I10', 9, false);
    // 2 phiếu chuyển tuyến liên tỉnh Lào Cai → Hà Nội: 1 đã tới (tiếp nhận sau 4 phút), 1 bị từ chối
    const ref = (
      k: string,
      sourceRecordId: string,
      d: number,
      status: 'ARRIVED' | 'REJECTED',
      priority: 'CRITICAL' | 'URGENT',
    ) =>
      prisma.referral.create({
        data: {
          code: `E2E${tag}${k}`,
          patientId: patient.id,
          sourceRecordId,
          fromFacilityId: laoCai.id,
          toFacilityId: hospital.id,
          referredById: staff.id,
          priority,
          status,
          reason: 'Vượt khả năng',
          clinicalSummary: 'Tóm tắt',
          createdAt: at(d),
          departedAt: at(d),
          acceptedAt: new Date(at(d).getTime() + 4 * 60_000),
          ...(status === 'ARRIVED' && { arrivedAt: new Date(at(d).getTime() + 90 * 60_000) }),
        },
      });
    c1Id = (await ref('C1', r1.id, 5, 'ARRIVED', 'CRITICAL')).id;
    hospitalId = hospital.id;
    patientId = patient.id;
    staffId = staff.id;
    await ref('C2', r4.id, 21, 'REJECTED', 'URGENT');

    for (const k of ['admin', 'staff', 'victim'] as const)
      token[k] = (
        (
          await http()
            .post('/api/auth/login')
            .send({ identifier: `${k}-${tag}@e2e.test`, password: PASSWORD })
            .expect(200)
        ).body as { accessToken: string }
      ).accessToken;
  });

  afterAll(async () => {
    if (dbReady) {
      await prisma.auditLog.deleteMany({
        where: { OR: [{ userId: { in: ids.users } }, { entityId: { in: ids.users } }] },
      });
      await prisma.referral.deleteMany({ where: { patientId: { in: ids.patients } } });
      await prisma.medicalRecord.deleteMany({ where: { patientId: { in: ids.patients } } });
      await prisma.appointment.deleteMany({ where: { patientId: { in: ids.patients } } });
      await prisma.patient.deleteMany({ where: { id: { in: ids.patients } } });
      await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
      await prisma.healthFacility.deleteMany({ where: { id: { in: ids.facilities } } });
    }
    await app.close();
  });

  it('chỉ quản trị viên xem được thống kê; kiểm tra tham số', async (ctx) => {
    if (!dbReady) return ctx.skip();
    await http().get('/api/stats/overview?from=2001-01-01&to=2001-01-31').expect(401);
    await http()
      .get('/api/stats/overview?from=2001-01-01&to=2001-01-31')
      .set(as('staff'))
      .expect(403);
    await http()
      .get('/api/stats/overview?from=2001-02-01&to=2001-01-01')
      .set(as('admin'))
      .expect(400);
    await http()
      .get('/api/stats/overview?from=2001-01-01&to=2004-01-01')
      .set(as('admin'))
      .expect(400);
    const provinces = (await http().get('/api/stats/provinces').set(as('admin')).expect(200))
      .body as { code: string }[];
    expect(provinces.map((p) => p.code)).toEqual(expect.arrayContaining(['01', '15']));
  });

  it('KPI, tỉ lệ chuyển tuyến, mô hình bệnh tật và luồng chuyển tuyến', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const o = await overview();
    expect(o.range.unit).toBe('day');
    expect(o.kpis).toMatchObject({
      appointments: 4,
      appointmentsCompleted: 2,
      cancelRate: 25,
      noShowRate: 25,
      visits: 6, // bản nháp không tính
      communeVisits: 6,
      referrals: 2,
      communeReferralRate: 33.3, // 2 / 6
      interProvincial: 2,
      arrived: 1,
      rejected: 1,
      medianAcceptMinutes: 4,
      medianTransportMinutes: 90,
      onwardReferrals: 0,
      stabilizeForward: 0,
      hospitalReferrals: 0,
    });
    expect(o.referralPriority).toEqual([
      { priority: 'CRITICAL', n: 1 },
      { priority: 'URGENT', n: 1 },
      { priority: 'ROUTINE', n: 0 },
    ]);
    const lc = o.stations.find((s) => s.name === `TLC ${tag}`);
    expect(lc).toMatchObject({ visits: 4, referrals: 2, rate: 50 });
    expect(o.provinces.find((p) => p.code === '15')).toMatchObject({
      visits: 4,
      referrals: 2,
      rate: 50,
    });
    expect(o.topDiagnoses.slice(0, 2)).toEqual([
      expect.objectContaining({ code: 'J18.9', n: 3 }),
      expect.objectContaining({ code: 'I10', n: 2 }),
    ]);
    const x = o.diseasePattern.chapters.indexOf('X');
    const lcRow = o.diseasePattern.rows.find((r) => r.province === '15');
    expect(lcRow).toMatchObject({ total: 4 });
    expect(lcRow?.shares[x]).toBe(75); // 3/4 hô hấp
    expect(o.flows).toEqual([
      expect.objectContaining({ fromName: 'Lào Cai', toName: 'Hà Nội', inter: true, n: 2 }),
    ]);
    expect(o.appointmentsTrend).toContainEqual({ bucket: '2001-01-11', status: 'COMPLETED', n: 1 });

    // Lọc theo tỉnh Hà Nội: chỉ 2 lượt khám, không có phiếu chuyển đi
    const hn = await overview('&province=01');
    expect(hn.kpis).toMatchObject({
      appointments: 0,
      visits: 2,
      referrals: 0,
      communeReferralRate: 0,
    });
    expect(hn.diseasePattern.rows.map((r) => r.province)).toEqual(['01']);

    // Khoảng dài → gộp theo tuần/tháng
    const long = (
      await http()
        .get('/api/stats/overview?from=2000-01-01&to=2001-12-31')
        .set(as('admin'))
        .expect(200)
    ).body as Overview;
    expect(long.range.unit).toBe('month');
  });

  it('hành trình nhiều chặng: đếm chặng chuyển tiếp và ca nhận để ổn định (Task A)', async (ctx) => {
    if (!dbReady) return ctx.skip();
    // Tháng 2/2001: BV nhận ca C1 để ổn định → mở hồ sơ tiếp nối → chuyển tiếp đi nơi khác
    await prisma.referral.update({
      where: { id: c1Id },
      data: { acceptanceType: 'STABILIZE_FORWARD' },
    });
    const cont = await prisma.medicalRecord.create({
      data: {
        code: `E2E${tag}CT`,
        patientId,
        doctorId: staffId,
        facilityId: hospitalId,
        visitAt: new Date('2001-02-03T03:00:00Z'),
        chiefComplaint: 'Tiếp nối',
        sourceReferralId: c1Id,
      },
    });
    const [other] = ids.facilities;
    await prisma.referral.create({
      data: {
        code: `E2E${tag}C3`,
        patientId,
        sourceRecordId: cont.id,
        fromFacilityId: hospitalId,
        toFacilityId: other,
        referredById: staffId,
        priority: 'CRITICAL',
        reason: 'Chuyển tiếp',
        clinicalSummary: 'Tóm tắt',
        createdAt: new Date('2001-02-03T05:00:00Z'),
      },
    });
    const feb = (
      await http()
        .get('/api/stats/overview?from=2001-02-01&to=2001-02-28')
        .set(as('admin'))
        .expect(200)
    ).body as Overview;
    expect(feb.kpis).toMatchObject({ referrals: 1, onwardReferrals: 1, hospitalReferrals: 1 });
    expect((await overview()).kpis).toMatchObject({ stabilizeForward: 1, onwardReferrals: 0 });
  });

  it('quản trị tài khoản: tìm kiếm, khoá → mất phiên đăng nhập, mở khoá; nhật ký truy cập', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const list = (
      await http().get(`/api/admin/users?q=${tag}&role=COMMUNE_STAFF`).set(as('admin')).expect(200)
    ).body as {
      total: number;
      items: { id: string; staffProfile: { facility: { name: string } } }[];
    };
    expect(list.total).toBe(2);
    await http().get('/api/admin/users').set(as('staff')).expect(403);

    await http()
      .patch(`/api/admin/users/${adminId}`)
      .set(as('admin'))
      .send({ isActive: false })
      .expect(400);
    await http()
      .patch(`/api/admin/users/${victimId}`)
      .set(as('admin'))
      .send({ isActive: false })
      .expect(200);
    await http()
      .post('/api/auth/login')
      .send({ identifier: `victim-${tag}@e2e.test`, password: PASSWORD })
      .expect(401);
    expect(await prisma.refreshToken.count({ where: { userId: victimId, revokedAt: null } })).toBe(
      0,
    );
    const inactive = (
      await http().get(`/api/admin/users?q=${tag}&status=inactive`).set(as('admin')).expect(200)
    ).body as { total: number };
    expect(inactive.total).toBe(1);
    await http()
      .patch(`/api/admin/users/${victimId}`)
      .set(as('admin'))
      .send({ isActive: true })
      .expect(200);
    await http()
      .post('/api/auth/login')
      .send({ identifier: `victim-${tag}@e2e.test`, password: PASSWORD })
      .expect(200);

    const logs = (
      await http()
        .get(`/api/admin/audit-logs?action=UPDATE&entityType=User&q=admin-${tag}`)
        .set(as('admin'))
        .expect(200)
    ).body as { items: { action: string; entityId: string; metadata: { isActive: boolean } }[] };
    expect(logs.items.map((l) => l.metadata.isActive)).toEqual([true, false]);
    expect(logs.items[0]?.entityId).toBe(victimId);
    const facets = (await http().get('/api/admin/audit-logs/facets').set(as('admin')).expect(200))
      .body as {
      actions: string[];
    };
    expect(facets.actions).toEqual(expect.arrayContaining(['UPDATE', 'LOGIN']));
  });
});
