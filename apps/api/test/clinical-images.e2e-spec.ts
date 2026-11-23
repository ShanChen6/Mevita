/**
 * Ảnh cận lâm sàng (Task 3.3) qua kho GIẢ LẬP Cloudinary:
 * vé upload có chữ ký → trình duyệt tải thẳng lên kho → API xác minh & gắn vào hồ sơ → xem qua URL có chữ ký.
 */
import { rm } from 'node:fs/promises';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const PASSWORD = 'TestPass123';
const tag = `ci${Date.now().toString(36)}`;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]),
  Buffer.from('IHDR'),
  Buffer.from([0, 0, 1, 0, 0, 0, 0, 200]),
  Buffer.alloc(64),
]);

interface Ticket {
  mode: string;
  uploadUrl: string;
  fields: Record<string, string>;
  publicId: string;
}
interface Image {
  id: string;
  type: string;
  secureUrl: string;
  thumbnailUrl: string;
}

describe('Ảnh cận lâm sàng (e2e, kho giả lập)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let dbReady = false;
  const ids = { users: [] as string[], patients: [] as string[], facilities: [] as string[] };
  const tok = {} as Record<'doctor' | 'other' | 'patient', string>;
  let recordId = '';
  let otherRecordId = '';

  const http = () => request(app.getHttpServer());
  const as = (who: keyof typeof tok) => ({ Authorization: `Bearer ${tok[who]}` });
  /** Chuyển URL tuyệt đối của API thành đường dẫn cho supertest */
  const pathOf = (url: string) => {
    const u = new URL(url);
    return `/api${u.pathname.replace(/^\/api/, '')}${u.search}`;
  };
  const ticket = async (rid = recordId) =>
    (
      await http()
        .post(`/api/medical-records/${rid}/images/upload-ticket`)
        .set(as('doctor'))
        .send({ type: 'XRAY' })
        .expect(200)
    ).body as Ticket;
  const upload = (t: Ticket, file: Buffer, name = 'xquang.png') => {
    let req = http().post(pathOf(t.uploadUrl));
    for (const [k, v] of Object.entries(t.fields)) req = req.field(k, v);
    return req.attach('file', file, name);
  };
  const confirm = (
    body: Record<string, unknown>,
    rid = recordId,
    who: keyof typeof tok = 'doctor',
  ) => http().post(`/api/medical-records/${rid}/images`).set(as(who)).send(body);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    dbReady = (await prisma.isHealthy()) && (await prisma.commune.count()) > 0;
    if (!dbReady) return console.warn('⚠️  Bỏ qua e2e ảnh: DB chưa sẵn sàng.');

    const [fx, fy] = await Promise.all(
      ['X', 'Y'].map((k) =>
        prisma.healthFacility.create({
          data: {
            code: `E2E-${k}-${tag}`,
            name: `Trạm ${k}`,
            type: 'COMMUNE_HEALTH_STATION',
            level: 'PRIMARY',
            communeCode: '02761',
          },
        }),
      ),
    );
    ids.facilities.push(fx.id, fy.id);
    const passwordHash = await hashPassword(PASSWORD);
    const staff = (k: string, facilityId: string) =>
      prisma.user.create({
        data: {
          email: `${k}-${tag}@e2e.test`,
          passwordHash,
          fullName: k,
          role: 'COMMUNE_STAFF',
          staffProfile: { create: { facilityId, position: 'DOCTOR' } },
        },
      });
    const [doctor, other] = await Promise.all([staff('doctor', fx.id), staff('other', fy.id)]);
    const pu = await prisma.user.create({
      data: {
        email: `pt-${tag}@e2e.test`,
        passwordHash,
        fullName: 'BN',
        role: 'PATIENT',
        patient: {
          create: { fullName: 'BN ảnh', dateOfBirth: new Date('1980-01-01'), gender: 'MALE' },
        },
      },
      include: { patient: true },
    });
    ids.users.push(doctor.id, other.id, pu.id);
    ids.patients.push(pu.patient!.id);
    const mk = (code: string) =>
      prisma.medicalRecord.create({
        data: {
          code,
          patientId: pu.patient!.id,
          doctorId: doctor.id,
          facilityId: fx.id,
          chiefComplaint: 'Chấn thương',
        },
      });
    recordId = (await mk(`E2E-${tag}-1`)).id;
    otherRecordId = (await mk(`E2E-${tag}-2`)).id;

    const login = async (email: string) =>
      (
        (
          await http()
            .post('/api/auth/login')
            .send({ identifier: email, password: PASSWORD })
            .expect(200)
        ).body as { accessToken: string }
      ).accessToken;
    tok.doctor = await login(`doctor-${tag}@e2e.test`);
    tok.other = await login(`other-${tag}@e2e.test`);
    tok.patient = await login(`pt-${tag}@e2e.test`);
  });

  afterAll(async () => {
    if (dbReady) {
      await prisma.auditLog.deleteMany({ where: { userId: { in: ids.users } } });
      await prisma.medicalRecord.deleteMany({ where: { patientId: { in: ids.patients } } });
      await prisma.patient.deleteMany({ where: { id: { in: ids.patients } } });
      await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
      await prisma.healthFacility.deleteMany({ where: { id: { in: ids.facilities } } });
    }
    await app.close();
    await rm('.uploads-test', { recursive: true, force: true });
  });

  it('luồng đầy đủ: vé → upload → xác nhận → xem ảnh gốc & thu nhỏ qua URL có chữ ký → xoá', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const t = await ticket();
    expect(t.mode).toBe('mock');
    expect(t.publicId.startsWith(`mevita/records/${recordId}/`)).toBe(true);
    expect(JSON.stringify(t)).not.toMatch(/secret/i);

    const up = await upload(t, png).expect(201);
    expect(up.body).toMatchObject({
      public_id: t.publicId,
      format: 'png',
      width: 256,
      height: 200,
    });

    const img = (
      await confirm({
        publicId: t.publicId,
        type: 'XRAY',
        description: 'X-quang ngực thẳng',
      }).expect(201)
    ).body as Image;
    expect(img).toMatchObject({ type: 'XRAY', description: 'X-quang ngực thẳng' });

    const full = await http().get(pathOf(img.secureUrl)).expect(200);
    expect(full.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(full.body as Buffer, png)).toBe(0);
    await http().get(pathOf(img.thumbnailUrl)).expect(200);
    // Đoán URL (sai chữ ký) không xem được ảnh
    await http()
      .get(pathOf(img.secureUrl).replace(/sig=[^&]+/, 'sig=' + 'A'.repeat(32)))
      .expect(404);

    const record = (
      await http().get(`/api/medical-records/${recordId}`).set(as('doctor')).expect(200)
    ).body as { clinicalImages: Image[] };
    expect(record.clinicalImages.map((i) => i.id)).toEqual([img.id]);

    await http()
      .delete(`/api/medical-records/${recordId}/images/${img.id}`)
      .set(as('doctor'))
      .expect(204);
    await http().get(pathOf(img.secureUrl)).expect(404);
  });

  it('chặn gắn ảnh không hợp lệ: thư mục hồ sơ khác, chưa upload, gắn hai lần', async (ctx) => {
    if (!dbReady) return ctx.skip();
    // Ảnh tải lên cho hồ sơ 2 không gắn được vào hồ sơ 1
    const t2 = await ticket(otherRecordId);
    await upload(t2, png).expect(201);
    await confirm({ publicId: t2.publicId, type: 'XRAY' }).expect(400);

    // Tự khai publicId đúng thư mục nhưng chưa upload
    await confirm({ publicId: `mevita/records/${recordId}/khong-co-that`, type: 'XRAY' }).expect(
      400,
    );

    const t = await ticket();
    await upload(t, png).expect(201);
    await confirm({ publicId: t.publicId, type: 'LAB_RESULT' }).expect(201);
    await confirm({ publicId: t.publicId, type: 'LAB_RESULT' }).expect(409);
  });

  it('upload bị kho từ chối: sửa tham số đã ký, file không phải ảnh', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const t = await ticket();
    await upload(
      { ...t, fields: { ...t.fields, public_id: `mevita/records/${otherRecordId}/x` } },
      png,
    ).expect(401);
    await upload(t, Buffer.from('%PDF-1.7 đổi đuôi thành ảnh'), 'gia.png').expect(400);
  });

  it('phân quyền: cơ sở khác không xin được vé; hồ sơ đã ký thì không thêm/xoá ảnh; bệnh nhân thấy ảnh trong lịch sử', async (ctx) => {
    if (!dbReady) return ctx.skip();
    await http()
      .post(`/api/medical-records/${recordId}/images/upload-ticket`)
      .set(as('other'))
      .send({ type: 'XRAY' })
      .expect(404);
    await confirm(
      { publicId: `mevita/records/${recordId}/x`, type: 'XRAY' },
      recordId,
      'other',
    ).expect(404);
    await http()
      .post(`/api/medical-records/${recordId}/images/upload-ticket`)
      .set(as('patient'))
      .send({ type: 'XRAY' })
      .expect(403);

    // Ký hồ sơ (trực tiếp trong DB cho gọn) rồi thử thêm/xoá ảnh
    await prisma.medicalRecord.update({
      where: { id: recordId },
      data: { status: 'FINALIZED', signedAt: new Date(), signatureHash: 'a'.repeat(64) },
    });
    await http()
      .post(`/api/medical-records/${recordId}/images/upload-ticket`)
      .set(as('doctor'))
      .send({ type: 'XRAY' })
      .expect(409);
    const existing = await prisma.clinicalImage.findFirstOrThrow({
      where: { medicalRecordId: recordId },
    });
    await http()
      .delete(`/api/medical-records/${recordId}/images/${existing.id}`)
      .set(as('doctor'))
      .expect(409);

    const history = (await http().get('/api/patients/me/records').set(as('patient')).expect(200))
      .body as {
      items: { id: string; clinicalImages: Image[] }[];
    };
    const imgs = history.items.find((r) => r.id === recordId)!.clinicalImages;
    expect(imgs).toHaveLength(1);
    await http().get(pathOf(imgs[0].thumbnailUrl)).expect(200);
  });
});
