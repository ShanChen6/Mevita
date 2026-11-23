/**
 * Điều phối thay cho từ chối (Task B): năng lực tiếp nhận, gợi ý bệnh viện, leo thang khi chậm phản hồi.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/auth/password.js';
import { EscalationService } from '../src/coordination/escalation.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RealtimeIoAdapter } from '../src/realtime/realtime-io.adapter.js';

const PASSWORD = 'TestPass123';
const tag = `co${Date.now().toString(36)}`;
type Who = 'station' | 'near' | 'neuro' | 'admin';

describe('Điều phối & leo thang (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let escalation: EscalationService;
  let url = '';
  let dbReady = false;
  const ids = { users: [] as string[], patients: [] as string[], facilities: [] as string[] };
  const access = {} as Record<Who, string>;
  const fac = {} as Record<'station' | 'near' | 'neuro', string>;
  let patientId = '';
  let seq = 0;
  const sockets: Socket[] = [];
  const http = () => request(app.getHttpServer());
  const as = (w: Who) => ({ Authorization: `Bearer ${access[w]}` });
  const connect = async (w: Who) => {
    const t = (
      (await http().post('/api/realtime/ticket').set(as(w)).expect(200)).body as { ticket: string }
    ).ticket;
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
  const next = <T>(s: Socket, event: string) =>
    new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`timeout ${event}`)), 2000);
      s.once(event, (d: T) => (clearTimeout(t), resolve(d)));
    });
  const refer = async (o: Record<string, unknown> = {}) => {
    const rec = await prisma.medicalRecord.create({
      data: {
        code: `E2E${tag}${++seq}`,
        patientId,
        doctorId: ids.users[0],
        facilityId: fac.station,
        chiefComplaint: 'Chấn thương đầu',
      },
    });
    const res = await http()
      .post('/api/referrals')
      .set(as('station'))
      .send({
        sourceRecordId: rec.id,
        toFacilityId: fac.near,
        priority: 'CRITICAL',
        reason: 'Chấn thương sọ não nặng',
        clinicalSummary: 'GCS 9, đồng tử không đều',
        etaMinutes: 40,
        ...o,
      })
      .expect(201);
    return (res.body as { referral: { id: string } }).referral.id;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useWebSocketAdapter(new RealtimeIoAdapter(app));
    await app.listen(0);
    url = (await app.getUrl()).replace('[::1]', 'localhost');
    prisma = app.get(PrismaService);
    escalation = app.get(EscalationService);
    dbReady =
      (await prisma.isHealthy()) &&
      (await prisma.specialty.count({ where: { code: 'NEUROSURGERY' } })) === 1;
    if (!dbReady) return console.warn('⚠️  Bỏ qua e2e điều phối: DB chưa sẵn sàng hoặc chưa seed.');

    const neuroSpec = await prisma.specialty.findUniqueOrThrow({ where: { code: 'NEUROSURGERY' } });
    const mk = (
      k: string,
      latitude: number,
      longitude: number,
      hospital: boolean,
      extra: object = {},
    ) =>
      prisma.healthFacility.create({
        data: {
          code: `E${k}-${tag}`,
          name: `${k} ${tag}`,
          type: hospital ? 'PROVINCIAL_GENERAL_HOSPITAL' : 'COMMUNE_HEALTH_STATION',
          level: hospital ? 'BASIC' : 'PRIMARY',
          communeCode: '02761',
          acceptsReferrals: hospital,
          latitude,
          longitude,
          ...extra,
        },
      });
    const s = await mk('Tram', 22.7676, 104.1236, false);
    // BV gần nhưng không có PTTK; BV xa hơn có PTTK
    const n = await mk('Gan', 22.6, 104.08, true);
    const x = await mk('PTTK', 22.4127, 104.0226, true, {
      specialties: { create: { specialtyId: neuroSpec.id } },
    });
    Object.assign(fac, { station: s.id, near: n.id, neuro: x.id });
    ids.facilities.push(s.id, n.id, x.id);
    const passwordHash = await hashPassword(PASSWORD);
    const user = (
      k: Who,
      role: 'COMMUNE_STAFF' | 'PROVINCE_STAFF' | 'ADMIN',
      facilityId?: string,
    ) =>
      prisma.user.create({
        data: {
          email: `${k}-${tag}@e2e.test`,
          passwordHash,
          fullName: `NV ${k}`,
          role,
          ...(facilityId && { staffProfile: { create: { facilityId, position: 'DOCTOR' } } }),
        },
      });
    const users = await Promise.all([
      user('station', 'COMMUNE_STAFF', s.id),
      user('near', 'PROVINCE_STAFF', n.id),
      user('neuro', 'PROVINCE_STAFF', x.id),
      user('admin', 'ADMIN'),
    ]);
    ids.users.push(...users.map((u) => u.id));
    patientId = (
      await prisma.patient.create({
        data: { fullName: `BN ${tag}`, dateOfBirth: new Date('1980-01-01'), gender: 'MALE' },
      })
    ).id;
    ids.patients.push(patientId);
    for (const k of ['station', 'near', 'neuro', 'admin'] as const)
      access[k] = (
        (
          await http()
            .post('/api/auth/login')
            .send({ identifier: `${k}-${tag}@e2e.test`, password: PASSWORD })
            .expect(200)
        ).body as {
          accessToken: string;
        }
      ).accessToken;
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
            { entityType: 'Referral', action: 'ESCALATE', userId: null },
          ],
        },
      });
      await prisma.referral.deleteMany({ where: { patientId: { in: ids.patients } } });
      await prisma.medicalRecord.deleteMany({ where: { patientId: { in: ids.patients } } });
      await prisma.patient.deleteMany({ where: { id: { in: ids.patients } } });
      await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
      await prisma.facilitySpecialty.deleteMany({ where: { facilityId: { in: ids.facilities } } });
      await prisma.healthFacility.deleteMany({ where: { id: { in: ids.facilities } } });
    }
    await app.close();
  });

  it('bệnh viện cập nhật năng lực tiếp nhận → mức tải; trạm không cập nhật được; điều phối viên được báo', async (ctx) => {
    if (!dbReady) return ctx.skip();
    await http()
      .put('/api/coordination/capacity')
      .set(as('station'))
      .send({ erBedsTotal: 5, erBedsAvailable: 5 })
      .expect(403);
    await http()
      .put('/api/coordination/capacity')
      .set(as('near'))
      .send({ erBedsTotal: 10, erBedsAvailable: 11 })
      .expect(400);
    const admin = await connect('admin');
    const upd = next<{ id: string; load: string }>(admin, 'capacity_update');
    const res = await http()
      .put('/api/coordination/capacity')
      .set(as('near'))
      .send({
        erBedsTotal: 20,
        erBedsAvailable: 1,
        icuBedsAvailable: 0,
        capacityNote: 'Đang có tai nạn hàng loạt',
      })
      .expect(200);
    expect(res.body).toMatchObject({ load: 'RED', capacityStale: false, erBedsAvailable: 1 });
    expect(await upd).toMatchObject({ id: fac.near, load: 'RED' });
    await http()
      .put('/api/coordination/capacity')
      .set(as('neuro'))
      .send({ erBedsTotal: 30, erBedsAvailable: 12, icuBedsAvailable: 3 })
      .expect(200);
    const mine = (await http().get('/api/coordination/capacity').set(as('neuro')).expect(200))
      .body as { load: string };
    expect(mine.load).toBe('GREEN');
  });

  it('gợi ý bệnh viện: có chuyên khoa cần + còn giường được xếp trên BV gần hơn nhưng quá tải; không loại BV nào', async (ctx) => {
    if (!dbReady) return ctx.skip();
    type Dest = {
      id: string;
      score: number;
      recommended: boolean;
      reasons: string[];
      warnings: string[];
      load: string;
      travelMinutes: number;
    };
    const list = (
      await http()
        .get('/api/referrals/destinations?priority=CRITICAL&specialty=NEUROSURGERY')
        .set(as('station'))
        .expect(200)
    ).body as Dest[];
    const mine = list.filter((d) => [fac.near, fac.neuro].includes(d.id));
    expect(mine.map((d) => d.id)).toEqual([fac.neuro, fac.near]);
    const [neuro, near] = mine as [Dest, Dest];
    expect(neuro.reasons).toEqual(
      expect.arrayContaining(['Có Ngoại thần kinh', 'Còn 12 giường cấp cứu']),
    );
    expect(near.warnings.join()).toMatch(/Không có Ngoại thần kinh.*quá tải|quá tải.*Không có/s);
    expect(near.travelMinutes).toBeLessThan(neuro.travelMinutes);
    // Không cần chuyên khoa, ca thường: vẫn trả đủ, BV quá tải vẫn có mặt
    const routine = (
      await http()
        .get('/api/referrals/destinations?priority=ROUTINE')
        .set(as('station'))
        .expect(200)
    ).body as Dest[];
    expect(routine.map((d) => d.id)).toEqual(expect.arrayContaining([fac.near, fac.neuro]));
    await http().get('/api/referrals/destinations?priority=X').set(as('station')).expect(400);
  });

  it('leo thang: ca tối khẩn 3 phút chưa xác nhận → nhắc kíp trực + báo tuyến dưới; 6 phút → báo điều phối Sở Y tế', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = await refer();
    const accepted = await refer();
    await http().post(`/api/referrals/${accepted}/accept`).set(as('near')).send({}).expect(200);
    const routine = await refer({ priority: 'ROUTINE' });
    const back = (min: number, rid = id) =>
      prisma.referral.update({
        where: { id: rid },
        data: { createdAt: new Date(Date.now() - min * 60_000) },
      });
    await Promise.all([back(4), back(10, accepted), back(60, routine)]);

    const [hospital, station, admin] = await Promise.all([
      connect('near'),
      connect('station'),
      connect('admin'),
    ]);
    const remind = next<{ id: string; escalated: number }>(hospital, 'new_incoming_referral');
    const toStation = next<{ id: string; level: number; toFacilityPhone: string | null }>(
      station,
      'referral_escalated',
    );
    // Chỉ xét ca của test này — CSDL dùng chung có thể còn ca chờ khác cũng bị quét
    const adminEvents: unknown[] = [];
    admin.on('referral_escalated', (e: { id: string }) => {
      if (e.id === id) adminEvents.push(e);
    });
    expect(await escalation.run()).toBeGreaterThanOrEqual(1);
    expect(await remind).toMatchObject({ id, escalated: 1 });
    expect(await toStation).toMatchObject({ id, level: 1 });
    expect(adminEvents).toHaveLength(0);
    // Chạy lại khi chưa tới mức 2 → không gửi trùng
    await escalation.run();
    const lvl = await prisma.referral.findUniqueOrThrow({
      where: { id },
      select: { escalationLevel: true },
    });
    expect(lvl.escalationLevel).toBe(1);
    // Ca đã xác nhận / ca thường không leo thang
    const others = await prisma.referral.findMany({
      where: { id: { in: [accepted, routine] } },
      select: { escalationLevel: true },
    });
    expect(others.map((o) => o.escalationLevel)).toEqual([0, 0]);

    await back(7);
    const toAdmin = new Promise<{ id: string; level: number }>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout referral_escalated')), 2000);
      admin.on('referral_escalated', (e: { id: string; level: number }) => {
        if (e.id !== id) return;
        clearTimeout(t);
        resolve(e);
      });
    });
    await escalation.run();
    expect(await toAdmin).toMatchObject({ id, level: 2 });

    // Tổng quan điều phối cho Sở Y tế
    const o = (await http().get('/api/coordination/overview').set(as('admin')).expect(200))
      .body as {
      hospitals: { id: string; load: string }[];
      waiting: { id: string; escalationLevel: number }[];
    };
    expect(o.hospitals.find((h) => h.id === fac.near)?.load).toBe('RED');
    expect(o.waiting.find((w) => w.id === id)?.escalationLevel).toBe(2);
    await http().get('/api/coordination/overview').set(as('near')).expect(403);
    const log = await prisma.auditLog.findFirst({
      where: { entityId: id, action: 'ESCALATE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(log?.metadata).toMatchObject({ level: 2 });
  });
});
