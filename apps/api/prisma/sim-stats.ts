/**
 * Dữ liệu GIẢ LẬP cho thống kê (Task 5.2): lịch hẹn, lượt khám có chẩn đoán ICD-10 và phiếu chuyển tuyến
 * của nhiều trạm y tế ở 7 tỉnh trong 180 ngày gần nhất — để dashboard có số liệu khi phát triển/demo.
 *
 *   pnpm --filter @mevita/api sim:stats          # xoá dữ liệu giả lập cũ rồi tạo mới
 *   pnpm --filter @mevita/api sim:stats --clear  # chỉ xoá
 *
 * Mọi bản ghi giả lập được đánh dấu để xoá sạch: mã `SIM…` (cơ sở, lịch hẹn, hồ sơ, phiếu), email
 * `@mevita.sim`, bệnh nhân có `addressDetail = '[SIM]'`. Tài khoản giả lập bị khoá (không đăng nhập được).
 * Không chạy ở production.
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../src/generated/prisma/client.js';
import { computeRecordSignature } from '../src/medical-records/signature.js';

const DAYS = 180;
const SIM_ADDRESS = '[SIM]';

/** Hồ sơ bệnh tật theo vùng: trọng số theo chữ cái đầu mã ICD-10 (chương) và tỉ lệ chuyển tuyến. */
const PROFILES = {
  mountain: {
    weights: { J: 30, A: 12, B: 6, K: 12, S: 10, T: 3, I: 8, E: 3, M: 8, N: 4, O: 4 },
    referral: [0.08, 0.14],
    visits: 3.2,
  },
  urban: {
    weights: { I: 24, E: 16, J: 18, M: 12, K: 10, N: 6, F: 4, G: 4, S: 4, A: 2 },
    referral: [0.03, 0.06],
    visits: 6,
  },
  delta: {
    weights: { J: 20, A: 16, I: 14, E: 10, K: 12, S: 8, M: 8, N: 6, B: 4 },
    referral: [0.05, 0.09],
    visits: 4.5,
  },
} as const;

const PROVINCES: { code: string; profile: keyof typeof PROFILES }[] = [
  { code: '15', profile: 'mountain' }, // Lào Cai
  { code: '11', profile: 'mountain' }, // Điện Biên
  { code: '12', profile: 'mountain' }, // Lai Châu
  { code: '14', profile: 'mountain' }, // Sơn La
  { code: '01', profile: 'urban' }, // Hà Nội
  { code: '79', profile: 'urban' }, // TP. Hồ Chí Minh
  { code: '92', profile: 'delta' }, // Cần Thơ
];

/** Bộ sinh số ngẫu nhiên có hạt giống — chạy lại cho cùng bộ dữ liệu. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20260523);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const between = (a: number, b: number) => a + rand() * (b - a);
const int = (a: number, b: number) => Math.floor(between(a, b + 1));
function poisson(lambda: number) {
  const l = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rand();
  } while (p > l);
  return k - 1;
}
function weighted<K extends string>(w: Partial<Record<K, number>>): K {
  const entries = Object.entries(w) as [K, number][];
  let r = rand() * entries.reduce((s, [, v]) => s + v, 0);
  for (const [k, v] of entries) if ((r -= v) <= 0) return k;
  return entries[0][0];
}
let seq = 0;
const code = (prefix: string) =>
  `SIM${prefix}${(++seq).toString(36).toUpperCase().padStart(6, '0')}`;

async function clear(prisma: PrismaClient) {
  const facilities = await prisma.healthFacility.findMany({
    where: { code: { startsWith: 'SIM-' } },
    select: { id: true },
  });
  const facilityIds = facilities.map((f) => f.id);
  const r = await prisma.referral.deleteMany({ where: { code: { startsWith: 'SIM' } } });
  const m = await prisma.medicalRecord.deleteMany({ where: { code: { startsWith: 'SIM' } } });
  const a = await prisma.appointment.deleteMany({ where: { code: { startsWith: 'SIM' } } });
  const p = await prisma.patient.deleteMany({ where: { addressDetail: SIM_ADDRESS } });
  await prisma.staffProfile.deleteMany({ where: { facilityId: { in: facilityIds } } });
  const u = await prisma.user.deleteMany({ where: { email: { endsWith: '@mevita.sim' } } });
  await prisma.facilitySpecialty.deleteMany({ where: { facilityId: { in: facilityIds } } });
  const f = await prisma.healthFacility.deleteMany({ where: { id: { in: facilityIds } } });
  console.log(
    `🧹 Đã xoá dữ liệu giả lập: ${f.count} cơ sở, ${u.count} tài khoản, ${p.count} bệnh nhân, ${a.count} lịch hẹn, ${m.count} hồ sơ, ${r.count} phiếu chuyển tuyến`,
  );
}

async function main() {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Không chạy dữ liệu giả lập ở production');
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Thiếu biến môi trường DATABASE_URL');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await clear(prisma);
    if (process.argv.includes('--clear')) return;
    await generate(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

async function generate(prisma: PrismaClient) {
  const icd = await prisma.icd10Code.findMany({
    where: { isActive: true },
    select: { code: true },
  });
  const byLetter = new Map<string, string[]>();
  for (const { code: c } of icd) byLetter.set(c[0], [...(byLetter.get(c[0]) ?? []), c]);
  const central = await prisma.healthFacility.findUnique({
    where: { code: 'DEMO-BV-VIETDUC' },
    select: { id: true },
  });
  const demoDoctor = await prisma.user.findUnique({
    where: { email: 'bs.binh@mevita.vn' },
    select: { id: true },
  });
  const demoLaoCai = await prisma.healthFacility.findUnique({
    where: { code: 'DEMO-BVDK-15' },
    select: { id: true },
  });

  const now = new Date();
  const start = new Date(now.getTime() - DAYS * 86_400_000);
  const facilities: Prisma.HealthFacilityCreateManyInput[] = [];
  const users: Prisma.UserCreateManyInput[] = [];
  const staff: Prisma.StaffProfileCreateManyInput[] = [];
  const patients: Prisma.PatientCreateManyInput[] = [];
  const appointments: Prisma.AppointmentCreateManyInput[] = [];
  const records: Prisma.MedicalRecordCreateManyInput[] = [];
  const diagnoses: Prisma.DiagnosisCreateManyInput[] = [];
  const referrals: Prisma.ReferralCreateManyInput[] = [];
  const taken = new Set<string>(); // một bệnh nhân không có 2 lịch hẹn cùng giờ

  const doctorOf = (facilityId: string, label: string) => {
    const id = randomUUID();
    users.push({
      id,
      email: `${label.toLowerCase()}@mevita.sim`,
      passwordHash: 'sim-account-disabled',
      fullName: `BS. Giả lập ${label}`,
      role: 'COMMUNE_STAFF',
      isActive: false,
    });
    staff.push({ userId: id, facilityId, position: 'DOCTOR', academicTitle: 'BS' });
    return id;
  };

  for (const prov of PROVINCES) {
    const profile = PROFILES[prov.profile];
    const communes = await prisma.commune.findMany({
      where: { provinceCode: prov.code },
      select: { code: true },
      orderBy: { code: 'asc' },
    });
    // Bệnh viện tỉnh: Lào Cai dùng BVĐK demo, các tỉnh khác tạo bệnh viện giả lập
    let hospitalId = prov.code === '15' ? demoLaoCai?.id : undefined;
    let hospitalDoctor = demoDoctor?.id ?? null;
    if (!hospitalId) {
      hospitalId = randomUUID();
      facilities.push({
        id: hospitalId,
        code: `SIM-BV-${prov.code}`,
        name: `BVĐK tỉnh (giả lập) ${prov.code}`,
        type: 'PROVINCIAL_GENERAL_HOSPITAL',
        level: 'BASIC',
        communeCode: communes[0].code,
        // Chỉ phục vụ số liệu thống kê — không xuất hiện trong danh sách nhận chuyển tuyến khi demo
        acceptsReferrals: false,
      });
      hospitalDoctor = randomUUID();
      users.push({
        id: hospitalDoctor,
        email: `bv${prov.code}@mevita.sim`,
        passwordHash: 'sim-account-disabled',
        fullName: `BS. Giả lập BV ${prov.code}`,
        role: 'PROVINCE_STAFF',
        isActive: false,
      });
    }
    const stationCommunes = Array.from(
      { length: 5 },
      (_, i) => communes[Math.floor(((i + 0.5) * communes.length) / 5)],
    );
    const provPatients: string[] = [];
    for (let i = 0; i < 90; i++) {
      const id = randomUUID();
      provPatients.push(id);
      patients.push({
        id,
        fullName: `Bệnh nhân giả lập ${prov.code}-${i + 1}`,
        dateOfBirth: new Date(Date.UTC(int(1940, 2022), int(0, 11), int(1, 28))),
        gender: rand() < 0.5 ? 'MALE' : 'FEMALE',
        communeCode: pick(communes).code,
        addressDetail: SIM_ADDRESS,
      });
    }

    for (const commune of stationCommunes) {
      const facilityId = randomUUID();
      facilities.push({
        id: facilityId,
        code: `SIM-TYT-${commune.code}`,
        name: `Trạm Y tế (giả lập) ${commune.code}`,
        type: 'COMMUNE_HEALTH_STATION',
        level: 'PRIMARY',
        communeCode: commune.code,
      });
      const doctorId = doctorOf(facilityId, `tyt${commune.code}`);
      const referralRate = between(profile.referral[0], profile.referral[1]);
      const intensity = profile.visits * between(0.6, 1.4);

      for (let d = 0; d < DAYS; d++) {
        const day = new Date(start.getTime() + d * 86_400_000);
        const weekend = day.getUTCDay() === 0 || day.getUTCDay() === 6;
        const n = poisson(weekend ? intensity * 0.35 : intensity);
        for (let k = 0; k < n; k++) {
          const at = new Date(day);
          at.setUTCHours(int(0, 9), pick([0, 15, 30, 45]), 0, 0); // 7h–16h giờ VN
          if (at > now) continue;
          const patientId = pick(provPatients);
          if (taken.has(patientId + at.toISOString())) continue;
          taken.add(patientId + at.toISOString());
          // ~60% lượt đến có đặt lịch trước
          let appointmentId: string | null = null;
          if (rand() < 0.6) {
            appointmentId = randomUUID();
            const outcome = rand();
            const status = outcome < 0.08 ? 'CANCELLED' : outcome < 0.14 ? 'NO_SHOW' : 'COMPLETED';
            appointments.push({
              id: appointmentId,
              code: code('L'),
              patientId,
              facilityId,
              startAt: at,
              endAt: new Date(at.getTime() + 15 * 60_000),
              reason: 'Khám bệnh (giả lập)',
              status,
              createdAt: new Date(at.getTime() - int(1, 5) * 86_400_000),
              ...(status === 'CANCELLED' && { cancelledAt: at, cancellationReason: 'Bận việc' }),
            });
            if (status !== 'COMPLETED') continue;
          }
          const recordId = randomUUID();
          const letter = weighted<string>(profile.weights);
          const pool = byLetter.get(letter) ?? byLetter.get('J')!;
          const dx = [{ icdCode: pick(pool), isPrimary: true }];
          if (rand() < 0.25) {
            const extra = pick(icd).code;
            if (extra !== dx[0].icdCode) dx.push({ icdCode: extra, isPrimary: false });
          }
          const emergency = letter === 'S' || letter === 'T' || rand() < 0.04;
          const rec = {
            id: recordId,
            patientId,
            doctorId,
            facilityId,
            visitAt: at,
            chiefComplaint: 'Khám bệnh (giả lập)',
            pulse: int(64, 110),
            systolicBp: int(100, 160),
            diastolicBp: int(60, 95),
            spo2: int(92, 99),
            diagnoses: dx,
            prescriptionItems: [],
          };
          records.push({
            ...rec,
            diagnoses: undefined,
            prescriptionItems: undefined,
            code: code('B'),
            appointmentId,
            encounterType: emergency ? 'EMERGENCY' : 'OUTPATIENT',
            status: 'FINALIZED',
            signedAt: new Date(at.getTime() + 20 * 60_000),
            signatureHash: computeRecordSignature(rec),
            createdAt: at,
          } as Prisma.MedicalRecordCreateManyInput);
          diagnoses.push(...dx.map((x) => ({ ...x, medicalRecordId: recordId })));

          // Chuyển tuyến: chấn thương/cấp cứu dễ chuyển hơn
          if (rand() < referralRate * (emergency ? 3 : 0.8)) {
            const created = new Date(at.getTime() + int(20, 90) * 60_000);
            if (created > now) continue;
            const inter = central && rand() < (prov.profile === 'mountain' ? 0.12 : 0.05);
            const priority = emergency
              ? rand() < 0.5
                ? 'CRITICAL'
                : 'URGENT'
              : rand() < 0.3
                ? 'URGENT'
                : 'ROUTINE';
            const eta = int(20, prov.profile === 'mountain' ? 150 : 60) * (inter ? 3 : 1);
            const o = rand();
            const status = o < 0.06 ? 'CANCELLED' : o < 0.13 ? 'REJECTED' : 'ARRIVED';
            const responded = new Date(created.getTime() + int(1, 12) * 60_000);
            referrals.push({
              code: code('C'),
              patientId,
              sourceRecordId: recordId,
              fromFacilityId: facilityId,
              toFacilityId: inter ? central.id : hospitalId,
              referredById: doctorId,
              priority,
              status,
              reason: 'Vượt khả năng chuyên môn (giả lập)',
              clinicalSummary: 'Dữ liệu giả lập phục vụ thống kê',
              departedAt: created,
              estimatedArrivalAt: new Date(created.getTime() + eta * 60_000),
              createdAt: created,
              ...(status !== 'CANCELLED' && {
                acceptedAt: responded,
                acceptedById: hospitalDoctor,
              }),
              ...(status === 'REJECTED' && { rejectionReason: 'Hết giường (giả lập)' }),
              ...(status === 'ARRIVED' && {
                arrivedAt: new Date(created.getTime() + eta * between(0.8, 1.3) * 60_000),
                receivedById: hospitalDoctor,
              }),
              ...(status === 'CANCELLED' && {
                cancelledAt: responded,
                cancellationReason: 'Gia đình xin chuyển nơi khác',
              }),
            });
          }
        }
      }
    }
  }

  // Bác sĩ BV giả lập cần hồ sơ nhân viên
  for (const f of facilities.filter((x) => x.type === 'PROVINCIAL_GENERAL_HOSPITAL')) {
    const u = users.find((x) => x.email === `bv${f.code.slice(-2)}@mevita.sim`)!;
    staff.push({ userId: u.id!, facilityId: f.id!, position: 'DOCTOR', academicTitle: 'BS' });
  }
  const chunk = async <T>(rows: T[], fn: (batch: T[]) => Promise<unknown>) => {
    for (let i = 0; i < rows.length; i += 2000) await fn(rows.slice(i, i + 2000));
  };
  await prisma.healthFacility.createMany({ data: facilities });
  await prisma.user.createMany({ data: users });
  await prisma.staffProfile.createMany({ data: staff });
  await chunk(patients, (b) => prisma.patient.createMany({ data: b }));
  await chunk(appointments, (b) => prisma.appointment.createMany({ data: b }));
  await chunk(records, (b) => prisma.medicalRecord.createMany({ data: b }));
  await chunk(diagnoses, (b) => prisma.diagnosis.createMany({ data: b }));
  await chunk(referrals, (b) => prisma.referral.createMany({ data: b }));
  console.log(
    `✔ Giả lập ${DAYS} ngày: ${facilities.length} cơ sở, ${patients.length} bệnh nhân, ${appointments.length} lịch hẹn, ${records.length} lượt khám, ${referrals.length} phiếu chuyển tuyến`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
