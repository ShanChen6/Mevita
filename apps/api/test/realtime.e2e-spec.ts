/**
 * Kênh realtime Socket.io (Task 4.1): vé socket, phòng theo cơ sở, người đang trực, phát sự kiện.
 */
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RealtimeIoAdapter } from '../src/realtime/realtime-io.adapter.js';

const PASSWORD = 'TestPass123';
const tag = `rt${Date.now().toString(36)}`;

interface Presence {
  facilityId: string;
  onDuty: { userId: string; fullName: string; connections: number }[];
}

describe('Kênh realtime (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let url = '';
  let dbReady = false;
  const ids = { users: [] as string[], facilities: [] as string[] };
  const access = {} as Record<'doc1' | 'doc2' | 'commune' | 'patient', string>;
  const userId = {} as Record<'doc1' | 'doc2', string>;
  let hospitalId = '';
  const sockets: Socket[] = [];

  const http = () => request(app.getHttpServer());
  const ticket = async (who: keyof typeof access) =>
    (
      (
        await http()
          .post('/api/realtime/ticket')
          .set('Authorization', `Bearer ${access[who]}`)
          .expect(200)
      ).body as { ticket: string }
    ).ticket;
  /** Mở kết nối; resolve khi kết nối xong hoặc reject với lỗi connect_error */
  const connect = (token: unknown) =>
    new Promise<Socket>((resolve, reject) => {
      const s = io(`${url}/realtime`, {
        auth: { token },
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
      });
      sockets.push(s);
      s.on('connect', () => resolve(s));
      s.on('connect_error', (e) => reject(e));
    });
  const next = <T>(s: Socket, event: string, timeoutMs = 2000) =>
    new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`timeout ${event}`)), timeoutMs);
      s.once(event, (data: T) => {
        clearTimeout(t);
        resolve(data);
      });
    });
  /** Không nhận được sự kiện trong khoảng thời gian chờ */
  const silent = (s: Socket, event: string, ms = 400) =>
    new Promise<boolean>((resolve) => {
      const handler = () => resolve(false);
      s.once(event, handler);
      setTimeout(() => {
        s.off(event, handler);
        resolve(true);
      }, ms);
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useWebSocketAdapter(new RealtimeIoAdapter(app));
    await app.listen(0);
    url = (await app.getUrl()).replace('[::1]', 'localhost');
    prisma = app.get(PrismaService);
    dbReady = (await prisma.isHealthy()) && (await prisma.commune.count()) > 0;
    if (!dbReady) return console.warn('⚠️  Bỏ qua e2e realtime: DB chưa sẵn sàng.');

    const [h, x] = await Promise.all([
      prisma.healthFacility.create({
        data: {
          code: `E2E-H-${tag}`,
          name: 'BV H',
          type: 'PROVINCIAL_GENERAL_HOSPITAL',
          level: 'BASIC',
          communeCode: '02647',
        },
      }),
      prisma.healthFacility.create({
        data: {
          code: `E2E-X-${tag}`,
          name: 'Trạm X',
          type: 'COMMUNE_HEALTH_STATION',
          level: 'PRIMARY',
          communeCode: '02761',
        },
      }),
    ]);
    hospitalId = h.id;
    ids.facilities.push(h.id, x.id);
    const passwordHash = await hashPassword(PASSWORD);
    const mk = (
      k: string,
      role: 'PROVINCE_STAFF' | 'COMMUNE_STAFF' | 'PATIENT',
      facilityId?: string,
    ) =>
      prisma.user.create({
        data: {
          email: `${k}-${tag}@e2e.test`,
          passwordHash,
          fullName: `NV ${k}`,
          role,
          ...(facilityId && {
            staffProfile: { create: { facilityId, position: 'DOCTOR', academicTitle: 'BS' } },
          }),
        },
      });
    const users = await Promise.all([
      mk('doc1', 'PROVINCE_STAFF', h.id),
      mk('doc2', 'PROVINCE_STAFF', h.id),
      mk('commune', 'COMMUNE_STAFF', x.id),
      mk('patient', 'PATIENT'),
    ]);
    ids.users.push(...users.map((u) => u.id));
    userId.doc1 = users[0].id;
    userId.doc2 = users[1].id;
    for (const k of ['doc1', 'doc2', 'commune', 'patient'] as const) {
      access[k] = (
        (
          await http()
            .post('/api/auth/login')
            .send({ identifier: `${k}-${tag}@e2e.test`, password: PASSWORD })
            .expect(200)
        ).body as { accessToken: string }
      ).accessToken;
    }
  });

  afterEach(() => {
    while (sockets.length) sockets.pop()!.disconnect();
  });

  afterAll(async () => {
    if (dbReady) {
      await prisma.auditLog.deleteMany({ where: { userId: { in: ids.users } } });
      await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
      await prisma.healthFacility.deleteMany({ where: { id: { in: ids.facilities } } });
    }
    await app.close();
  });

  it('từ chối kết nối không có vé, dùng access token thường, vé hết hạn hoặc giả mạo', async (ctx) => {
    if (!dbReady) return ctx.skip();
    await expect(connect(undefined)).rejects.toThrow('unauthorized');
    await expect(connect(access.doc1)).rejects.toThrow('unauthorized');
    const jwt = app.get(JwtService);
    const expired = await jwt.signAsync(
      {
        sub: userId.doc1,
        role: 'PROVINCE_STAFF',
        name: 'x',
        exp: Math.floor(Date.now() / 1000) - 10,
      },
      { audience: 'mevita-socket' },
    );
    await expect(connect(expired)).rejects.toThrow('unauthorized');
    const real = await ticket('doc1');
    await expect(connect(real.slice(0, -4) + 'AAAA')).rejects.toThrow('unauthorized');
    await http().post('/api/realtime/ticket').expect(401);
  });

  it('bác sĩ tỉnh tự vào phòng của bệnh viện; bệnh nhân chỉ vào phòng riêng', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const doc = await connect(await ticket('doc1'));
    const who = (await doc.emitWithAck('whoami')) as {
      user: { id: string; facilityId: string };
      rooms: string[];
    };
    expect(who.user).toMatchObject({ id: userId.doc1, facilityId: hospitalId });
    expect(who.rooms.sort()).toEqual([`facility_${hospitalId}`, `user_${userId.doc1}`].sort());

    const patient = await connect(await ticket('patient'));
    const pw = (await patient.emitWithAck('whoami')) as { rooms: string[] };
    expect(pw.rooms).toHaveLength(1);
    expect(pw.rooms[0]).toMatch(/^user_/);
  });

  it('danh sách đang trực cập nhật khi có người vào/ra; nhiều tab tính là một người', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const doc1 = await connect(await ticket('doc1'));
    await next<Presence>(doc1, 'presence_update').catch(() => null);

    const joined = next<Presence>(doc1, 'presence_update');
    const doc2 = await connect(await ticket('doc2'));
    expect((await joined).onDuty.map((s) => s.userId).sort()).toEqual(
      [userId.doc1, userId.doc2].sort(),
    );

    // doc1 mở thêm tab: danh sách không đổi, không phát lại cho cả phòng
    const quiet = silent(doc2, 'presence_update');
    const tab2 = await connect(await ticket('doc1'));
    expect(await quiet).toBe(true);
    tab2.disconnect();

    const left = next<Presence>(doc1, 'presence_update');
    doc2.disconnect();
    expect((await left).onDuty.map((s) => s.userId)).toEqual([userId.doc1]);

    const viaHttp = await http()
      .get('/api/realtime/presence')
      .set('Authorization', `Bearer ${access.doc1}`)
      .expect(200);
    expect((viaHttp.body as Presence).onDuty).toEqual([
      expect.objectContaining({ userId: userId.doc1, connections: 1 }),
    ]);
  });

  it('tín hiệu kiểm tra kênh chỉ tới đồng nghiệp cùng bệnh viện', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const [doc1, doc2, commune, patient] = await Promise.all([
      connect(await ticket('doc1')),
      connect(await ticket('doc2')),
      connect(await ticket('commune')),
      connect(await ticket('patient')),
    ]);
    const got1 = next<{ from: { fullName: string } }>(doc1, 'channel_test');
    const got2 = next<{ from: { fullName: string } }>(doc2, 'channel_test');
    const notCommune = silent(commune, 'channel_test');
    const notPatient = silent(patient, 'channel_test');

    const res = await http()
      .post('/api/realtime/test-signal')
      .set('Authorization', `Bearer ${access.doc1}`)
      .expect(200);
    expect((res.body as { delivered: number }).delivered).toBe(2);
    expect((await got1).from.fullName).toBe('NV doc1');
    expect((await got2).from.fullName).toBe('NV doc1');
    expect(await notCommune).toBe(true);
    expect(await notPatient).toBe(true);

    await http()
      .post('/api/realtime/test-signal')
      .set('Authorization', `Bearer ${access.patient}`)
      .expect(403);
  });
});
