/**
 * Kiểm thử phân quyền & bảo mật tổng hợp (Task 5.3).
 *
 * Ma trận vai trò × tài nguyên: mỗi tài nguyên chứa dữ liệu bệnh nhân được thử bằng người có quyền
 * và mọi người không có quyền (chưa đăng nhập, bệnh nhân khác, nhân viên cơ sở không liên quan,
 * bệnh viện chỉ liên quan qua phiếu chuyển tuyến). Kèm các kiểu tấn công token, IDOR, gán quyền
 * qua dữ liệu gửi lên (mass assignment), tiêm SQL qua tham số, cô lập kênh realtime và khoá tài khoản.
 */
import { createHmac, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RealtimeIoAdapter } from '../src/realtime/realtime-io.adapter.js';

const PASSWORD = 'TestPass123';
const tag = `sc${Date.now().toString(36)}`;
const digits = (n: number) => (Date.now().toString() + Math.random().toString().slice(2)).slice(-n);
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

type Who = 'patient1' | 'patient2' | 'staffA' | 'nurseA' | 'staffB' | 'doctorH' | 'admin';
type Method = 'get' | 'post' | 'patch' | 'delete';

describe('Bảo mật & phân quyền (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let secret = '';
  let url = '';
  let dbReady = false;
  const ids = { users: [] as string[], patients: [] as string[], facilities: [] as string[] };
  const access = {} as Record<Who, string>;
  const refresh = {} as Record<Who, string>;
  const uid = {} as Record<Who, string>;
  const d = {} as {
    stationA: string;
    stationB: string;
    hospital: string;
    p1: string;
    p2: string;
    p3: string;
    recordFinal: string;
    recordDraft: string;
    image: string;
    appt: string;
    referral: string;
  };
  const sockets: Socket[] = [];
  const http = () => request(app.getHttpServer());
  const call = (m: Method, path: string, who?: string, body?: object) => {
    const r = http()[m](`/api${path}`);
    if (who) r.set('Authorization', `Bearer ${who in access ? access[who as Who] : who}`);
    return body ? r.send(body) : r;
  };
  const connect = async (who: Who) => {
    const t = ((await call('post', '/realtime/ticket', who).expect(200)).body as { ticket: string })
      .ticket;
    return new Promise<Socket>((resolve, reject) => {
      const s = io(`${url}/realtime`, {
        auth: { token: t },
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
      });
      sockets.push(s);
      s.on('connect', () => resolve(s));
      s.on('connect_error', reject);
    });
  };
  const collect = (s: Socket, event: string) => {
    const got: unknown[] = [];
    s.on(event, (x: unknown) => got.push(x));
    return got;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useWebSocketAdapter(new RealtimeIoAdapter(app));
    await app.listen(0);
    url = (await app.getUrl()).replace('[::1]', 'localhost');
    prisma = app.get(PrismaService);
    secret = app.get(ConfigService).get<string>('JWT_ACCESS_SECRET')!;
    dbReady =
      (await prisma.isHealthy()) &&
      (await prisma.icd10Code.count({ where: { code: 'S06.5' } })) === 1;
    if (!dbReady) return console.warn('⚠️  Bỏ qua e2e bảo mật: DB chưa sẵn sàng hoặc chưa seed.');

    const fac = (k: string, communeCode: string, hospital = false) =>
      prisma.healthFacility.create({
        data: {
          code: `E${k}-${tag}`,
          name: `${k} ${tag}`,
          type: hospital ? 'PROVINCIAL_GENERAL_HOSPITAL' : 'COMMUNE_HEALTH_STATION',
          level: hospital ? 'BASIC' : 'PRIMARY',
          communeCode,
          acceptsReferrals: hospital,
        },
      });
    const [a, b, h] = await Promise.all([
      fac('A', '02761'),
      fac('B', '02761'),
      fac('H', '02647', true),
    ]);
    Object.assign(d, { stationA: a.id, stationB: b.id, hospital: h.id });
    ids.facilities.push(a.id, b.id, h.id);

    const passwordHash = await hashPassword(PASSWORD);
    const staff = (
      k: Who,
      role: 'COMMUNE_STAFF' | 'PROVINCE_STAFF',
      facilityId: string,
      position: 'DOCTOR' | 'NURSE' = 'DOCTOR',
    ) =>
      prisma.user.create({
        data: {
          email: `${k.toLowerCase()}-${tag}@e2e.test`,
          passwordHash,
          fullName: `NV ${k}`,
          role,
          staffProfile: { create: { facilityId, position } },
        },
      });
    const patient = (k: Who) =>
      prisma.user.create({
        data: {
          email: `${k.toLowerCase()}-${tag}@e2e.test`,
          passwordHash,
          fullName: `BN ${k}`,
          role: 'PATIENT',
          patient: {
            create: {
              fullName: `BN ${k}`,
              dateOfBirth: new Date('1990-01-01'),
              gender: 'MALE',
              nationalId: digits(12),
            },
          },
        },
        include: { patient: true },
      });
    const [p1, p2, sA, nA, sB, dH, adm] = await Promise.all([
      patient('patient1'),
      patient('patient2'),
      staff('staffA', 'COMMUNE_STAFF', a.id),
      staff('nurseA', 'COMMUNE_STAFF', a.id, 'NURSE'),
      staff('staffB', 'COMMUNE_STAFF', b.id),
      staff('doctorH', 'PROVINCE_STAFF', h.id),
      prisma.user.create({
        data: { email: `admin-${tag}@e2e.test`, passwordHash, fullName: 'QT', role: 'ADMIN' },
      }),
    ]);
    Object.assign(uid, {
      patient1: p1.id,
      patient2: p2.id,
      staffA: sA.id,
      nurseA: nA.id,
      staffB: sB.id,
      doctorH: dH.id,
      admin: adm.id,
    });
    ids.users.push(...Object.values(uid));
    const p3 = await prisma.patient.create({
      data: {
        fullName: `BN3 ${tag}`,
        dateOfBirth: new Date('1970-01-01'),
        gender: 'FEMALE',
        nationalId: digits(12),
      },
    });
    Object.assign(d, { p1: p1.patient!.id, p2: p2.patient!.id, p3: p3.id });
    ids.patients.push(d.p1, d.p2, d.p3);

    const final = await prisma.medicalRecord.create({
      data: {
        code: `E2E${tag}F`,
        patientId: d.p3,
        doctorId: sA.id,
        facilityId: a.id,
        chiefComplaint: 'Chấn thương đầu',
        status: 'FINALIZED',
        signedAt: new Date(),
        signatureHash: 'a'.repeat(64),
        diagnoses: { create: { icdCode: 'S06.5', isPrimary: true } },
      },
    });
    const draft = await prisma.medicalRecord.create({
      data: {
        code: `E2E${tag}D`,
        patientId: d.p1,
        doctorId: sA.id,
        facilityId: a.id,
        chiefComplaint: 'Sốt',
      },
    });
    const image = await prisma.clinicalImage.create({
      data: {
        medicalRecordId: draft.id,
        type: 'XRAY',
        cloudinaryPublicId: `e2e/${tag}/x`,
        secureUrl: 'mock',
        uploadedById: sA.id,
      },
    });
    const appt = await prisma.appointment.create({
      data: {
        code: `E2E${tag}L`,
        patientId: d.p1,
        facilityId: a.id,
        startAt: new Date(Date.now() + 3 * 86_400_000),
        endAt: new Date(Date.now() + 3 * 86_400_000 + 900_000),
        reason: 'Khám',
      },
    });
    const ref = await prisma.referral.create({
      data: {
        code: `E2E${tag}C`,
        patientId: d.p3,
        sourceRecordId: final.id,
        fromFacilityId: a.id,
        toFacilityId: h.id,
        referredById: sA.id,
        escortId: nA.id,
        priority: 'CRITICAL',
        reason: 'Vượt khả năng',
        clinicalSummary: 'Tóm tắt',
      },
    });
    Object.assign(d, {
      recordFinal: final.id,
      recordDraft: draft.id,
      image: image.id,
      appt: appt.id,
      referral: ref.id,
    });

    for (const k of Object.keys(uid) as Who[]) {
      const body = (
        await call('post', '/auth/login', undefined, {
          identifier: `${k.toLowerCase()}-${tag}@e2e.test`,
          password: PASSWORD,
        }).expect(200)
      ).body as { accessToken: string; refreshToken: string };
      access[k] = body.accessToken;
      refresh[k] = body.refreshToken;
    }
  });

  afterEach(() => {
    while (sockets.length) sockets.pop()!.disconnect();
  });

  afterAll(async () => {
    if (dbReady) {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { userId: { in: ids.users } },
            { entityId: { in: [...ids.users, ...ids.patients] } },
          ],
        },
      });
      await prisma.referral.deleteMany({ where: { patientId: { in: ids.patients } } });
      await prisma.medicalRecord.deleteMany({ where: { patientId: { in: ids.patients } } });
      await prisma.appointment.deleteMany({ where: { patientId: { in: ids.patients } } });
      await prisma.patient.deleteMany({
        where: {
          OR: [{ id: { in: ids.patients } }, { user: { email: { endsWith: `${tag}@e2e.test` } } }],
        },
      });
      await prisma.user.deleteMany({ where: { email: { endsWith: `${tag}@e2e.test` } } });
      await prisma.healthFacility.deleteMany({ where: { id: { in: ids.facilities } } });
    }
    await app.close();
  });

  /**
   * Ma trận: [tài nguyên, phương thức, đường dẫn, body, người được phép (mã thành công)].
   * Mọi vai trò khác phải bị từ chối (401/403/404 — không bao giờ 2xx, không bao giờ 500).
   */
  const matrix = (): [
    string,
    Method,
    string,
    object | undefined,
    Partial<Record<Who, number>>,
  ][] => [
    [
      'Hồ sơ bệnh nhân P3',
      'get',
      `/patients/${d.p3}`,
      undefined,
      { staffA: 200, nurseA: 200, doctorH: 200, admin: 200 },
    ],
    [
      'Lịch sử khám P3',
      'get',
      `/patients/${d.p3}/records`,
      undefined,
      { staffA: 200, nurseA: 200, doctorH: 200, admin: 200 },
    ],
    [
      'Hồ sơ bệnh nhân P1',
      'get',
      `/patients/${d.p1}`,
      undefined,
      { patient1: 200, staffA: 200, nurseA: 200, admin: 200 },
    ],
    ['Hồ sơ của tôi', 'get', '/patients/me', undefined, { patient1: 200, patient2: 200 }],
    [
      'Phiếu khám đã ký',
      'get',
      `/medical-records/${d.recordFinal}`,
      undefined,
      { staffA: 200, nurseA: 200, doctorH: 200, admin: 200 },
    ],
    [
      'Phiếu khám nháp',
      'get',
      `/medical-records/${d.recordDraft}`,
      undefined,
      { staffA: 200, nurseA: 200, admin: 200 },
    ],
    [
      'Sửa phiếu nháp',
      'patch',
      `/medical-records/${d.recordDraft}`,
      { treatmentPlan: 'x' },
      { staffA: 200, nurseA: 200 },
    ],
    [
      'Vé tải ảnh',
      'post',
      `/medical-records/${d.recordDraft}/images/upload-ticket`,
      { type: 'XRAY' },
      { staffA: 200, nurseA: 200 },
    ],
    [
      'Phiếu chuyển tuyến',
      'get',
      `/referrals/${d.referral}`,
      undefined,
      { staffA: 200, nurseA: 200, doctorH: 200 },
    ],
    [
      'Sinh tồn trên xe',
      'get',
      `/referrals/${d.referral}/vitals`,
      undefined,
      { staffA: 200, nurseA: 200, doctorH: 200 },
    ],
    [
      'Danh sách lịch hẹn cơ sở',
      'get',
      '/appointments/facility?date=2026-01-01',
      undefined,
      { staffA: 200, nurseA: 200, staffB: 200, doctorH: 200, admin: 400 }, // admin phải chỉ định facilityId,
    ],
    ['Thống kê', 'get', '/stats/overview?from=2001-01-01&to=2001-01-02', undefined, { admin: 200 }],
    ['Danh sách tài khoản', 'get', '/admin/users', undefined, { admin: 200 }],
    ['Nhật ký truy cập', 'get', '/admin/audit-logs', undefined, { admin: 200 }],
  ];
  const everyone: Who[] = [
    'patient1',
    'patient2',
    'staffA',
    'nurseA',
    'staffB',
    'doctorH',
    'admin',
  ];

  it('ma trận vai trò × tài nguyên: chỉ người có quyền nhận 2xx', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const problems: string[] = [];
    for (const [name, m, path, body, allowed] of matrix()) {
      const anon = await call(m, path, undefined, body);
      if (anon.status !== 401) problems.push(`${name} — chưa đăng nhập: ${anon.status}`);
      for (const who of everyone) {
        const res = await call(m, path, who, body);
        const want = allowed[who];
        if (
          want
            ? res.status !== want
            : res.status < 400 || res.status >= 500 || ![403, 404].includes(res.status)
        )
          problems.push(
            `${name} — ${who}: ${res.status}${want ? ` (cần ${want})` : ' (cần 403/404)'}`,
          );
      }
    }
    expect(problems).toEqual([]);
  });

  it('IDOR: thao tác trên tài nguyên của cơ sở/bệnh nhân khác bị chặn và không làm thay đổi dữ liệu', async (ctx) => {
    if (!dbReady) return ctx.skip();
    // Bệnh nhân khác / trạm khác thao tác lịch hẹn của P1
    await call('post', `/appointments/${d.appt}/cancel`, 'patient2', { reason: 'Phá' }).expect(404);
    await call('post', `/appointments/${d.appt}/confirm`, 'staffB').expect(404);
    await call('post', `/appointments/${d.appt}/check-in`, 'doctorH').expect(404);
    // Ảnh của phiếu nháp trạm A: trạm B xoá không được
    await call('delete', `/medical-records/${d.recordDraft}/images/${d.image}`, 'staffB').expect(
      404,
    );
    expect(await prisma.clinicalImage.count({ where: { id: d.image } })).toBe(1);
    // Phiếu chuyển tuyến: trạm B / BN không thể huỷ, tiếp nhận, ghi sinh tồn
    await call('post', `/referrals/${d.referral}/cancel`, 'staffB', { reason: 'Phá hoại' }).expect(
      404,
    );
    await call('post', `/referrals/${d.referral}/accept`, 'staffB', {}).expect(404);
    await call('post', `/referrals/${d.referral}/accept`, 'staffA', {}).expect(404); // cơ sở gửi không tự xác nhận
    await call('post', `/referrals/${d.referral}/arrive`, 'staffB').expect(404);
    await call('post', `/referrals/${d.referral}/vitals`, 'staffB', {
      entries: [{ clientId: randomUUID(), recordedAt: new Date().toISOString(), spo2: 90 }],
    }).expect(403);
    await call('post', `/referrals/${d.referral}/accept`, 'patient1', {}).expect(403);
    const ref = await prisma.referral.findUniqueOrThrow({ where: { id: d.referral } });
    expect(ref.status).toBe('PENDING');
    // Phiếu đã ký không sửa được, kể cả cơ sở lập phiếu
    await call('patch', `/medical-records/${d.recordFinal}`, 'staffA', {
      treatmentPlan: 'sửa lén',
    }).expect(409);
    await call('patch', `/medical-records/${d.recordFinal}`, 'doctorH', {
      treatmentPlan: 'sửa lén',
    }).expect(404);
    // ID không phải UUID: 400, không lộ lỗi CSDL
    await call('get', '/medical-records/1 OR 1=1', 'staffA').expect(400);
    await call('get', '/referrals/../admin/users', 'staffA').expect((r) =>
      expect(r.status).not.toBe(200),
    );
  });

  it('token giả mạo: alg none, sai khoá, hết hạn, sai issuer/audience, dùng vé socket hoặc refresh token làm access token', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const claims = {
      sub: uid.admin,
      role: 'ADMIN',
      iss: 'mevita-api',
      aud: 'mevita',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 600,
    };
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64(claims)}.`;
    const hs = (payload: object, key = secret) => {
      const head = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}`;
      return `${head}.${createHmac('sha256', key).update(head).digest('base64url')}`;
    };
    // Bệnh nhân tự nâng quyền: sửa payload nhưng giữ chữ ký cũ
    const [h, , sig] = access.patient1.split('.');
    const escalated = `${h}.${b64({ ...claims, sub: uid.patient1 })}.${sig}`;
    const ticket = (
      (await call('post', '/realtime/ticket', 'staffA').expect(200)).body as { ticket: string }
    ).ticket;
    const bad = {
      'alg none': none,
      'sai khoá ký': hs(claims, 'x'.repeat(48)),
      'hết hạn': hs({ ...claims, exp: Math.floor(Date.now() / 1000) - 10 }),
      'sai issuer': hs({ ...claims, iss: 'attacker' }),
      'sai audience': hs({ ...claims, aud: 'mevita-socket' }),
      'sửa payload': escalated,
      'vé socket': ticket,
      'refresh token': refresh.patient1,
      'chuỗi rác': 'abc.def.ghi',
    };
    for (const [name, token] of Object.entries(bad)) {
      const res = await call('get', '/admin/users', token);
      expect({ name, status: res.status }).toEqual({ name, status: 401 });
    }
    // Đối chứng: token ký đúng chuẩn thì hợp lệ (chứng tỏ các ca trên bị chặn vì đúng lý do)
    await call('get', '/admin/users', hs(claims)).expect(200);
    // Trang ở origin lạ không mở được kênh realtime, kể cả với vé hợp lệ (chống CSWSH)
    const t2 = (
      (await call('post', '/realtime/ticket', 'staffA').expect(200)).body as { ticket: string }
    ).ticket;
    await expect(
      new Promise((resolve, reject) => {
        const s = io(`${url}/realtime`, {
          auth: { token: t2 },
          transports: ['websocket'],
          extraHeaders: { Origin: 'https://evil.example' },
          reconnection: false,
          forceNew: true,
        });
        sockets.push(s);
        s.on('connect', () => resolve(true));
        s.on('connect_error', reject);
      }),
    ).rejects.toThrow();
    // Access token không dùng để mở kênh realtime
    await expect(
      new Promise((resolve, reject) => {
        const s = io(`${url}/realtime`, {
          auth: { token: access.staffA },
          transports: ['websocket'],
          reconnection: false,
          forceNew: true,
        });
        sockets.push(s);
        s.on('connect', () => resolve(true));
        s.on('connect_error', reject);
      }),
    ).rejects.toThrow('unauthorized');
  });

  it('mass assignment: không tự gán vai trò / cơ sở / liên kết hồ sơ qua dữ liệu gửi lên', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const email = `mass-${tag}@e2e.test`;
    const res = await call('post', '/auth/register', undefined, {
      fullName: 'Kẻ gian',
      email,
      password: PASSWORD,
      dateOfBirth: '1990-01-01',
      gender: 'MALE',
      role: 'ADMIN',
      facilityId: d.hospital,
      patientId: d.p3,
      isActive: true,
    });
    expect([201, 400]).toContain(res.status);
    const u = await prisma.user.findUnique({
      where: { email },
      include: { patient: true, staffProfile: true },
    });
    if (u) {
      expect(u.role).toBe('PATIENT');
      expect(u.staffProfile).toBeNull();
      expect(u.patient?.id).not.toBe(d.p3);
      const tok = (res.body as { accessToken: string }).accessToken;
      await call('get', '/admin/users', tok).expect(403);
      await call('get', `/patients/${d.p3}`, tok).expect(403);
    }
    // Bệnh nhân sửa hồ sơ kèm trường hệ thống
    await call('patch', '/patients/me', 'patient1', {
      userId: uid.admin,
      id: d.p3,
      role: 'ADMIN',
    }).expect((r) => expect([200, 400]).toContain(r.status));
    const p1 = await prisma.patient.findUniqueOrThrow({ where: { id: d.p1 } });
    expect(p1.userId).toBe(uid.patient1);
    // Nhân viên không đổi được cơ sở của phiếu khám / bác sĩ ký
    await call('patch', `/medical-records/${d.recordDraft}`, 'staffA', {
      facilityId: d.stationB,
      doctorId: uid.staffB,
      status: 'FINALIZED',
    }).expect((r) => expect([200, 400]).toContain(r.status));
    const rec = await prisma.medicalRecord.findUniqueOrThrow({ where: { id: d.recordDraft } });
    expect(rec).toMatchObject({ facilityId: d.stationA, doctorId: uid.staffA, status: 'DRAFT' });
  });

  it('tham số độc hại không gây lỗi máy chủ (tiêm SQL / dữ liệu quá dài)', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const evil = ["' OR '1'='1", '1; DROP TABLE users; --', '%27%3B--', 'a'.repeat(5000)];
    for (const q of evil) {
      const lookup = await call('get', `/patients/lookup?q=${encodeURIComponent(q)}`, 'staffA');
      expect([200, 400]).toContain(lookup.status);
      if (lookup.status === 200) expect(lookup.body).toEqual(expect.objectContaining({}));
      const icd = await call('get', `/icd10?q=${encodeURIComponent(q)}`, 'staffA');
      expect([200, 400]).toContain(icd.status);
      const stats = await call(
        'get',
        `/stats/overview?from=2001-01-01&to=2001-01-02&province=${encodeURIComponent(q)}`,
        'admin',
      );
      expect(stats.status).toBe(400);
      const users = await call(
        'get',
        `/admin/users?q=${encodeURIComponent(q.slice(0, 100))}`,
        'admin',
      );
      expect(users.status).toBe(200);
      expect((users.body as { total: number }).total).toBe(0);
    }
    expect(await prisma.user.count()).toBeGreaterThan(0);
    // Đường dẫn ảnh giả lập: chữ ký sai/thiếu → 404, không đọc tệp tuỳ ý
    await call('get', '/mock-cloudinary/file?id=../../etc/passwd&v=full&sig=x').expect(404);
    await call('get', `/mock-cloudinary/file?id=e2e/${tag}/x&v=full&sig=${'0'.repeat(64)}`).expect(
      404,
    );
  });

  it('kênh realtime cô lập theo cơ sở: không nhận cảnh báo/sinh tồn của cơ sở khác', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const [hospital, other, patient, nurse] = await Promise.all([
      connect('doctorH'),
      connect('staffB'),
      connect('patient1'),
      connect('nurseA'),
    ]);
    const leaks = [
      collect(other, 'vital_update'),
      collect(patient, 'vital_update'),
      collect(other, 'referral_updated'),
      collect(patient, 'referral_updated'),
    ];
    const toHospital = new Promise<void>((resolve) =>
      hospital.once('vital_update', () => resolve()),
    );
    const ack = (await nurse.timeout(2000).emitWithAck('vital_update', {
      referralId: d.referral,
      entries: [{ clientId: randomUUID(), recordedAt: new Date().toISOString(), spo2: 91 }],
    })) as { ok: boolean };
    expect(ack.ok).toBe(true);
    await toHospital;
    // Trạm B ghi sinh tồn qua socket cho ca không phải của mình → từ chối
    const denied = (await other.timeout(2000).emitWithAck('vital_update', {
      referralId: d.referral,
      entries: [{ clientId: randomUUID(), recordedAt: new Date().toISOString(), spo2: 50 }],
    })) as { ok: boolean; retry: boolean };
    expect(denied).toMatchObject({ ok: false, retry: false });
    // Không có sự kiện "vào phòng" do client tự gọi
    const join = await other
      .timeout(1000)
      .emitWithAck('join', { room: `facility_${d.hospital}` })
      .catch(() => 'no-ack');
    expect(join).toBe('no-ack');
    await new Promise((r) => setTimeout(r, 300));
    expect(leaks.map((l) => l.length)).toEqual([0, 0, 0, 0]);
    const who = (await patient.timeout(1000).emitWithAck('whoami')) as { rooms: string[] };
    expect(who.rooms).toEqual([`user_${uid.patient1}`]);
  });

  it('khoá tài khoản có hiệu lực ngay: access token còn hạn bị chặn, kết nối realtime bị ngắt', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const s = await connect('staffB');
    const dropped = new Promise<void>((resolve) => s.once('disconnect', () => resolve()));
    await call('get', '/appointments/facility?date=2026-01-01', 'staffB').expect(200);
    await call('patch', `/admin/users/${uid.staffB}`, 'admin', { isActive: false }).expect(200);
    await call('get', '/appointments/facility?date=2026-01-01', 'staffB').expect(401);
    await call('post', '/realtime/ticket', 'staffB').expect(401);
    await call('post', '/auth/refresh', undefined, { refreshToken: refresh.staffB }).expect(401);
    await dropped;
    await call('patch', `/admin/users/${uid.staffB}`, 'admin', { isActive: true }).expect(200);
    await call('get', '/appointments/facility?date=2026-01-01', 'staffB').expect(200);
    // Khoá trực tiếp trong CSDL (không qua API quản trị): tài khoản chưa có trong cache bị chặn ngay;
    // đã có trong cache thì chậm nhất sau 30 giây
    const reg = await call('post', '/auth/register', undefined, {
      fullName: 'Bệnh nhân mới',
      email: `fresh-${tag}@e2e.test`,
      password: PASSWORD,
      dateOfBirth: '1990-01-01',
      gender: 'FEMALE',
    }).expect(201);
    const fresh = (reg.body as { accessToken: string }).accessToken;
    await prisma.user.update({
      where: { email: `fresh-${tag}@e2e.test` },
      data: { isActive: false },
    });
    await call('get', '/patients/me', fresh).expect(401);
  });

  it('truy cập dữ liệu bệnh nhân được ghi nhật ký, kể cả lần bị từ chối', async (ctx) => {
    if (!dbReady) return ctx.skip();
    await call('get', `/patients/${d.p3}/records`, 'doctorH').expect(200);
    await call('get', `/patients/${d.p3}/records`, 'staffB').expect(403);
    const logs = await prisma.auditLog.findMany({
      where: { entityId: d.p3, userId: { in: [uid.doctorH, uid.staffB] } },
      select: { userId: true, action: true },
    });
    expect(logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: uid.doctorH, action: 'VIEW' }),
        expect.objectContaining({ userId: uid.staffB }),
      ]),
    );
  });
});
