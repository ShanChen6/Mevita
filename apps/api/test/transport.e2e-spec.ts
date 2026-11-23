/**
 * Xe chuyển viện & theo dõi vị trí (Task C).
 */
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RealtimeIoAdapter } from '../src/realtime/realtime-io.adapter.js';

const PASSWORD = 'TestPass123';
const tag = `tr${Date.now().toString(36)}`;
type Who = 'station' | 'nurse' | 'hospital' | 'near' | 'other';

// Toạ độ: trạm ở Mường Khương; BV nhận ở TP Lào Cai; BV lân cận gần trạm hơn; trạm khác ở Cà Mau (xa)
const GEO = {
  station: { latitude: 22.7676, longitude: 104.1236 },
  hospital: { latitude: 22.4127, longitude: 104.0226 },
  near: { latitude: 22.6, longitude: 104.08 },
  other: { latitude: 9.18, longitude: 105.15 },
};

describe('Xe chuyển viện & vị trí (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let url = '';
  let dbReady = false;
  const ids = { users: [] as string[], patients: [] as string[], facilities: [] as string[] };
  const access = {} as Record<Who, string>;
  const fac = {} as Record<'station' | 'hospital' | 'near' | 'other', string>;
  const veh = {} as Record<'stationTruck' | 'stationAmb' | 'hospitalAmb' | 'nearAmb', string>;
  let patientId = '';
  let nurseId = '';
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
  const next = <T>(s: Socket, event: string, ms = 2000) =>
    new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`timeout ${event}`)), ms);
      s.once(event, (d: T) => (clearTimeout(t), resolve(d)));
    });
  const collect = (s: Socket, event: string) => {
    const got: unknown[] = [];
    s.on(event, (x: unknown) => got.push(x));
    return got;
  };
  const newRecord = async () =>
    (
      await prisma.medicalRecord.create({
        data: {
          code: `E2E${tag}${++seq}`,
          patientId,
          doctorId: ids.users[0],
          facilityId: fac.station,
          chiefComplaint: 'Chấn thương',
        },
      })
    ).id;
  const body = (o: Record<string, unknown> = {}) => ({
    toFacilityId: fac.hospital,
    priority: 'CRITICAL',
    reason: 'Chấn thương sọ não, cần phẫu thuật',
    clinicalSummary: 'Nam 40 tuổi, ngã xe, GCS 12',
    escortId: nurseId,
    etaMinutes: 60,
    ...o,
  });
  const point = (g: { latitude: number; longitude: number }, o: Record<string, unknown> = {}) => ({
    clientId: randomUUID(),
    recordedAt: new Date().toISOString(),
    ...g,
    speed: 12,
    accuracy: 15,
    ...o,
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useWebSocketAdapter(new RealtimeIoAdapter(app));
    await app.listen(0);
    url = (await app.getUrl()).replace('[::1]', 'localhost');
    prisma = app.get(PrismaService);
    dbReady = (await prisma.isHealthy()) && (await prisma.specialty.count()) > 0;
    if (!dbReady)
      return console.warn('⚠️  Bỏ qua e2e xe chuyển viện: DB chưa sẵn sàng hoặc chưa seed.');

    const mk = (k: keyof typeof GEO, hospital: boolean) =>
      prisma.healthFacility.create({
        data: {
          code: `E${k.slice(0, 4)}-${tag}`,
          name: `${k} ${tag}`,
          type: hospital ? 'PROVINCIAL_GENERAL_HOSPITAL' : 'COMMUNE_HEALTH_STATION',
          level: hospital ? 'BASIC' : 'PRIMARY',
          communeCode: '02761',
          acceptsReferrals: hospital,
          ...GEO[k],
        },
      });
    const [s, h, n, o] = await Promise.all([
      mk('station', false),
      mk('hospital', true),
      mk('near', true),
      mk('other', false),
    ]);
    Object.assign(fac, { station: s.id, hospital: h.id, near: n.id, other: o.id });
    ids.facilities.push(s.id, h.id, n.id, o.id);
    const v = (
      facilityId: string,
      plate: string,
      type: 'ADVANCED_AMBULANCE' | 'BASIC_AMBULANCE' | 'TRANSPORT',
    ) => prisma.vehicle.create({ data: { facilityId, plateNumber: plate, type } });
    const plate = (k: string) => `99${k}-${tag.slice(-6)}`.toUpperCase().slice(0, 20);
    const [vt, va, vh, vn] = await Promise.all([
      v(s.id, plate('T'), 'TRANSPORT'),
      v(s.id, plate('A'), 'BASIC_AMBULANCE'),
      v(h.id, plate('H'), 'ADVANCED_AMBULANCE'),
      v(n.id, plate('N'), 'ADVANCED_AMBULANCE'),
    ]);
    Object.assign(veh, {
      stationTruck: vt.id,
      stationAmb: va.id,
      hospitalAmb: vh.id,
      nearAmb: vn.id,
    });

    const passwordHash = await hashPassword(PASSWORD);
    const staff = (
      k: Who,
      facilityId: string,
      role: 'COMMUNE_STAFF' | 'PROVINCE_STAFF',
      position: 'DOCTOR' | 'NURSE' = 'DOCTOR',
    ) =>
      prisma.user.create({
        data: {
          email: `${k}-${tag}@e2e.test`,
          passwordHash,
          fullName: `NV ${k}`,
          role,
          staffProfile: { create: { facilityId, position } },
        },
      });
    const users = await Promise.all([
      staff('station', s.id, 'COMMUNE_STAFF'),
      staff('nurse', s.id, 'COMMUNE_STAFF', 'NURSE'),
      staff('hospital', h.id, 'PROVINCE_STAFF'),
      staff('near', n.id, 'PROVINCE_STAFF'),
      staff('other', o.id, 'COMMUNE_STAFF'),
    ]);
    ids.users.push(...users.map((u) => u.id));
    nurseId = users[1].id;
    patientId = (
      await prisma.patient.create({
        data: { fullName: `BN ${tag}`, dateOfBirth: new Date('1985-01-01'), gender: 'MALE' },
      })
    ).id;
    ids.patients.push(patientId);
    for (const k of ['station', 'nurse', 'hospital', 'near', 'other'] as const)
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
      await prisma.auditLog.deleteMany({ where: { userId: { in: ids.users } } });
      await prisma.referral.deleteMany({ where: { patientId: { in: ids.patients } } });
      await prisma.medicalRecord.deleteMany({ where: { patientId: { in: ids.patients } } });
      await prisma.patient.deleteMany({ where: { id: { in: ids.patients } } });
      await prisma.vehicle.deleteMany({ where: { facilityId: { in: ids.facilities } } });
      await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
      await prisma.healthFacility.deleteMany({ where: { id: { in: ids.facilities } } });
    }
    await app.close();
  });

  it('quản lý xe của cơ sở: thêm, kiểm tra biển số, chỉ cơ sở mình sửa được', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const list = (await http().get('/api/vehicles').set(as('station')).expect(200)).body as {
      id: string;
    }[];
    expect(list.map((x) => x.id).sort()).toEqual([veh.stationTruck, veh.stationAmb].sort());
    await http()
      .post('/api/vehicles')
      .set(as('station'))
      .send({ plateNumber: 'abc', type: 'TRANSPORT' })
      .expect(400);
    const created = (
      await http()
        .post('/api/vehicles')
        .set(as('station'))
        .send({
          plateNumber: `98B-${String(Date.now()).slice(-6)}`,
          type: 'TRANSPORT',
          driverPhone: '0912345678',
        })
        .expect(201)
    ).body as { id: string; plateNumber: string };
    await http()
      .post('/api/vehicles')
      .set(as('station'))
      .send({ plateNumber: created.plateNumber, type: 'TRANSPORT' })
      .expect(409);
    await http()
      .patch(`/api/vehicles/${created.id}`)
      .set(as('hospital'))
      .send({ status: 'MAINTENANCE' })
      .expect(404);
    await http()
      .patch(`/api/vehicles/${created.id}`)
      .set(as('station'))
      .send({ isActive: false })
      .expect(200);
  });

  it('phương án vận chuyển: xe của trạm, cơ sở có thể cử xe đón (gần nhất trước), thời gian chở ước tính', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const o = (
      await http()
        .get(`/api/referrals/transport-options?toFacilityId=${fac.hospital}`)
        .set(as('station'))
        .expect(200)
    ).body as {
      ownVehicles: { id: string }[];
      pickupCandidates: { id: string; distanceKm: number; pickupMinutes: number }[];
      transportMinutes: number;
      recommendation: Record<string, string>;
    };
    expect(o.ownVehicles.map((v) => v.id)).toEqual(
      expect.arrayContaining([veh.stationTruck, veh.stationAmb]),
    );
    const mine = o.pickupCandidates.filter((c) => [fac.near, fac.hospital].includes(c.id));
    expect(mine.map((c) => c.id)).toEqual([fac.near, fac.hospital]); // gần nhất trước
    expect(mine[0].pickupMinutes).toBeLessThan(mine[1].pickupMinutes);
    expect(o.pickupCandidates.map((c) => c.id)).not.toContain(fac.other);
    expect(o.transportMinutes).toBeGreaterThan(30);
    expect(o.recommendation.CRITICAL).toMatch(/xe cứu thương/);
  });

  it('khuyến nghị theo mức độ: ca tối khẩn đi xe thường / gia đình phải ghi lý do; một xe không chở hai ca', async (ctx) => {
    if (!dbReady) return ctx.skip();
    await http()
      .post('/api/referrals')
      .set(as('station'))
      .send(
        body({
          sourceRecordId: await newRecord(),
          transportMode: 'FACILITY_VEHICLE',
          vehicleId: veh.stationTruck,
        }),
      )
      .expect(400);
    await http()
      .post('/api/referrals')
      .set(as('station'))
      .send(body({ sourceRecordId: await newRecord(), transportMode: 'FAMILY' }))
      .expect(400);
    await http()
      .post('/api/referrals')
      .set(as('station'))
      .send(
        body({
          sourceRecordId: await newRecord(),
          transportMode: 'FACILITY_VEHICLE',
          vehicleId: veh.hospitalAmb,
        }),
      )
      .expect(400); // xe cơ sở khác
    // Ca thường: gia đình tự túc không cần lý do
    await http()
      .post('/api/referrals')
      .set(as('station'))
      .send(
        body({ sourceRecordId: await newRecord(), priority: 'ROUTINE', transportMode: 'FAMILY' }),
      )
      .expect(201);
    // Có lý do → được, ghi nhật ký "dưới khuyến nghị"
    const r = (
      await http()
        .post('/api/referrals')
        .set(as('station'))
        .send(
          body({
            sourceRecordId: await newRecord(),
            transportMode: 'FACILITY_VEHICLE',
            vehicleId: veh.stationTruck,
            transportNote: 'Đường sạt lở, xe cứu thương không vào được',
          }),
        )
        .expect(201)
    ).body as { referral: { id: string; vehicle: { id: string } } };
    expect(r.referral.vehicle.id).toBe(veh.stationTruck);
    expect(
      (await prisma.vehicle.findUniqueOrThrow({ where: { id: veh.stationTruck } })).status,
    ).toBe('ON_MISSION');
    const log = await prisma.auditLog.findFirst({
      where: { entityId: r.referral.id, action: 'CREATE' },
    });
    expect(log?.metadata).toMatchObject({ belowRecommendation: true });
    // Xe đang chở → không giao ca khác
    await http()
      .post('/api/referrals')
      .set(as('station'))
      .send(
        body({
          sourceRecordId: await newRecord(),
          transportMode: 'FACILITY_VEHICLE',
          vehicleId: veh.stationTruck,
          transportNote: 'Lý do đủ dài để hợp lệ',
        }),
      )
      .expect(409);
    // Huỷ ca → trả xe
    await http()
      .post(`/api/referrals/${r.referral.id}/cancel`)
      .set(as('station'))
      .send({ reason: 'Bệnh nhân ổn định' })
      .expect(200);
    expect(
      (await prisma.vehicle.findUniqueOrThrow({ where: { id: veh.stationTruck } })).status,
    ).toBe('AVAILABLE');
  });

  it('xe đón: yêu cầu tới BV nhận + cơ sở lân cận có xe; hai nơi bấm cùng lúc chỉ một nơi được giao', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const [hs, ns, os, ss] = await Promise.all([
      connect('hospital'),
      connect('near'),
      connect('other'),
      connect('station'),
    ]);
    const leak = collect(os, 'pickup_request');
    const toHospital = next<{ id: string; distanceKm: number | null }>(hs, 'pickup_request');
    const toNear = next<{ id: string; distanceKm: number }>(ns, 'pickup_request');
    const created = (
      await http()
        .post('/api/referrals')
        .set(as('station'))
        .send(
          body({ sourceRecordId: await newRecord(), transportMode: 'PICKUP', etaMinutes: null }),
        )
        .expect(201)
    ).body as {
      referral: { id: string; departedAt: string | null; estimatedArrivalAt: string | null };
      pickup: { facilities: number };
    };
    const id = created.referral.id;
    expect(created.referral).toMatchObject({ departedAt: null, estimatedArrivalAt: null });
    expect(created.pickup.facilities).toBeGreaterThanOrEqual(2); // + BV demo gần đó nếu có
    expect((await toHospital).id).toBe(id);
    expect((await toNear).distanceKm).toBeGreaterThan(10);
    expect(leak).toHaveLength(0);
    const list = (await http().get('/api/referrals/pickup-requests').set(as('near')).expect(200))
      .body as { id: string; canDispatch: boolean }[];
    expect(list).toEqual([expect.objectContaining({ id, canDispatch: true })]);
    await http().get('/api/referrals/pickup-requests').set(as('other')).expect(200).expect([]);
    // Trước khi nhận, BV lân cận chưa xem được hồ sơ
    await http().get(`/api/referrals/${id}`).set(as('near')).expect(404);

    const closed = next<{ id: string; assignedTo: string }>(hs, 'pickup_closed');
    const toStation = next<{ action: string }>(ss, 'referral_updated');
    const [a, b] = await Promise.all([
      http().post(`/api/referrals/${id}/dispatch`).set(as('near')).send({ vehicleId: veh.nearAmb }),
      http()
        .post(`/api/referrals/${id}/dispatch`)
        .set(as('hospital'))
        .send({ vehicleId: veh.hospitalAmb }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const winner = a.status === 200 ? 'near' : 'hospital';
    const winVeh = winner === 'near' ? veh.nearAmb : veh.hospitalAmb;
    const loseVeh = winner === 'near' ? veh.hospitalAmb : veh.nearAmb;
    expect((await prisma.vehicle.findUniqueOrThrow({ where: { id: loseVeh } })).status).toBe(
      'AVAILABLE',
    );
    expect((await prisma.vehicle.findUniqueOrThrow({ where: { id: winVeh } })).status).toBe(
      'ON_MISSION',
    );
    expect((await closed).id).toBe(id);
    expect((await toStation).action).toBe('dispatch');
    const r = (await http().get(`/api/referrals/${id}`).set(as(winner)).expect(200)).body as {
      vehicle: { id: string };
      estimatedArrivalAt: string;
    };
    expect(r.vehicle.id).toBe(winVeh);
    expect(new Date(r.estimatedArrivalAt).getTime()).toBeGreaterThan(Date.now());
    await http().get('/api/referrals/pickup-requests').set(as('near')).expect(200).expect([]);
    await http()
      .post(`/api/referrals/${id}/cancel`)
      .set(as('station'))
      .send({ reason: 'Kết thúc test' })
      .expect(200);
    expect((await prisma.vehicle.findUniqueOrThrow({ where: { id: winVeh } })).status).toBe(
      'AVAILABLE',
    );
  });

  it('vị trí xe: tính lại giờ tới, báo "xe sắp tới" một lần, chống ghi trùng, chặn người ngoài; trả xe khi tới', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const created = (
      await http()
        .post('/api/referrals')
        .set(as('station'))
        .send(
          body({ sourceRecordId: await newRecord(), transportMode: 'PICKUP', etaMinutes: null }),
        )
        .expect(201)
    ).body as { referral: { id: string } };
    const id = created.referral.id;
    await http()
      .post(`/api/referrals/${id}/dispatch`)
      .set(as('near'))
      .send({ vehicleId: veh.nearAmb })
      .expect(200);
    const [hs, ss, crew] = await Promise.all([
      connect('hospital'),
      connect('station'),
      connect('near'),
    ]);

    // Chặng xe đón: đang trên đường tới trạm
    const onTheWay = point({ latitude: 22.7, longitude: 104.1 });
    const loc = next<{ phase: string; etaAt: string; remainingKm: number }>(ss, 'vehicle_location');
    const ack = (await crew
      .timeout(2000)
      .emitWithAck('vehicle_location', { referralId: id, entries: [onTheWay] })) as {
      ok: boolean;
      created: number;
    };
    expect(ack).toMatchObject({ ok: true, created: 1 });
    const ev = await loc;
    expect(ev.phase).toBe('pickup');
    expect(ev.remainingKm).toBeGreaterThan(5);
    const v = await prisma.vehicle.findUniqueOrThrow({ where: { id: veh.nearAmb } });
    expect(v).toMatchObject({ lastLatitude: 22.7, lastLongitude: 104.1 });
    // Gửi lại (mất sóng) không ghi trùng
    expect(
      await crew
        .timeout(2000)
        .emitWithAck('vehicle_location', { referralId: id, entries: [onTheWay] }),
    ).toMatchObject({ ok: true, created: 0 });
    // Người ngoài không gửi được vị trí
    await http()
      .post(`/api/referrals/${id}/locations`)
      .set(as('other'))
      .send({ entries: [point(GEO.other)] })
      .expect(403);
    await http()
      .post(`/api/referrals/${id}/locations`)
      .set(as('station'))
      .send({ entries: [{ ...point(GEO.station), latitude: 200 }] })
      .expect(400);

    // Đã đón → chặng chở bệnh nhân
    await http().post(`/api/referrals/${id}/picked-up`).set(as('near')).expect(200);
    await http().post(`/api/referrals/${id}/picked-up`).set(as('near')).expect(409);
    const arriving = next<{ id: string; remainingKm: number }>(hs, 'vehicle_arriving');
    const arrivingEvents = collect(hs, 'vehicle_arriving');
    const close = { latitude: GEO.hospital.latitude + 0.004, longitude: GEO.hospital.longitude };
    await http()
      .post(`/api/referrals/${id}/locations`)
      .set(as('nurse'))
      .send({ entries: [point(close)] })
      .expect(200);
    expect((await arriving).remainingKm).toBeLessThan(1);
    await http()
      .post(`/api/referrals/${id}/locations`)
      .set(as('nurse'))
      .send({ entries: [point(GEO.hospital)] })
      .expect(200);
    await new Promise((r) => setTimeout(r, 200));
    expect(arrivingEvents).toHaveLength(1);
    const r = (await http().get(`/api/referrals/${id}`).set(as('hospital')).expect(200)).body as {
      estimatedArrivalAt: string;
      pickedUpAt: string;
      arrivingNotifiedAt: string;
      latestLocation: { latitude: number };
    };
    expect(r.pickedUpAt).toBeTruthy();
    expect(r.arrivingNotifiedAt).toBeTruthy();
    expect(r.latestLocation.latitude).toBe(GEO.hospital.latitude);
    expect(new Date(r.estimatedArrivalAt).getTime() - Date.now()).toBeLessThan(5 * 60_000);
    const track = (
      await http().get(`/api/referrals/${id}/locations`).set(as('station')).expect(200)
    ).body as unknown[];
    expect(track).toHaveLength(3);
    await http().get(`/api/referrals/${id}/locations`).set(as('other')).expect(404);

    await http().post(`/api/referrals/${id}/arrive`).set(as('hospital')).expect(200);
    expect((await prisma.vehicle.findUniqueOrThrow({ where: { id: veh.nearAmb } })).status).toBe(
      'AVAILABLE',
    );
  });
});
