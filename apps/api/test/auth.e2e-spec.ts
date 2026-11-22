/**
 * Xác thực (JWT + refresh token xoay vòng) và phân quyền truy cập hồ sơ bệnh nhân.
 * Tạo dữ liệu riêng cho test và dọn sạch sau khi chạy. Tự bỏ qua nếu DB chưa sẵn sàng.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/auth/password.js';
import { hashToken } from '../src/auth/token.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const PASSWORD = 'TestPass123';
const tag = Date.now().toString(36);
const uniqDigits = (len: number) =>
  (Date.now().toString() + Math.random().toString().slice(2)).slice(-len);

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

describe('Auth & RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let dbReady = false;

  const ids = { users: [] as string[], patients: [] as string[], facilities: [] as string[] };
  const fx = {} as {
    stationX: string;
    stationY: string;
    hospital: string;
    patientA: string;
    patientB: string;
    patientRef: string;
    referralId: string;
    tokens: Record<'patientA' | 'communeX' | 'hospitalStaff' | 'admin', Tokens>;
  };

  const http = () => request(app.getHttpServer());
  const login = async (identifier: string): Promise<Tokens> => {
    const res = await http()
      .post('/api/auth/login')
      .send({ identifier, password: PASSWORD })
      .expect(200);
    return res.body as Tokens;
  };
  const auth = (t: Tokens) => ({ Authorization: `Bearer ${t.accessToken}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    dbReady = (await prisma.isHealthy()) && (await prisma.commune.count()) > 0;
    if (!dbReady) {
      console.warn('⚠️  Bỏ qua e2e auth: DB chưa sẵn sàng hoặc chưa seed.');
      return;
    }

    const passwordHash = await hashPassword(PASSWORD);
    const facility = (code: string, communeCode: string) =>
      prisma.healthFacility.create({
        data: {
          code: `E2E-${code}-${tag}`,
          name: `E2E ${code}`,
          type: 'COMMUNE_HEALTH_STATION',
          level: 'PRIMARY',
          communeCode,
        },
      });
    const [stationX, stationY, hospital] = await Promise.all([
      facility('X', '02761'),
      facility('Y', '02761'),
      facility('H', '02647'),
    ]);
    ids.facilities.push(stationX.id, stationY.id, hospital.id);

    const staff = (
      key: string,
      role: 'COMMUNE_STAFF' | 'PROVINCE_STAFF' | 'ADMIN',
      facilityId?: string,
    ) =>
      prisma.user.create({
        data: {
          email: `${key}-${tag}@e2e.mevita`,
          passwordHash,
          fullName: key,
          role,
          ...(facilityId && { staffProfile: { create: { facilityId, position: 'DOCTOR' } } }),
        },
      });
    const [communeX, communeY, hospitalStaff, admin] = await Promise.all([
      staff('commune-x', 'COMMUNE_STAFF', stationX.id),
      staff('commune-y', 'COMMUNE_STAFF', stationY.id),
      staff('hospital', 'PROVINCE_STAFF', hospital.id),
      staff('admin', 'ADMIN'),
    ]);
    ids.users.push(communeX.id, communeY.id, hospitalStaff.id, admin.id);

    const patientUser = await prisma.user.create({
      data: {
        email: `patient-a-${tag}@e2e.mevita`,
        passwordHash,
        fullName: 'Bệnh nhân A',
        role: 'PATIENT',
        patient: {
          create: { fullName: 'Bệnh nhân A', dateOfBirth: new Date('1990-01-01'), gender: 'MALE' },
        },
      },
      include: { patient: true },
    });
    ids.users.push(patientUser.id);
    const patientB = await prisma.patient.create({
      data: { fullName: 'Bệnh nhân B', dateOfBirth: new Date('1980-01-01'), gender: 'FEMALE' },
    });
    const patientRef = await prisma.patient.create({
      data: {
        fullName: 'Bệnh nhân chuyển tuyến',
        dateOfBirth: new Date('1975-01-01'),
        gender: 'MALE',
      },
    });
    ids.patients.push(patientUser.patient!.id, patientB.id, patientRef.id);

    // A: có lịch hẹn tại trạm X. B: chỉ có hồ sơ khám tại trạm Y.
    await prisma.appointment.create({
      data: {
        code: `E2E-A-${tag}`,
        patientId: patientUser.patient!.id,
        facilityId: stationX.id,
        startAt: new Date('2026-12-10T08:00:00Z'),
        endAt: new Date('2026-12-10T08:15:00Z'),
        reason: 'Khám',
      },
    });
    await prisma.medicalRecord.create({
      data: {
        code: `E2E-B-${tag}`,
        patientId: patientB.id,
        doctorId: communeY.id,
        facilityId: stationY.id,
        chiefComplaint: 'Ho',
      },
    });
    // Bệnh nhân chuyển tuyến: hồ sơ tại trạm Y, chuyển lên bệnh viện H
    const refRecord = await prisma.medicalRecord.create({
      data: {
        code: `E2E-R-${tag}`,
        patientId: patientRef.id,
        doctorId: communeY.id,
        facilityId: stationY.id,
        chiefComplaint: 'Chấn thương',
      },
    });
    const referral = await prisma.referral.create({
      data: {
        code: `E2E-CT-${tag}`,
        patientId: patientRef.id,
        sourceRecordId: refRecord.id,
        fromFacilityId: stationY.id,
        toFacilityId: hospital.id,
        referredById: communeY.id,
        priority: 'CRITICAL',
        reason: 'x',
        clinicalSummary: 'x',
      },
    });

    Object.assign(fx, {
      stationX: stationX.id,
      stationY: stationY.id,
      hospital: hospital.id,
      patientA: patientUser.patient!.id,
      patientB: patientB.id,
      patientRef: patientRef.id,
      referralId: referral.id,
      tokens: {
        patientA: await login(patientUser.email!),
        communeX: await login(communeX.email!),
        hospitalStaff: await login(hospitalStaff.email!),
        admin: await login(admin.email!),
      },
    });
  });

  afterAll(async () => {
    if (dbReady) {
      const registered = await prisma.user.findMany({
        where: { email: { endsWith: `-${tag}@register.test` } },
        include: { patient: true },
      });
      ids.users.push(...registered.map((u) => u.id));
      ids.patients.push(...registered.flatMap((u) => (u.patient ? [u.patient.id] : [])));

      await prisma.auditLog.deleteMany({
        where: { OR: [{ userId: { in: ids.users } }, { entityId: { in: ids.patients } }] },
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

  describe('Đăng ký & đăng nhập', () => {
    it('bệnh nhân tự đăng ký, nhận token và đăng nhập lại bằng số điện thoại', async (ctx) => {
      if (!dbReady) return ctx.skip();
      const phone = `09${uniqDigits(8)}`;
      const res = await http()
        .post('/api/auth/register')
        .send({
          fullName: 'Người Đăng Ký',
          email: `new-${tag}@register.test`,
          phone: `+84 ${phone.slice(1)}`,
          password: PASSWORD,
          dateOfBirth: '1995-02-03',
          gender: 'FEMALE',
        })
        .expect(201);
      expect(res.body).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      });

      const me = await http()
        .get('/api/auth/me')
        .set(auth(res.body as Tokens))
        .expect(200);
      expect(me.body).toMatchObject({
        role: 'PATIENT',
        phone,
        patient: { id: expect.any(String) },
      });

      await http()
        .post('/api/auth/login')
        .send({ identifier: phone, password: PASSWORD })
        .expect(200);
    });

    it('từ chối đăng ký trùng email và không tự liên kết hồ sơ có sẵn theo CCCD', async (ctx) => {
      if (!dbReady) return ctx.skip();
      const base = {
        fullName: 'Trùng',
        password: PASSWORD,
        dateOfBirth: '1990-01-01',
        gender: 'MALE',
      };
      await http()
        .post('/api/auth/register')
        .send({ ...base, email: `patient-a-${tag}@e2e.mevita` })
        .expect(409);

      const nationalId = uniqDigits(12);
      await prisma.patient.update({ where: { id: fx.patientB }, data: { nationalId } });
      const res = await http()
        .post('/api/auth/register')
        .send({ ...base, email: `cccd-${tag}@register.test`, nationalId })
        .expect(409);
      expect((res.body as { message: string }).message).toMatch(/liên hệ cơ sở y tế/);
    });

    it('trả cùng một thông báo khi sai mật khẩu hoặc tài khoản không tồn tại', async (ctx) => {
      if (!dbReady) return ctx.skip();
      const wrong = await http()
        .post('/api/auth/login')
        .send({ identifier: `patient-a-${tag}@e2e.mevita`, password: 'WrongPass1' })
        .expect(401);
      const missing = await http()
        .post('/api/auth/login')
        .send({ identifier: `nobody-${tag}@e2e.mevita`, password: 'WrongPass1' })
        .expect(401);
      expect((wrong.body as { message: string }).message).toBe(
        (missing.body as { message: string }).message,
      );
    });

    it('400 khi dữ liệu không hợp lệ', async (ctx) => {
      if (!dbReady) return ctx.skip();
      await http()
        .post('/api/auth/register')
        .send({ fullName: 'X', password: 'short', dateOfBirth: 'abc', gender: 'MALE' })
        .expect(400);
    });
  });

  describe('Access token', () => {
    it('401 khi thiếu, sai chữ ký hoặc sai định dạng', async (ctx) => {
      if (!dbReady) return ctx.skip();
      await http().get('/api/auth/me').expect(401);
      const [h, p] = fx.tokens.patientA.accessToken.split('.');
      await http()
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${h}.${p}.invalidsignature`)
        .expect(401);
      await http()
        .get('/api/auth/me')
        .set('Authorization', fx.tokens.patientA.accessToken)
        .expect(401);
    });

    it('các API danh mục và health vẫn công khai', async (ctx) => {
      if (!dbReady) return ctx.skip();
      await http().get('/api/health').expect(200);
      await http().get('/api/provinces/15').expect(200);
    });
  });

  describe('Refresh token xoay vòng', () => {
    it('đổi được cặp token mới; dùng lại token cũ thì thu hồi toàn bộ phiên', async (ctx) => {
      if (!dbReady) return ctx.skip();
      const first = await login(`commune-y-${tag}@e2e.mevita`);

      const second = (
        await http()
          .post('/api/auth/refresh')
          .send({ refreshToken: first.refreshToken })
          .expect(200)
      ).body as Tokens;
      expect(second.refreshToken).not.toBe(first.refreshToken);
      await http().get('/api/auth/me').set(auth(second)).expect(200);

      // Giả lập đã qua khoảng ân hạn rồi kẻ gian dùng lại refresh token cũ
      // -> bị chặn, và token mới của người dùng cũng bị thu hồi
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(first.refreshToken) },
        data: { rotatedAt: new Date(Date.now() - 60_000) },
      });
      await http().post('/api/auth/refresh').send({ refreshToken: first.refreshToken }).expect(401);
      await http()
        .post('/api/auth/refresh')
        .send({ refreshToken: second.refreshToken })
        .expect(401);

      const reuse = await prisma.auditLog.findFirst({
        where: { action: 'TOKEN_REUSE', userId: { in: ids.users } },
      });
      expect(reuse).not.toBeNull();
    });

    it('chấp nhận các request làm mới song song cùng một token (trong khoảng ân hạn)', async (ctx) => {
      if (!dbReady) return ctx.skip();
      const t = await login(`commune-y-${tag}@e2e.mevita`);
      const results = await Promise.all(
        Array.from({ length: 4 }, () =>
          http().post('/api/auth/refresh').send({ refreshToken: t.refreshToken }),
        ),
      );
      expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200]);
      // Tất cả token mới vẫn dùng được (không bị coi là đánh cắp)
      for (const r of results) {
        await http()
          .get('/api/auth/me')
          .set(auth(r.body as Tokens))
          .expect(200);
      }
    });

    it('đăng xuất thu hồi refresh token và không được ân hạn', async (ctx) => {
      if (!dbReady) return ctx.skip();
      const t = await login(`commune-y-${tag}@e2e.mevita`);
      await http().post('/api/auth/logout').send({ refreshToken: t.refreshToken }).expect(204);
      await http().post('/api/auth/refresh').send({ refreshToken: t.refreshToken }).expect(401);
    });
  });

  describe('Phân quyền hồ sơ bệnh nhân', () => {
    const get = (who: keyof typeof fx.tokens, patientId: string) =>
      http().get(`/api/patients/${patientId}`).set(auth(fx.tokens[who]));

    it('bệnh nhân chỉ xem được hồ sơ của mình', async (ctx) => {
      if (!dbReady) return ctx.skip();
      await get('patientA', fx.patientA).expect(200);
      await get('patientA', fx.patientB).expect(403);
      const me = await http().get('/api/patients/me').set(auth(fx.tokens.patientA)).expect(200);
      expect((me.body as { id: string }).id).toBe(fx.patientA);
    });

    it('bác sĩ xã chỉ xem bệnh nhân có liên hệ với trạm của mình', async (ctx) => {
      if (!dbReady) return ctx.skip();
      await get('communeX', fx.patientA).expect(200); // có lịch hẹn tại X
      await get('communeX', fx.patientB).expect(403); // chỉ khám tại Y
      await get('communeX', fx.patientRef).expect(403); // chuyển từ Y, không liên quan X
    });

    it('bác sĩ tỉnh xem được bệnh nhân được chuyển tuyến tới, mất quyền khi phiếu bị huỷ', async (ctx) => {
      if (!dbReady) return ctx.skip();
      await get('hospitalStaff', fx.patientRef).expect(200);
      await get('hospitalStaff', fx.patientB).expect(403);

      await prisma.referral.update({ where: { id: fx.referralId }, data: { status: 'CANCELLED' } });
      await get('hospitalStaff', fx.patientRef).expect(403);
      await prisma.referral.update({ where: { id: fx.referralId }, data: { status: 'PENDING' } });
    });

    it('admin xem được mọi hồ sơ', async (ctx) => {
      if (!dbReady) return ctx.skip();
      await get('admin', fx.patientB).expect(200);
    });

    it('/patients/me chỉ dành cho bệnh nhân; mã không hợp lệ trả 403; ghi audit khi bị từ chối', async (ctx) => {
      if (!dbReady) return ctx.skip();
      await http().get('/api/patients/me').set(auth(fx.tokens.communeX)).expect(403);
      await get('communeX', 'not-a-uuid').expect(403);

      const denied = await prisma.auditLog.findFirst({
        where: { action: 'ACCESS_DENIED', entityId: fx.patientB },
      });
      expect(denied).not.toBeNull();
      const viewed = await prisma.auditLog.findFirst({
        where: { action: 'VIEW', entityId: fx.patientA },
      });
      expect(viewed).not.toBeNull();
    });
  });
});
