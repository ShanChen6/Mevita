/**
 * Tra cứu nhanh bệnh nhân & tiếp nhận khám trực tiếp (Task 3.1).
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/auth/password.js';
import { addMinutes, vnDateOf, vnStartOfDay } from '../src/common/vn-time.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const PASSWORD = 'TestPass123';
const tag = `lk${Date.now().toString(36)}`;
const digits = (n: number) => (Date.now().toString() + Math.random().toString().slice(2)).slice(-n);

interface Found {
  id: string;
  fullName: string;
  allergies: string | null;
  hasAccount: boolean;
  totalVisits: number;
  recentVisits: {
    facility: { name: string };
    atThisFacility: boolean;
    diagnoses: { icdCode: string }[];
  }[];
  todayAppointment: { code: string } | null;
  openEncounter: { code: string } | null;
}

describe('Tra cứu bệnh nhân & tiếp nhận (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let dbReady = false;
  const ids = { users: [] as string[], patients: [] as string[], facilities: [] as string[] };
  const tok = {} as Record<'x' | 'y' | 'patient', string>;
  const p = { nationalId: digits(12), bhyt: `DN4${digits(12)}`, phone: `09${digits(8)}` };
  let patientId = '';
  let unlinkedId = '';
  let apptCode = '';

  const http = () => request(app.getHttpServer());
  const as = (who: keyof typeof tok) => ({ Authorization: `Bearer ${tok[who]}` });
  const lookup = async (who: keyof typeof tok, q: string) =>
    (await http().get('/api/patients/lookup').query({ q }).set(as(who)).expect(200)).body as {
      kind: string;
      patients: Found[];
    };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    dbReady = (await prisma.isHealthy()) && (await prisma.specialty.count()) > 0;
    if (!dbReady) return console.warn('⚠️  Bỏ qua e2e tra cứu: DB chưa sẵn sàng hoặc chưa seed.');

    const spec = await prisma.specialty.findUniqueOrThrow({ where: { code: 'GENERAL_INTERNAL' } });
    const [fx, fy] = await Promise.all(
      ['X', 'Y'].map((k) =>
        prisma.healthFacility.create({
          data: {
            code: `E2E-${k}-${tag}`,
            name: `Cơ sở ${k} ${tag}`,
            type: 'COMMUNE_HEALTH_STATION',
            level: 'PRIMARY',
            communeCode: '02761',
            specialties: { create: { specialtyId: spec.id } },
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
          fullName: `BS ${k}`,
          role: 'COMMUNE_STAFF',
          staffProfile: { create: { facilityId, position: 'DOCTOR' } },
        },
      });
    const [sx, sy] = await Promise.all([staff('x', fx.id), staff('y', fy.id)]);
    const patientUser = await prisma.user.create({
      data: {
        email: `pt-${tag}@e2e.test`,
        passwordHash,
        fullName: 'Tra Cứu Một',
        role: 'PATIENT',
        patient: {
          create: {
            fullName: `Tra Cứu Một ${tag}`,
            dateOfBirth: new Date('1980-02-03'),
            gender: 'MALE',
            nationalId: p.nationalId,
            healthInsuranceNumber: p.bhyt,
            phone: p.phone,
            allergies: 'Penicillin',
          },
        },
      },
      include: { patient: true },
    });
    ids.users.push(sx.id, sy.id, patientUser.id);
    patientId = patientUser.patient!.id;
    const unlinked = await prisma.patient.create({
      data: {
        fullName: `Tra Cứu Hai ${tag}`,
        dateOfBirth: new Date('1990-01-01'),
        gender: 'FEMALE',
        nationalId: digits(12),
      },
    });
    unlinkedId = unlinked.id;
    ids.patients.push(patientId, unlinkedId);

    // Lần khám đã ký tại cơ sở Y, lịch hẹn hôm nay tại cơ sở X
    await prisma.icd10Code.upsert({
      where: { code: 'I10' },
      create: { code: 'I10', nameVi: 'Tăng huyết áp' },
      update: {},
    });
    await prisma.medicalRecord.create({
      data: {
        code: `E2E-${tag}`,
        patientId,
        doctorId: sy.id,
        facilityId: fy.id,
        chiefComplaint: 'Đau đầu',
        status: 'FINALIZED',
        signedAt: new Date(),
        signatureHash: 'a'.repeat(64),
        diagnoses: { create: { icdCode: 'I10', isPrimary: true } },
      },
    });
    const start = addMinutes(vnStartOfDay(vnDateOf(new Date())), 23 * 60 + 30);
    const appt = await prisma.appointment.create({
      data: {
        code: `LH${digits(6)}`,
        patientId,
        facilityId: fx.id,
        specialtyId: spec.id,
        startAt: start,
        endAt: addMinutes(start, 15),
        reason: 'Tái khám',
      },
    });
    apptCode = appt.code;

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
    tok.x = await login(`x-${tag}@e2e.test`);
    tok.y = await login(`y-${tag}@e2e.test`);
    tok.patient = await login(`pt-${tag}@e2e.test`);
  });

  afterAll(async () => {
    if (dbReady) {
      const created = await prisma.patient.findMany({
        where: { fullName: { contains: tag } },
        select: { id: true },
      });
      ids.patients.push(...created.map((c) => c.id));
      await prisma.auditLog.deleteMany({ where: { userId: { in: ids.users } } });
      await prisma.medicalRecord.deleteMany({ where: { patientId: { in: ids.patients } } });
      await prisma.appointment.deleteMany({ where: { patientId: { in: ids.patients } } });
      await prisma.patient.deleteMany({ where: { id: { in: ids.patients } } });
      await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
      await prisma.healthFacility.deleteMany({ where: { id: { in: ids.facilities } } });
    }
    await app.close();
  });

  it('tra CCCD: thấy dị ứng, lần khám ở cơ sở khác và lịch hẹn hôm nay tại cơ sở mình', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const res = await lookup('x', p.nationalId.replace(/(\d{4})/g, '$1 '));
    expect(res.kind).toBe('NATIONAL_ID');
    expect(res.patients).toHaveLength(1);
    expect(res.patients[0]).toMatchObject({
      id: patientId,
      allergies: 'Penicillin',
      hasAccount: true,
      totalVisits: 1,
      todayAppointment: { code: apptCode },
      openEncounter: null,
    });
    expect(res.patients[0].recentVisits[0]).toMatchObject({
      atThisFacility: false,
      facility: { name: expect.stringContaining('Cơ sở Y') },
      diagnoses: [{ icdCode: 'I10' }],
    });
  });

  it('tra mã BHYT, số điện thoại, mã lịch hẹn', async (ctx) => {
    if (!dbReady) return ctx.skip();
    expect((await lookup('x', p.bhyt.toLowerCase())).patients.map((x) => x.id)).toEqual([
      patientId,
    ]);
    expect((await lookup('x', `+84${p.phone.slice(1)}`)).patients.map((x) => x.id)).toEqual([
      patientId,
    ]);
    expect((await lookup('x', apptCode)).patients.map((x) => x.id)).toEqual([patientId]);
    // Mã lịch hẹn của cơ sở X không tra được từ cơ sở Y
    expect((await lookup('y', apptCode)).patients).toEqual([]);
  });

  it('tra tên chỉ trong bệnh nhân đã liên hệ với cơ sở', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const byName = await lookup('x', `Tra Cứu`);
    const names = byName.patients.map((x) => x.id);
    expect(names).toContain(patientId);
    expect(names).not.toContain(unlinkedId);
  });

  it('bệnh nhân không dùng được tra cứu; chưa đăng nhập bị chặn; có ghi audit', async (ctx) => {
    if (!dbReady) return ctx.skip();
    await http()
      .get('/api/patients/lookup')
      .query({ q: p.nationalId })
      .set(as('patient'))
      .expect(403);
    await http().get('/api/patients/lookup').query({ q: p.nationalId }).expect(401);
    const log = await prisma.auditLog.findFirst({
      where: {
        action: 'LOOKUP',
        userId: { in: ids.users },
        metadata: { path: ['kind'], equals: 'NATIONAL_ID' },
      },
    });
    expect(log?.metadata).toMatchObject({ kind: 'NATIONAL_ID', matched: 1 });
  });

  it('tạo hồ sơ bệnh nhân vãng lai; CCCD trùng báo 409', async (ctx) => {
    if (!dbReady) return ctx.skip();
    const created = await http()
      .post('/api/patients')
      .set(as('x'))
      .send({
        fullName: `Vãng Lai ${tag}`,
        dateOfBirth: '2001-04-05',
        gender: 'FEMALE',
        nationalId: digits(12),
        allergies: '',
      })
      .expect(201);
    expect(created.body).toMatchObject({ id: expect.any(String) });
    const dup = await http()
      .post('/api/patients')
      .set(as('x'))
      .send({
        fullName: 'Trùng',
        dateOfBirth: '2001-04-05',
        gender: 'FEMALE',
        nationalId: p.nationalId,
      })
      .expect(409);
    expect((dup.body as { message: string }).message).toMatch(/tra cứu/);
    await http().post('/api/patients').set(as('x')).send({ fullName: 'Thiếu' }).expect(400);
  });

  it('bắt đầu khám: tạo phiếu nháp, gọi lại không tạo trùng, xác lập quyền xem hồ sơ', async (ctx) => {
    if (!dbReady) return ctx.skip();
    await http().get(`/api/patients/${unlinkedId}/records`).set(as('x')).expect(403);

    const first = await http()
      .post('/api/encounters')
      .set(as('x'))
      .send({ patientId: unlinkedId, chiefComplaint: 'Sốt cao', encounterType: 'EMERGENCY' })
      .expect(201);
    expect(first.body).toMatchObject({ code: expect.stringMatching(/^BA/), created: true });
    const again = await http()
      .post('/api/encounters')
      .set(as('x'))
      .send({ patientId: unlinkedId, chiefComplaint: 'Sốt cao' })
      .expect(201);
    expect(again.body).toMatchObject({ id: (first.body as { id: string }).id, created: false });

    await http().get(`/api/patients/${unlinkedId}/records`).set(as('x')).expect(200);
    await http().get(`/api/patients/${unlinkedId}/records`).set(as('y')).expect(403);
    const found = await lookup('x', `Tra Cứu Hai ${tag}`);
    expect(found.patients[0]).toMatchObject({
      id: unlinkedId,
      openEncounter: { code: (first.body as { code: string }).code },
    });
  });
});
