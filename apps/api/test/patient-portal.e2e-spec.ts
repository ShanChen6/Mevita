/**
 * Cổng bệnh nhân (Task 2.2): hồ sơ sức khoẻ và lịch sử khám.
 * Dữ liệu riêng cho test, dọn sạch sau khi chạy.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const PASSWORD = 'TestPass123';
const tag = `pp${Date.now().toString(36)}`;
const digits = (n: number) => (Date.now().toString() + Math.random().toString().slice(2)).slice(-n);

interface RecordItem {
  id: string;
  code: string;
  chiefComplaint: string;
  doctor: { fullName: string; academicTitle: string | null };
  specialty: { name: string } | null;
  facility: { name: string; address: string };
  diagnoses: { icdCode: string; name: string; isPrimary: boolean }[];
  prescriptionItems: { drugName: string }[];
  clinicalImages: { secureUrl: string; thumbnailUrl: string }[];
}

describe('Cổng bệnh nhân (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let dbReady = false;
  const ids = { users: [] as string[], patients: [] as string[], facilities: [] as string[] };
  let patientId = '';
  let otherPatientId = '';
  let patientToken = '';
  let staffToken = '';
  let outsiderToken = '';

  const http = () => request(app.getHttpServer());
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
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

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    dbReady = (await prisma.isHealthy()) && (await prisma.specialty.count()) > 0;
    if (!dbReady)
      return console.warn('⚠️  Bỏ qua e2e cổng bệnh nhân: DB chưa sẵn sàng hoặc chưa seed.');

    const passwordHash = await hashPassword(PASSWORD);
    const [station, other] = await Promise.all(
      ['S', 'O'].map((k) =>
        prisma.healthFacility.create({
          data: {
            code: `E2E-${k}-${tag}`,
            name: `Trạm ${k} ${tag}`,
            type: 'COMMUNE_HEALTH_STATION',
            level: 'PRIMARY',
            communeCode: '02761',
          },
        }),
      ),
    );
    ids.facilities.push(station.id, other.id);

    const doctor = await prisma.user.create({
      data: {
        email: `doc-${tag}@e2e.test`,
        passwordHash,
        fullName: 'Nguyễn Văn Khám',
        role: 'COMMUNE_STAFF',
        staffProfile: {
          create: { facilityId: station.id, position: 'DOCTOR', academicTitle: 'BS' },
        },
      },
    });
    const outsider = await prisma.user.create({
      data: {
        email: `out-${tag}@e2e.test`,
        passwordHash,
        fullName: 'Ngoài',
        role: 'COMMUNE_STAFF',
        staffProfile: { create: { facilityId: other.id, position: 'DOCTOR' } },
      },
    });
    const patientUser = await prisma.user.create({
      data: {
        email: `pt-${tag}@e2e.test`,
        passwordHash,
        fullName: 'Bệnh Nhân Test',
        role: 'PATIENT',
        patient: {
          create: {
            fullName: 'Bệnh Nhân Test',
            dateOfBirth: new Date('1990-01-01'),
            gender: 'MALE',
            communeCode: '02761',
          },
        },
      },
      include: { patient: true },
    });
    const otherPatient = await prisma.patient.create({
      data: {
        fullName: 'Khác',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'FEMALE',
        nationalId: digits(12),
      },
    });
    ids.users.push(doctor.id, outsider.id, patientUser.id);
    patientId = patientUser.patient!.id;
    otherPatientId = otherPatient.id;
    ids.patients.push(patientId, otherPatientId);

    await prisma.icd10Code.upsert({
      where: { code: 'I10' },
      create: { code: 'I10', nameVi: 'Tăng huyết áp vô căn' },
      update: {},
    });
    const cardiology = await prisma.specialty.findUniqueOrThrow({ where: { code: 'CARDIOLOGY' } });
    const mk = (i: number, finalized: boolean) =>
      prisma.medicalRecord.create({
        data: {
          code: `E2E-${tag}-${i}`,
          patientId,
          doctorId: doctor.id,
          facilityId: station.id,
          specialtyId: cardiology.id,
          visitAt: new Date(Date.UTC(2026, 0, i + 1)),
          chiefComplaint: `Lần khám ${i}`,
          status: finalized ? 'FINALIZED' : 'DRAFT',
          signedAt: finalized ? new Date() : null,
          signatureHash: finalized ? 'a'.repeat(64) : null,
          diagnoses: { create: { icdCode: 'I10', isPrimary: true } },
          prescriptionItems: {
            create: { drugName: `Thuốc ${i}`, quantity: 1, unit: 'viên', instructions: 'Uống' },
          },
          ...(i === 2 && {
            clinicalImages: {
              create: {
                type: 'XRAY',
                cloudinaryPublicId: `e2e/${tag}/xray`,
                secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/e2e/xray.jpg',
                uploadedById: doctor.id,
              },
            },
          }),
        },
      });
    for (let i = 1; i <= 3; i++) await mk(i, true);
    await mk(4, false); // nháp — không hiện trong lịch sử

    patientToken = await login(patientUser.email!);
    staffToken = await login(doctor.email!);
    outsiderToken = await login(outsider.email!);
  });

  afterAll(async () => {
    if (dbReady) {
      await prisma.auditLog.deleteMany({
        where: { OR: [{ userId: { in: ids.users } }, { entityId: { in: ids.patients } }] },
      });
      await prisma.medicalRecord.deleteMany({ where: { patientId: { in: ids.patients } } });
      await prisma.patient.deleteMany({ where: { id: { in: ids.patients } } });
      await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
      await prisma.healthFacility.deleteMany({ where: { id: { in: ids.facilities } } });
    }
    await app.close();
  });

  it('GET /patients/me trả hồ sơ kèm địa chỉ xã/tỉnh', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const res = await http().get('/api/patients/me').set(bearer(patientToken)).expect(200);
    expect(res.body).toMatchObject({
      id: patientId,
      commune: { code: '02761', province: { code: '15', name: 'Lào Cai' } },
    });
  });

  it('PATCH /patients/me cập nhật hồ sơ, xoá trường rỗng và đồng bộ tên tài khoản', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const nationalId = digits(12);
    const res = await http()
      .patch('/api/patients/me')
      .set(bearer(patientToken))
      .send({
        fullName: 'Bệnh Nhân Đã Sửa',
        nationalId,
        healthInsuranceNumber: 'dn 4010090009999',
        bloodType: 'O_POSITIVE',
        allergies: 'Penicillin',
        communeCode: '02647',
        addressDetail: 'Số 1',
        emergencyContactPhone: '+84 987 654 321',
      })
      .expect(200);
    expect(res.body).toMatchObject({
      fullName: 'Bệnh Nhân Đã Sửa',
      nationalId,
      healthInsuranceNumber: 'DN4010090009999',
      bloodType: 'O_POSITIVE',
      emergencyContactPhone: '0987654321',
      commune: { code: '02647' },
    });
    const me = await http().get('/api/auth/me').set(bearer(patientToken)).expect(200);
    expect((me.body as { fullName: string }).fullName).toBe('Bệnh Nhân Đã Sửa');

    const cleared = await http()
      .patch('/api/patients/me')
      .set(bearer(patientToken))
      .send({ allergies: '' })
      .expect(200);
    expect((cleared.body as { allergies: string | null }).allergies).toBeNull();
  });

  it('PATCH /patients/me từ chối xã không tồn tại, CCCD trùng và dữ liệu sai', async (ctx) => {
    if (!dbReady) return ctx.skip();
    await http()
      .patch('/api/patients/me')
      .set(bearer(patientToken))
      .send({ communeCode: '99999' })
      .expect(400);
    const other = await prisma.patient.findUniqueOrThrow({ where: { id: otherPatientId } });
    const dup = await http()
      .patch('/api/patients/me')
      .set(bearer(patientToken))
      .send({ nationalId: other.nationalId })
      .expect(409);
    expect((dup.body as { message: string }).message).toMatch(/CCCD/);
    await http()
      .patch('/api/patients/me')
      .set(bearer(patientToken))
      .send({ bloodType: 'Z' })
      .expect(400);
  });

  it('nhân viên y tế không dùng được /patients/me', async (ctx) => {
    if (!dbReady) return ctx.skip();
    await http()
      .patch('/api/patients/me')
      .set(bearer(staffToken))
      .send({ allergies: 'x' })
      .expect(403);
  });

  it('lịch sử khám: chỉ hồ sơ đã ký, mới nhất trước, đủ thông tin bác sĩ/chuyên khoa/chẩn đoán/thuốc/ảnh', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const res = await http().get('/api/patients/me/records').set(bearer(patientToken)).expect(200);
    const { items, nextCursor } = res.body as { items: RecordItem[]; nextCursor: string | null };
    expect(items.map((r) => r.chiefComplaint)).toEqual(['Lần khám 3', 'Lần khám 2', 'Lần khám 1']);
    expect(nextCursor).toBeNull();
    expect(items[0]).toMatchObject({
      doctor: { fullName: 'Nguyễn Văn Khám', academicTitle: 'BS' },
      specialty: { name: 'Tim mạch' },
      facility: { address: 'Xã Mường Khương, Tỉnh Lào Cai' },
      diagnoses: [
        { icdCode: 'I10', name: expect.stringMatching(/tăng huyết áp/i), isPrimary: true },
      ],
      prescriptionItems: [{ drugName: 'Thuốc 3' }],
    });
    expect(items[1].clinicalImages[0].thumbnailUrl).toContain(
      '/upload/c_fill,w_240,h_240,q_auto,f_auto/',
    );
  });

  it('lịch sử khám phân trang theo con trỏ', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const page1 = (
      await http().get('/api/patients/me/records?limit=2').set(bearer(patientToken)).expect(200)
    ).body as { items: RecordItem[]; nextCursor: string };
    expect(page1.items).toHaveLength(2);
    const page2 = (
      await http()
        .get(`/api/patients/me/records?limit=2&cursor=${page1.nextCursor}`)
        .set(bearer(patientToken))
        .expect(200)
    ).body as { items: RecordItem[]; nextCursor: string | null };
    expect(page2.items.map((r) => r.chiefComplaint)).toEqual(['Lần khám 1']);
    expect(page2.nextCursor).toBeNull();
  });

  it('bác sĩ có liên hệ xem được lịch sử; bác sĩ cơ sở khác bị chặn', async (ctx) => {
    if (!dbReady) return ctx.skip();
    await http().get(`/api/patients/${patientId}/records`).set(bearer(staffToken)).expect(200);
    await http().get(`/api/patients/${patientId}/records`).set(bearer(outsiderToken)).expect(403);
    await http()
      .get(`/api/patients/${otherPatientId}/records`)
      .set(bearer(patientToken))
      .expect(403);
  });
});
