/**
 * Lệnh chuyển tuyến khẩn cấp (Task 4.2): lưu phiếu + cảnh báo realtime tới bệnh viện đích.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RealtimeIoAdapter } from '../src/realtime/realtime-io.adapter.js';

const PASSWORD = 'TestPass123';
const tag = `rf${Date.now().toString(36)}`;

interface Alert {
  id: string;
  code: string;
  priority: string;
  patient: { fullName: string; allergies: string | null };
  diagnosis: { icdCode: string } | null;
  fromFacility: { name: string };
  referredBy: string;
}

describe('Chuyển tuyến khẩn cấp (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let url = '';
  let dbReady = false;
  const ids = { users: [] as string[], patients: [] as string[], facilities: [] as string[] };
  const access = {} as Record<'commune' | 'nurse' | 'hospital' | 'central' | 'other', string>;
  const fac = {} as Record<'station' | 'hospital' | 'central' | 'otherStation', string>;
  let patientId = '';
  let recordId = '';
  let nurseId = '';
  const sockets: Socket[] = [];

  const http = () => request(app.getHttpServer());
  const as = (who: keyof typeof access) => ({ Authorization: `Bearer ${access[who]}` });
  const connect = async (who: keyof typeof access) => {
    const t = (
      (await http().post('/api/realtime/ticket').set(as(who)).expect(200)).body as {
        ticket: string;
      }
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
  const body = (overrides: Record<string, unknown> = {}) => ({
    sourceRecordId: recordId,
    toFacilityId: fac.hospital,
    priority: 'CRITICAL',
    reason: 'Nghi máu tụ nội sọ, vượt khả năng chuyên môn tuyến xã',
    clinicalSummary: 'Nam 36 tuổi, TNGT, lơ mơ, GCS 12, đồng tử 2 bên 3mm',
    initialTreatment: 'Cố định cột sống cổ, thở oxy 5 lít/phút',
    escortId: nurseId,
    vehicleInfo: 'Xe cứu thương 24A-123.45',
    etaMinutes: 45,
    ...overrides,
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useWebSocketAdapter(new RealtimeIoAdapter(app));
    await app.listen(0);
    url = (await app.getUrl()).replace('[::1]', 'localhost');
    prisma = app.get(PrismaService);
    dbReady =
      (await prisma.isHealthy()) &&
      (await prisma.icd10Code.count({ where: { code: 'S06.5' } })) === 1;
    if (!dbReady)
      return console.warn('⚠️  Bỏ qua e2e chuyển tuyến: DB chưa sẵn sàng hoặc chưa seed ICD-10.');

    const mkFacility = (
      k: string,
      communeCode: string,
      type: 'COMMUNE_HEALTH_STATION' | 'PROVINCIAL_GENERAL_HOSPITAL' | 'CENTRAL_HOSPITAL',
      acceptsReferrals: boolean,
    ) =>
      prisma.healthFacility.create({
        data: {
          code: `E${k.slice(0, 4)}-${tag}`,
          name: `${k} ${tag}`,
          type,
          level: acceptsReferrals ? 'BASIC' : 'PRIMARY',
          communeCode,
          acceptsReferrals,
        },
      });
    const [station, hospital, central, otherStation] = await Promise.all([
      mkFacility('Tram', '02761', 'COMMUNE_HEALTH_STATION', false), // Lào Cai
      mkFacility('BVTinh', '02647', 'PROVINCIAL_GENERAL_HOSPITAL', true), // Lào Cai
      mkFacility('BVTW', '00082', 'CENTRAL_HOSPITAL', true), // Hà Nội
      mkFacility('Khac', '02761', 'COMMUNE_HEALTH_STATION', false),
    ]);
    Object.assign(fac, {
      station: station.id,
      hospital: hospital.id,
      central: central.id,
      otherStation: otherStation.id,
    });
    ids.facilities.push(station.id, hospital.id, central.id, otherStation.id);

    const passwordHash = await hashPassword(PASSWORD);
    const staff = (
      k: string,
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
          staffProfile: {
            create: { facilityId, position, academicTitle: position === 'DOCTOR' ? 'BS' : 'ĐD' },
          },
        },
      });
    const users = await Promise.all([
      staff('commune', station.id, 'COMMUNE_STAFF'),
      staff('nurse', station.id, 'COMMUNE_STAFF', 'NURSE'),
      staff('hospital', hospital.id, 'PROVINCE_STAFF'),
      staff('central', central.id, 'PROVINCE_STAFF'),
      staff('other', otherStation.id, 'COMMUNE_STAFF'),
    ]);
    ids.users.push(...users.map((u) => u.id));
    nurseId = users[1].id;
    const patient = await prisma.patient.create({
      data: {
        fullName: `Lò Văn ${tag}`,
        dateOfBirth: new Date('1990-05-01'),
        gender: 'MALE',
        allergies: 'Penicillin',
        bloodType: 'O_POSITIVE',
      },
    });
    patientId = patient.id;
    ids.patients.push(patientId);
    recordId = (
      await prisma.medicalRecord.create({
        data: {
          code: `E2E-${tag}`,
          patientId,
          doctorId: users[0].id,
          facilityId: station.id,
          encounterType: 'EMERGENCY',
          chiefComplaint: 'Chấn thương đầu',
          pulse: 110,
          spo2: 93,
          diagnoses: { create: { icdCode: 'S06.5', isPrimary: true } },
        },
      })
    ).id;
    for (const k of ['commune', 'nurse', 'hospital', 'central', 'other'] as const) {
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
    }
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
      await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
      await prisma.healthFacility.deleteMany({ where: { id: { in: ids.facilities } } });
    }
    await app.close();
  });

  it('danh sách bệnh viện đích: trong tỉnh trước, liên tỉnh sau, kèm số bác sĩ đang trực', async (ctx) => {
    if (!dbReady) return ctx.skip();
    await connect('hospital');
    const list = (await http().get('/api/referrals/destinations').set(as('commune')).expect(200))
      .body as {
      id: string;
      sameProvince: boolean;
      onDutyCount: number;
    }[];
    const mine = list.filter((f) => f.id === fac.hospital || f.id === fac.central);
    expect(mine.map((f) => [f.id, f.sameProvince, f.onDutyCount])).toEqual([
      [fac.hospital, true, 1],
      [fac.central, false, 0],
    ]);
    expect(list.findIndex((f) => f.id === fac.hospital)).toBeLessThan(
      list.findIndex((f) => f.id === fac.central),
    );
    expect(list.map((f) => f.id)).not.toContain(fac.station);
    const escorts = (await http().get('/api/referrals/escorts').set(as('commune')).expect(200))
      .body as { id: string }[];
    expect(escorts.map((e) => e.id)).toContain(nurseId);
  });

  it('gửi lệnh: lưu phiếu và bác sĩ đang trực nhận new_incoming_referral ngay', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const hospitalDoc = await connect('hospital');
    const centralDoc = await connect('central');
    const alert = next<Alert>(hospitalDoc, 'new_incoming_referral');
    let centralGot = false;
    centralDoc.once('new_incoming_referral', () => (centralGot = true));

    const started = Date.now();
    const res = await http().post('/api/referrals').set(as('commune')).send(body()).expect(201);
    const { referral, delivered } = res.body as {
      referral: {
        id: string;
        code: string;
        status: string;
        interProvincial: boolean;
        estimatedArrivalAt: string;
      };
      delivered: number;
    };
    expect(delivered).toBe(1);
    expect(referral).toMatchObject({ status: 'PENDING', interProvincial: false });
    expect(new Date(referral.estimatedArrivalAt).getTime() - started).toBeGreaterThan(44 * 60_000);

    const got = await alert;
    expect(Date.now() - started).toBeLessThan(1000);
    expect(got).toMatchObject({
      id: referral.id,
      priority: 'CRITICAL',
      patient: { allergies: 'Penicillin' },
      diagnosis: { icdCode: 'S06.5' },
      referredBy: 'BS. NV commune',
    });
    await new Promise((r) => setTimeout(r, 200));
    expect(centralGot).toBe(false);

    // Không tạo phiếu thứ hai khi phiếu trước còn hiệu lực
    await http().post('/api/referrals').set(as('commune')).send(body()).expect(409);

    // Bệnh viện nhận: xem chi tiết & hồ sơ bệnh nhân; cơ sở không liên quan: 404
    const detail = (
      await http().get(`/api/referrals/${referral.id}`).set(as('hospital')).expect(200)
    ).body as {
      sourceRecord: { pulse: number; diagnoses: { icdCode: string }[] };
      escort: { name: string };
    };
    expect(detail).toMatchObject({
      sourceRecord: { pulse: 110, diagnoses: [{ icdCode: 'S06.5' }] },
      escort: { name: 'ĐD. NV nurse' },
    });
    await http().get(`/api/referrals/${referral.id}`).set(as('other')).expect(404);
    await http().get(`/api/patients/${patientId}`).set(as('hospital')).expect(200);

    const incoming = (
      await http()
        .get('/api/referrals?direction=incoming&active=true')
        .set(as('hospital'))
        .expect(200)
    ).body as { id: string }[];
    expect(incoming.map((r) => r.id)).toContain(referral.id);
    const outgoing = (
      await http().get('/api/referrals?direction=outgoing').set(as('commune')).expect(200)
    ).body as { id: string }[];
    expect(outgoing.map((r) => r.id)).toContain(referral.id);

    // Huỷ → bệnh viện nhận referral_updated
    const updated = next<{ id: string; status: string }>(hospitalDoc, 'referral_updated');
    await http()
      .post(`/api/referrals/${referral.id}/cancel`)
      .set(as('hospital'))
      .send({ reason: 'Nhầm' })
      .expect(404);
    await http()
      .post(`/api/referrals/${referral.id}/cancel`)
      .set(as('commune'))
      .send({ reason: 'Bệnh nhân ổn định' })
      .expect(200);
    expect(await updated).toMatchObject({ id: referral.id, status: 'CANCELLED' });
    await http()
      .post(`/api/referrals/${referral.id}/cancel`)
      .set(as('commune'))
      .send({ reason: 'x lần nữa' })
      .expect(409);
  });

  it('liên tỉnh khi không ai trực: vẫn lưu phiếu, delivered = 0 (giao diện nhắc gọi đường dây nóng)', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const res = await http()
      .post('/api/referrals')
      .set(as('commune'))
      .send(body({ toFacilityId: fac.central }))
      .expect(201);
    expect(res.body).toMatchObject({
      delivered: 0,
      referral: { interProvincial: true, status: 'PENDING' },
    });
  });

  it('từ chối dữ liệu không hợp lệ và người không có quyền', async (ctx) => {
    if (!dbReady) return ctx.skip();
    await http()
      .post('/api/referrals')
      .set(as('commune'))
      .send(body({ toFacilityId: fac.otherStation }))
      .expect(400); // trạm không nhận chuyển tuyến
    await http()
      .post('/api/referrals')
      .set(as('commune'))
      .send(body({ escortId: ids.users[2] }))
      .expect(400); // người đi kèm không thuộc trạm
    await http()
      .post('/api/referrals')
      .set(as('commune'))
      .send(body({ etaMinutes: 2 }))
      .expect(400);
    await http()
      .post('/api/referrals')
      .set(as('commune'))
      .send(body({ priority: 'X' }))
      .expect(400);
    await http().post('/api/referrals').set(as('other')).send(body()).expect(404); // hồ sơ không thuộc cơ sở
  });

  describe('sinh tồn trên xe (Task 4.3)', () => {
    let referralId = '';
    const vital = (o: Record<string, unknown> = {}) => ({
      clientId: randomUUID(),
      recordedAt: new Date().toISOString(),
      pulse: 112,
      systolicBp: 95,
      diastolicBp: 60,
      spo2: 92,
      consciousness: 'VOICE',
      gcs: 12,
      ...o,
    });
    interface Ack {
      ok: boolean;
      accepted?: string[];
      created?: number;
      message?: string;
      retry?: boolean;
    }
    interface VitalEvent {
      referralId: string;
      vitals: { clientId: string; spo2: number; recordedBy: string }[];
    }
    const send = (s: Socket, entries: unknown[], id = referralId) =>
      s.timeout(2000).emitWithAck('vital_update', { referralId: id, entries }) as Promise<Ack>;

    beforeAll(async () => {
      if (!dbReady) return;
      const record = await prisma.medicalRecord.create({
        data: {
          code: `E2E-${tag}-V`,
          patientId,
          doctorId: ids.users[0],
          facilityId: fac.station,
          encounterType: 'EMERGENCY',
          chiefComplaint: 'Đa chấn thương',
        },
      });
      const res = await http()
        .post('/api/referrals')
        .set(as('commune'))
        .send(body({ sourceRecordId: record.id }))
        .expect(201);
      referralId = (res.body as { referral: { id: string } }).referral.id;
    });

    it('nhân viên đi kèm gửi qua socket → bệnh viện nhận vital_update ngay; gửi lại không ghi trùng', async (ctx) => {
      if (!dbReady) return ctx.skip();
      const hospital = await connect('hospital');
      const nurse = await connect('nurse');
      const first = [vital({ recordedAt: new Date(Date.now() - 60_000).toISOString() }), vital()];
      const pushed = next<VitalEvent>(hospital, 'vital_update');
      const t0 = Date.now();
      const ack = await send(nurse, first);
      expect(ack).toMatchObject({ ok: true, created: 2 });
      const ev = await pushed;
      expect(Date.now() - t0).toBeLessThan(1000);
      expect(ev.referralId).toBe(referralId);
      expect(ev.vitals.map((v) => v.clientId)).toEqual(first.map((v) => v.clientId));
      expect(ev.vitals[0]?.recordedBy).toBe('ĐD. NV nurse');

      // Đồng bộ lại sau mất sóng: gửi lại cả lô cũ + 1 bản mới → chỉ ghi và phát bản mới
      const extra = vital({ spo2: 88 });
      const again = next<VitalEvent>(hospital, 'vital_update');
      const ack2 = await send(nurse, [...first, extra]);
      expect(ack2).toMatchObject({ ok: true, created: 1 });
      expect(ack2.accepted).toHaveLength(3);
      expect((await again).vitals.map((v) => v.clientId)).toEqual([extra.clientId]);

      const list = (
        await http().get(`/api/referrals/${referralId}/vitals`).set(as('hospital')).expect(200)
      ).body as { clientId: string }[];
      expect(list.map((v) => v.clientId)).toEqual([...first, extra].map((v) => v.clientId));
      const detail = (
        await http().get(`/api/referrals/${referralId}`).set(as('hospital')).expect(200)
      ).body as { vitalLogCount: number; latestVital: { spo2: number } };
      expect(detail).toMatchObject({ vitalLogCount: 3, latestVital: { spo2: 88 } });
    });

    it('REST dự phòng cũng idempotent; từ chối người ngoài cơ sở gửi và dữ liệu sai', async (ctx) => {
      if (!dbReady) return ctx.skip();
      const v = vital();
      const r1 = await http()
        .post(`/api/referrals/${referralId}/vitals`)
        .set(as('commune'))
        .send({ entries: [v] })
        .expect(200);
      const r2 = await http()
        .post(`/api/referrals/${referralId}/vitals`)
        .set(as('commune'))
        .send({ entries: [v] })
        .expect(200);
      expect([r1.body, r2.body]).toMatchObject([{ created: 1 }, { created: 0 }]);

      const hospital = await connect('hospital');
      expect(await send(hospital, [vital()])).toMatchObject({ ok: false, retry: false });
      await http()
        .post(`/api/referrals/${referralId}/vitals`)
        .set(as('other'))
        .send({ entries: [vital()] })
        .expect(403);
      await http().get(`/api/referrals/${referralId}/vitals`).set(as('other')).expect(404);

      const nurse = await connect('nurse');
      expect(await send(nurse, [vital({ spo2: 120 })])).toMatchObject({ ok: false, retry: false });
      expect(await send(nurse, [vital({ systolicBp: 60, diastolicBp: 90 })])).toMatchObject({
        ok: false,
      });
      const empty = { clientId: randomUUID(), recordedAt: new Date().toISOString() };
      expect(await send(nurse, [empty])).toMatchObject({ ok: false });
      const future = vital({ recordedAt: new Date(Date.now() + 3600_000).toISOString() });
      expect(await send(nurse, [future])).toMatchObject({
        ok: false,
        message: expect.stringMatching(/đồng hồ/),
      });
      await http()
        .post(`/api/referrals/${referralId}/vitals`)
        .set(as('nurse'))
        .send({ entries: [] })
        .expect(400);
    });

    it('phiếu đã huỷ không nhận thêm chỉ số', async (ctx) => {
      if (!dbReady) return ctx.skip();
      await http()
        .post(`/api/referrals/${referralId}/cancel`)
        .set(as('commune'))
        .send({ reason: 'Kết thúc test' })
        .expect(200);
      const nurse = await connect('nurse');
      expect(await send(nurse, [vital()])).toMatchObject({
        ok: false,
        retry: false,
        message: expect.stringMatching(/kết thúc/),
      });
    });
  });

  describe('phản hồi của tuyến trên (Task 4.4)', () => {
    interface Update {
      id: string;
      status: string;
      side: 'incoming' | 'outgoing';
      preparationNote: string | null;
      rejectionReason: string | null;
      by: string;
    }
    const newRecord = async (k: string) =>
      (
        await prisma.medicalRecord.create({
          data: {
            code: `E2E-${tag}-${k}`,
            patientId,
            doctorId: ids.users[0],
            facilityId: fac.station,
            encounterType: 'EMERGENCY',
            chiefComplaint: 'Chấn thương ngực',
          },
        })
      ).id;
    const send = async (sourceRecordId: string) =>
      (
        (
          await http()
            .post('/api/referrals')
            .set(as('commune'))
            .send(body({ sourceRecordId }))
            .expect(201)
        ).body as { referral: { id: string } }
      ).referral.id;

    it('xác nhận tiếp nhận & sẵn sàng ê-kíp → tuyến xã và người đi kèm nhận phản hồi ngay', async (ctx) => {
      if (!dbReady) return ctx.skip();
      const recId = await newRecord('A');
      await prisma.clinicalImage.create({
        data: {
          medicalRecordId: recId,
          type: 'XRAY',
          cloudinaryPublicId: `e2e/${tag}/chest`,
          secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/e2e/chest.jpg',
          uploadedById: ids.users[0],
        },
      });
      const id = await send(recId);

      // Bác sĩ trực xem đủ hồ sơ kèm ảnh cận lâm sàng (URL có chữ ký)
      const detail = (await http().get(`/api/referrals/${id}`).set(as('hospital')).expect(200))
        .body as {
        sourceImages: { type: string; thumbnailUrl: string }[];
      };
      expect(detail.sourceImages).toHaveLength(1);
      expect(detail.sourceImages[0]?.thumbnailUrl).toMatch(/sig=/);

      const commune = await connect('commune');
      const nurse = await connect('nurse');
      const hospital = await connect('hospital');
      const toCommune = next<Update>(commune, 'referral_updated');
      const toNurse = next<Update>(nurse, 'referral_updated');
      const toHospital = next<Update>(hospital, 'referral_updated');
      const note = 'Đã chuẩn bị phòng mổ số 2, dự trù 2 đơn vị máu O';
      const t0 = Date.now();
      const res = await http()
        .post(`/api/referrals/${id}/accept`)
        .set(as('hospital'))
        .send({ preparationNote: note })
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'ACCEPTED',
        preparationNote: note,
        acceptedBy: { name: 'BS. NV hospital' },
      });
      const ev = await toCommune;
      expect(Date.now() - t0).toBeLessThan(1000);
      expect(ev).toMatchObject({
        id,
        status: 'ACCEPTED',
        side: 'outgoing',
        preparationNote: note,
        by: 'BS. NV hospital',
      });
      expect(await toNurse).toMatchObject({ side: 'outgoing' });
      expect(await toHospital).toMatchObject({ side: 'incoming', status: 'ACCEPTED' });

      // Chỉ xác nhận một lần; đã tiếp nhận thì không từ chối được
      await http().post(`/api/referrals/${id}/accept`).set(as('hospital')).send({}).expect(409);
      await http()
        .post(`/api/referrals/${id}/reject`)
        .set(as('hospital'))
        .send({ reason: 'Hết giường hồi sức' })
        .expect(409);

      // Cập nhật ghi chú chuẩn bị
      const upd = next<Update>(commune, 'referral_updated');
      await http()
        .patch(`/api/referrals/${id}/preparation`)
        .set(as('hospital'))
        .send({ preparationNote: 'Đổi sang phòng mổ số 3' })
        .expect(200);
      expect(await upd).toMatchObject({ preparationNote: 'Đổi sang phòng mổ số 3' });
      await http()
        .patch(`/api/referrals/${id}/preparation`)
        .set(as('hospital'))
        .send({ preparationNote: '' })
        .expect(400);

      // Tuyến xã / bệnh viện khác không phản hồi thay được
      await http().post(`/api/referrals/${id}/accept`).set(as('commune')).send({}).expect(404);
      await http().post(`/api/referrals/${id}/accept`).set(as('central')).send({}).expect(404);
    });

    it('không thể tiếp nhận → tuyến xã nhận lý do và gửi lại cho bệnh viện khác', async (ctx) => {
      if (!dbReady) return ctx.skip();
      const recId = await newRecord('R');
      const id = await send(recId);
      const commune = await connect('commune');
      const ev = next<Update>(commune, 'referral_updated');
      await http()
        .post(`/api/referrals/${id}/reject`)
        .set(as('hospital'))
        .send({ reason: 'x' })
        .expect(400);
      const res = await http()
        .post(`/api/referrals/${id}/reject`)
        .set(as('hospital'))
        .send({ reason: 'Hết giường hồi sức, máy thở đang dùng hết' })
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'REJECTED',
        rejectionReason: expect.stringMatching(/Hết giường/),
      });
      expect(await ev).toMatchObject({
        status: 'REJECTED',
        side: 'outgoing',
        rejectionReason: expect.stringMatching(/máy thở/),
      });
      await http().post(`/api/referrals/${id}/accept`).set(as('hospital')).send({}).expect(409);
      // Phiếu bị từ chối không còn "đang thực hiện" → được lập lệnh mới tới bệnh viện khác
      await http()
        .post('/api/referrals')
        .set(as('commune'))
        .send(body({ sourceRecordId: recId, toFacilityId: fac.central }))
        .expect(201);
    });
  });
});
