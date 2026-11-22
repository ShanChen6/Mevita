/**
 * Khám lâm sàng & ký hồ sơ (Task 3.2): ICD-10, lưu nháp, ký xác nhận, toàn vẹn hồ sơ.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const PASSWORD = 'TestPass123';
const tag = `mr${Date.now().toString(36)}`;

interface RecordDto {
  id: string;
  status: string;
  doctor: { id: string; fullName: string };
  pulse: number | null;
  diagnoses: { icdCode: string; name: string; isPrimary: boolean }[];
  prescriptionItems: { drugName: string }[];
}

describe('Khám lâm sàng & ký hồ sơ (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let dbReady = false;
  const ids = { users: [] as string[], patients: [] as string[], facilities: [] as string[] };
  const tok = {} as Record<'doctor' | 'doctor2' | 'nurse' | 'other' | 'patient', string>;
  const userId = {} as Record<'doctor' | 'doctor2', string>;
  let patientId = '';
  let specialtyId = '';

  const http = () => request(app.getHttpServer());
  const as = (who: keyof typeof tok) => ({ Authorization: `Bearer ${tok[who]}` });
  /** Mở phiếu khám — mặc định cho một bệnh nhân mới (mỗi bệnh nhân chỉ có 1 phiếu nháp/cơ sở) */
  const open = async (complaint = 'Đau đầu', forPatient?: string) => {
    let pid = forPatient;
    if (!pid) {
      const p = await prisma.patient.create({
        data: { fullName: `BN phụ ${tag}`, dateOfBirth: new Date('1985-01-01'), gender: 'FEMALE' },
      });
      ids.patients.push(p.id);
      pid = p.id;
    }
    return (
      await http()
        .post('/api/encounters')
        .set(as('nurse'))
        .send({ patientId: pid, chiefComplaint: complaint })
        .expect(201)
    ).body as { id: string };
  };

  const filled = {
    specialtyId: '',
    pulse: 88,
    temperature: 36.8,
    systolicBp: 150,
    diastolicBp: 95,
    respiratoryRate: 18,
    spo2: 98,
    symptoms: 'Đau đầu vùng chẩm buổi sáng',
    diagnoses: [
      { icdCode: 'i10', isPrimary: true },
      { icdCode: 'R51', isPrimary: false },
    ],
    prescriptionItems: [
      {
        drugName: 'Amlodipin',
        strength: '5mg',
        quantity: 30,
        unit: 'viên',
        instructions: 'Uống 1 viên mỗi sáng',
        durationDays: 30,
      },
    ],
    treatmentPlan: 'Ăn nhạt, tái khám sau 1 tháng',
    followUpDate: '2027-01-05',
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    dbReady =
      (await prisma.isHealthy()) &&
      (await prisma.icd10Code.count({ where: { code: { in: ['I10', 'R51', 'S06.5'] } } })) === 3;
    if (!dbReady)
      return console.warn('⚠️  Bỏ qua e2e khám bệnh: DB chưa sẵn sàng hoặc chưa seed ICD-10.');

    specialtyId = (
      await prisma.specialty.findUniqueOrThrow({ where: { code: 'GENERAL_INTERNAL' } })
    ).id;
    filled.specialtyId = specialtyId;
    const [fx, fy] = await Promise.all(
      ['X', 'Y'].map((k) =>
        prisma.healthFacility.create({
          data: {
            code: `E2E-${k}-${tag}`,
            name: `Trạm ${k} ${tag}`,
            type: 'COMMUNE_HEALTH_STATION',
            level: 'PRIMARY',
            communeCode: '02761',
            specialties: { create: { specialtyId } },
          },
        }),
      ),
    );
    ids.facilities.push(fx.id, fy.id);
    const passwordHash = await hashPassword(PASSWORD);
    const staff = (k: string, facilityId: string, position: 'DOCTOR' | 'NURSE') =>
      prisma.user.create({
        data: {
          email: `${k}-${tag}@e2e.test`,
          passwordHash,
          fullName: `NV ${k}`,
          role: 'COMMUNE_STAFF',
          staffProfile: {
            create: { facilityId, position, academicTitle: position === 'DOCTOR' ? 'BS' : 'ĐD' },
          },
        },
      });
    const [doctor, doctor2, nurse, other] = await Promise.all([
      staff('doctor', fx.id, 'DOCTOR'),
      staff('doctor2', fx.id, 'DOCTOR'),
      staff('nurse', fx.id, 'NURSE'),
      staff('other', fy.id, 'DOCTOR'),
    ]);
    userId.doctor = doctor.id;
    userId.doctor2 = doctor2.id;
    const pu = await prisma.user.create({
      data: {
        email: `pt-${tag}@e2e.test`,
        passwordHash,
        fullName: 'BN',
        role: 'PATIENT',
        patient: {
          create: { fullName: `BN ${tag}`, dateOfBirth: new Date('1970-01-01'), gender: 'MALE' },
        },
      },
      include: { patient: true },
    });
    ids.users.push(doctor.id, doctor2.id, nurse.id, other.id, pu.id);
    patientId = pu.patient!.id;
    ids.patients.push(patientId);

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
    for (const k of ['doctor', 'doctor2', 'nurse', 'other'] as const)
      tok[k] = await login(`${k}-${tag}@e2e.test`);
    tok.patient = await login(`pt-${tag}@e2e.test`);
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

  it('tra cứu ICD-10 theo mã, tên có dấu và không dấu', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const search = async (q: string) =>
      (
        (await http().get('/api/icd10').query({ q }).set(as('doctor')).expect(200)).body as {
          code: string;
        }[]
      ).map((r) => r.code);
    expect(await search('tang huyet ap')).toContain('I10');
    expect(await search('Tăng huyết áp')).toContain('I10');
    expect((await search('s06'))[0]).toMatch(/^S06/);
    expect(await search('xuất huyết dưới màng cứng')).toContain('S06.5');
    expect(await search('subdural')).toContain('S06.5');
    // Khớp nguyên cụm được ưu tiên: "dau dau" phải ra R51 (Đau đầu) trước Thuỷ đậu, Đau thắt ngực…
    expect((await search('dau dau')).slice(0, 2)).toContain('R51');
  });

  it('lưu nháp: sinh tồn, chẩn đoán, đơn thuốc; gửi lại danh sách thì thay thế', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { id } = await open();
    const saved = (
      await http().patch(`/api/medical-records/${id}`).set(as('nurse')).send(filled).expect(200)
    ).body as RecordDto;
    expect(saved).toMatchObject({
      status: 'DRAFT',
      pulse: 88,
      prescriptionItems: [{ drugName: 'Amlodipin' }],
    });
    expect(saved.diagnoses.map((d) => [d.icdCode, d.isPrimary])).toEqual([
      ['I10', true],
      ['R51', false],
    ]);

    const replaced = (
      await http()
        .patch(`/api/medical-records/${id}`)
        .set(as('nurse'))
        .send({ diagnoses: [{ icdCode: 'I10', isPrimary: true }], prescriptionItems: [] })
        .expect(200)
    ).body as RecordDto;
    expect(replaced.diagnoses).toHaveLength(1);
    expect(replaced.prescriptionItems).toHaveLength(0);
    expect(replaced.pulse).toBe(88); // trường không gửi lên giữ nguyên

    await http()
      .patch(`/api/medical-records/${id}`)
      .set(as('nurse'))
      .send({ diagnoses: [{ icdCode: 'Z99.9' }] })
      .expect(400);
    await http()
      .patch(`/api/medical-records/${id}`)
      .set(as('nurse'))
      .send({ spo2: 120 })
      .expect(400);
    await http().get(`/api/medical-records/${id}`).set(as('other')).expect(404);
    await http()
      .patch(`/api/medical-records/${id}`)
      .set(as('other'))
      .send({ pulse: 90 })
      .expect(404);
  });

  it('ký: điều dưỡng không ký được, sai mật khẩu bị từ chối, thiếu chẩn đoán bị từ chối', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { id } = await open('Ho');
    await http()
      .post(`/api/medical-records/${id}/sign`)
      .set(as('nurse'))
      .send({ password: PASSWORD })
      .expect(403);
    await http()
      .post(`/api/medical-records/${id}/sign`)
      .set(as('doctor'))
      .send({ password: 'SaiMatKhau1' })
      .expect(401);
    const res = await http()
      .post(`/api/medical-records/${id}/sign`)
      .set(as('doctor'))
      .send({ password: PASSWORD })
      .expect(400);
    expect((res.body as { message: string }).message).toMatch(/chẩn đoán/);
  });

  it('ký thành công: ghi bác sĩ ký vào hồ sơ, khoá hồ sơ, kiểm tra toàn vẹn, bệnh nhân thấy trong lịch sử', async (ctx) => {
    if (!dbReady) return ctx.skip();
    // Phiếu do điều dưỡng mở (doctorId = điều dưỡng), bác sĩ 2 khám & ký
    const { id } = await open('Khám tăng huyết áp', patientId);
    await http().patch(`/api/medical-records/${id}`).set(as('doctor2')).send(filled).expect(200);
    const signed = (
      await http()
        .post(`/api/medical-records/${id}/sign`)
        .set(as('doctor2'))
        .send({ password: PASSWORD })
        .expect(200)
    ).body as RecordDto;
    expect(signed).toMatchObject({ status: 'FINALIZED', doctor: { id: userId.doctor2 } });

    await http()
      .patch(`/api/medical-records/${id}`)
      .set(as('doctor2'))
      .send({ pulse: 90 })
      .expect(409);
    await http()
      .post(`/api/medical-records/${id}/sign`)
      .set(as('doctor2'))
      .send({ password: PASSWORD })
      .expect(409);
    expect(
      (await http().get(`/api/medical-records/${id}/verify`).set(as('doctor')).expect(200)).body,
    ).toMatchObject({
      signed: true,
      valid: true,
    });

    // Sửa trực tiếp trong DB sau khi ký → phát hiện được
    await prisma.medicalRecord.update({ where: { id }, data: { pulse: 60 } });
    expect(
      (await http().get(`/api/medical-records/${id}/verify`).set(as('doctor')).expect(200)).body,
    ).toMatchObject({
      valid: false,
    });
    await prisma.medicalRecord.update({ where: { id }, data: { pulse: 88 } });

    const history = (await http().get('/api/patients/me/records').set(as('patient')).expect(200))
      .body as {
      items: { id: string; doctor: { fullName: string } }[];
    };
    expect(history.items.find((r) => r.id === id)?.doctor.fullName).toBe('NV doctor2');
    // Cơ sở khác (không liên hệ) không xem được kể cả khi đã ký
    await http().get(`/api/medical-records/${id}`).set(as('other')).expect(404);
  });

  it('khám từ lịch hẹn: ký xong lịch hẹn chuyển "Đã khám"; hàng đợi ưu tiên cấp cứu', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const facilityId = ids.facilities[0];
    const start = new Date(Date.now() + 2 * 3_600_000);
    const appt = await prisma.appointment.create({
      data: {
        code: `LH${tag.slice(-6).toUpperCase()}`,
        patientId,
        facilityId,
        specialtyId,
        startAt: start,
        endAt: new Date(start.getTime() + 900_000),
        reason: 'Tái khám',
      },
    });
    const checked = (
      await http().post(`/api/appointments/${appt.id}/check-in`).set(as('nurse')).expect(200)
    ).body as {
      medicalRecord: { id: string };
    };
    const recordId = checked.medicalRecord.id;

    // Thêm một ca cấp cứu cho bệnh nhân khác → lên đầu hàng đợi
    const other = await prisma.patient.create({
      data: { fullName: `CC ${tag}`, dateOfBirth: new Date('2000-01-01'), gender: 'FEMALE' },
    });
    ids.patients.push(other.id);
    await http()
      .post('/api/encounters')
      .set(as('nurse'))
      .send({ patientId: other.id, chiefComplaint: 'Khó thở', encounterType: 'EMERGENCY' })
      .expect(201);
    const queue = (await http().get('/api/medical-records/open').set(as('doctor')).expect(200))
      .body as {
      encounterType: string;
      patient: { id: string };
    }[];
    expect(queue[0]).toMatchObject({ encounterType: 'EMERGENCY', patient: { id: other.id } });

    await http()
      .patch(`/api/medical-records/${recordId}`)
      .set(as('doctor'))
      .send(filled)
      .expect(200);
    await http()
      .post(`/api/medical-records/${recordId}/sign`)
      .set(as('doctor'))
      .send({ password: PASSWORD })
      .expect(200);
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).status).toBe(
      'COMPLETED',
    );
  });
});
