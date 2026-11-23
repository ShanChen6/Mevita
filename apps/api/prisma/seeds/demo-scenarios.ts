/**
 * Kịch bản dữ liệu mẫu cho buổi demo (Task 6.2). Mốc thời gian tính theo lúc chạy, nên
 * dữ liệu luôn trông "mới": ca 3 ngày trước, ca hôm qua, hàng đợi hôm nay, lịch hẹn ngày mai.
 *
 * 1. Chấn thương sọ não (Giàng A Pháo): TYT Mường Khương yêu cầu xe đón, BVĐK Lào Cai cử xe 24A-115.01,
 *    có sinh tồn trên xe và lộ trình GPS, sau đó phẫu thuật tại tỉnh. Ca đã hoàn tất.
 * 2. Hành trình 2 chặng (Vàng Thị Mỷ): ngã từ độ cao. BVĐK nhận "ổn định rồi chuyển tiếp" vì hết giường
 *    hồi sức, đặt dẫn lưu màng phổi rồi chuyển xe 24A-115.01 lên BV Việt Đức.
 * 3. Ca thường bị đề nghị chuyển (Hoàng Văn Thắng, gãy cổ xương đùi): BVĐK chưa triển khai thay khớp,
 *    đề nghị chuyển Việt Đức. TYT Bát Xát lập lệnh mới, gia đình tự chở.
 * 4. Hàng đợi hôm nay để demo trực tiếp:
 *    - Sùng Seo Chư: tai nạn giao thông, phiếu cấp cứu nháp tại TYT Mường Khương, chờ bấm "Chuyển tuyến khẩn cấp".
 *    - Bé Lù Thị Dung: viêm phổi, đã tiếp đón từ lịch hẹn.
 * 5. Lịch hẹn: hôm nay và ngày mai ở trạm xã và BVĐK, có lịch của bệnh nhân demo Lò Văn Cường
 *    để demo cổng bệnh nhân.
 *
 * Bản ghi kịch bản có mã `DEMO-KB-*` (hồ sơ), `DEMO-CT-*` (phiếu), `DEMO-LH-*` (lịch hẹn).
 * `pnpm --filter @mevita/api demo:reset` xoá mọi dữ liệu phát sinh khi diễn tập rồi dựng lại kịch bản.
 */
import { randomUUID } from 'node:crypto';
import type {
  BloodType,
  ConsciousnessLevel,
  EncounterType,
  Gender,
  Prisma,
  PrismaClient,
  ReferralPriority,
  ReferralStatus,
} from '../../src/generated/prisma/client.js';
import { computeRecordSignature } from '../../src/medical-records/signature.js';

const MIN = 60_000;
const at = (base: Date, minutes: number) => new Date(base.getTime() + minutes * MIN);

/** Mốc giờ Việt Nam (UTC+7) của ngày cách hôm nay `daysAgo` ngày (âm = tương lai). */
export function vnAt(daysAgo: number, hour: number, minute = 0, now = new Date()) {
  const vn = new Date(now.getTime() + 7 * 3_600_000);
  return new Date(
    Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate() - daysAgo, hour - 7, minute),
  );
}

type LatLng = [number, number];

/** Lộ trình gần đúng theo trục đường chính (đủ để vẽ bản đồ demo). */
const ROUTES: Record<'mkToBvdk' | 'bvdkToVietDuc', LatLng[]> = {
  // QL4D Mường Khương → TP Lào Cai
  mkToBvdk: [
    [22.7676, 104.1236],
    [22.7212, 104.1105],
    [22.6655, 104.0811],
    [22.6018, 104.0632],
    [22.5404, 104.0518],
    [22.4741, 104.0302],
    [22.4127, 104.0226],
  ],
  // Cao tốc Nội Bài – Lào Cai
  bvdkToVietDuc: [
    [22.4127, 104.0226],
    [22.3302, 104.1215],
    [22.1404, 104.4007],
    [21.9821, 104.7002],
    [21.7093, 105.0011],
    [21.4255, 105.2508],
    [21.2213, 105.7487],
    [21.0921, 105.8106],
    [21.0285, 105.8472],
  ],
};

function haversine([a1, o1]: LatLng, [a2, o2]: LatLng) {
  const r = Math.PI / 180;
  const h =
    Math.sin(((a2 - a1) * r) / 2) ** 2 +
    Math.cos(a1 * r) * Math.cos(a2 * r) * Math.sin(((o2 - o1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Rải điểm GPS đều theo quãng đường, mỗi `stepMin` phút, từ `from` tới `to`. */
export function trackPoints(route: LatLng[], from: Date, to: Date, stepMin: number) {
  const seg = route.slice(1).map((p, i) => haversine(route[i], p));
  const total = seg.reduce((s, d) => s + d, 0);
  const durationMin = (to.getTime() - from.getTime()) / MIN;
  const speed = (total * 1000) / (durationMin * 60); // m/s trung bình
  const points: { latitude: number; longitude: number; recordedAt: Date; speed: number }[] = [];
  for (let t = 0; t <= durationMin; t += stepMin) {
    let d = (t / durationMin) * total;
    let i = 0;
    while (i < seg.length - 1 && d > seg[i]) d -= seg[i++];
    const k = seg[i] ? Math.min(1, d / seg[i]) : 0;
    const [a, b] = [route[i], route[i + 1]];
    points.push({
      latitude: +(a[0] + (b[0] - a[0]) * k).toFixed(5),
      longitude: +(a[1] + (b[1] - a[1]) * k).toFixed(5),
      recordedAt: at(from, t),
      // Lên dốc/qua thị trấn chậm hơn: dao động ±25% quanh tốc độ trung bình
      speed: +(speed * (0.75 + 0.5 * Math.abs(Math.sin(t / 7)))).toFixed(1),
    });
  }
  return points;
}

const patients: {
  key: 'phao' | 'my' | 'thang' | 'chu' | 'dung' | 'sinh';
  fullName: string;
  dateOfBirth: string;
  gender: Gender;
  nationalId: string;
  healthInsuranceNumber: string;
  phone: string | null;
  communeCode: string;
  addressDetail: string;
  bloodType: BloodType;
  allergies?: string;
  chronicConditions?: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}[] = [
  {
    key: 'phao',
    fullName: 'Giàng A Pháo',
    dateOfBirth: '1988-03-12',
    gender: 'MALE',
    nationalId: '010088004521',
    healthInsuranceNumber: 'DN4010088004521',
    phone: '0912000101',
    communeCode: '02761',
    addressDetail: 'Thôn Sín Chải',
    bloodType: 'B_POSITIVE',
    emergencyContactName: 'Giàng Thị Mai (vợ)',
    emergencyContactPhone: '0912000102',
  },
  {
    key: 'my',
    fullName: 'Vàng Thị Mỷ',
    dateOfBirth: '1996-07-22',
    gender: 'FEMALE',
    nationalId: '010196007733',
    healthInsuranceNumber: 'DN4010196007733',
    phone: '0912000201',
    communeCode: '02761',
    addressDetail: 'Bản Lùng Vai',
    bloodType: 'A_POSITIVE',
    emergencyContactName: 'Vàng A Sử (chồng)',
    emergencyContactPhone: '0912000202',
  },
  {
    key: 'thang',
    fullName: 'Hoàng Văn Thắng',
    dateOfBirth: '1956-11-02',
    gender: 'MALE',
    nationalId: '010056002310',
    healthInsuranceNumber: 'HT2010056002310',
    phone: null,
    communeCode: '02683',
    addressDetail: 'Thôn Bản Vược',
    bloodType: 'O_POSITIVE',
    chronicConditions: 'Tăng huyết áp, loãng xương',
    emergencyContactName: 'Hoàng Thị Hằng (con gái)',
    emergencyContactPhone: '0912000302',
  },
  {
    key: 'chu',
    fullName: 'Sùng Seo Chư',
    dateOfBirth: '1994-01-15',
    gender: 'MALE',
    nationalId: '010094009912',
    healthInsuranceNumber: 'DN4010094009912',
    phone: '0912000401',
    communeCode: '02761',
    addressDetail: 'Thôn Pạc Bo',
    bloodType: 'UNKNOWN',
    allergies: 'Cephalosporin (nổi mề đay)',
    emergencyContactName: 'Sùng Thị Pà (mẹ)',
    emergencyContactPhone: '0912000402',
  },
  {
    key: 'dung',
    fullName: 'Lù Thị Dung',
    dateOfBirth: '2020-04-09',
    gender: 'FEMALE',
    nationalId: '010320001145',
    healthInsuranceNumber: 'TE1010320001145',
    phone: null,
    communeCode: '02761',
    addressDetail: 'Thôn Na Pá',
    bloodType: 'O_POSITIVE',
    emergencyContactName: 'Lù Văn Sang (bố)',
    emergencyContactPhone: '0912000502',
  },
  {
    key: 'sinh',
    fullName: 'Thào Thị Sinh',
    dateOfBirth: '1999-09-30',
    gender: 'FEMALE',
    nationalId: '010199005566',
    healthInsuranceNumber: 'DN4010199005566',
    phone: '0912000601',
    communeCode: '02683',
    addressDetail: 'Thôn Ná Lặc',
    bloodType: 'B_POSITIVE',
    emergencyContactName: 'Thào A Lử (chồng)',
    emergencyContactPhone: '0912000602',
  },
];

/** CCCD của mọi bệnh nhân demo (kể cả Lò Văn Cường ở demo.ts) — dùng cho demo:reset. */
export const DEMO_PATIENT_IDS = ['010090001234', ...patients.map((p) => p.nationalId)];

interface Vital {
  pulse?: number;
  systolicBp?: number;
  diastolicBp?: number;
  spo2?: number;
  respiratoryRate?: number;
  temperature?: number;
  consciousness?: ConsciousnessLevel;
  gcs?: number;
  note?: string;
}

interface RecordInput {
  code: string;
  patient: string;
  doctor: string;
  facility: string;
  specialty?: string;
  visitAt: Date;
  encounterType?: EncounterType;
  chiefComplaint: string;
  symptoms?: string;
  physicalExamination?: string;
  pulse?: number;
  temperature?: number;
  systolicBp?: number;
  diastolicBp?: number;
  respiratoryRate?: number;
  spo2?: number;
  weightKg?: number;
  diagnoses: { icdCode: string; isPrimary: boolean }[];
  diagnosisNote?: string;
  treatmentPlan?: string;
  prescription?: {
    drugName: string;
    strength: string;
    quantity: number;
    unit: string;
    instructions: string;
  }[];
  sign?: boolean;
  sourceReferralId?: string;
  appointmentId?: string;
}

interface ReferralInput {
  code: string;
  patient: string;
  sourceRecordId: string;
  from: string;
  to: string;
  referredBy: string;
  escort?: string;
  priority: ReferralPriority;
  status: ReferralStatus;
  requiredSpecialty?: string;
  reason: string;
  clinicalSummary: string;
  initialTreatment?: string;
  createdAt: Date;
  acceptedAt?: Date;
  acceptedBy?: string;
  acceptanceType?: 'READY' | 'STABILIZE_FORWARD';
  forwardNote?: string;
  preparationNote?: string;
  rejectionReason?: string;
  redirectCategory?: 'NO_SPECIALTY' | 'NO_EQUIPMENT' | 'NOT_INDICATED' | 'OTHER';
  redirectFacility?: string;
  transportMode: 'FACILITY_VEHICLE' | 'PICKUP' | 'EMS_115' | 'FAMILY' | 'OTHER';
  vehicle?: string;
  vehicleInfo?: string;
  transportNote?: string;
  pickupRequestedAt?: Date;
  pickupAssignedAt?: Date;
  departedAt?: Date;
  arrivedAt?: Date;
  receivedBy?: string;
  etaMinutes?: number;
  vitals?: { minute: number; v: Vital }[];
  track?: { route: keyof typeof ROUTES; stepMin: number };
}

type Ctx = Awaited<ReturnType<typeof loadContext>>;

async function loadContext(prisma: PrismaClient) {
  const facilities = await prisma.healthFacility.findMany({
    where: { code: { startsWith: 'DEMO-' } },
    select: { id: true, code: true },
  });
  const users = await prisma.user.findMany({
    where: { email: { endsWith: '@mevita.vn' } },
    select: { id: true, email: true },
  });
  const specialties = await prisma.specialty.findMany({ select: { id: true, code: true } });
  const vehicles = await prisma.vehicle.findMany({ select: { id: true, plateNumber: true } });
  const need = <T>(m: Map<string, T>, k: string, what: string) => {
    const v = m.get(k);
    if (v === undefined) throw new Error(`Thiếu ${what} demo: ${k} (chạy pnpm db:seed trước)`);
    return v;
  };
  const f = new Map(facilities.map((x) => [x.code, x.id]));
  const u = new Map(users.map((x) => [x.email!, x.id]));
  const s = new Map(specialties.map((x) => [x.code, x.id]));
  const v = new Map(vehicles.map((x) => [x.plateNumber, x.id]));
  const p = new Map<string, string>();
  return {
    facility: (code: string) => need(f, code, 'cơ sở'),
    user: (email: string) => need(u, `${email}@mevita.vn`, 'tài khoản'),
    specialty: (code: string) => need(s, code, 'chuyên khoa'),
    vehicle: (plate: string) => need(v, plate, 'xe'),
    patient: (key: string) => need(p, key, 'bệnh nhân'),
    patients: p,
  };
}

async function createRecord(tx: Prisma.TransactionClient, c: Ctx, r: RecordInput) {
  const { patient, doctor, facility, specialty, sign, prescription = [], diagnoses, ...data } = r;
  const record = await tx.medicalRecord.create({
    data: {
      ...data,
      patientId: c.patient(patient),
      doctorId: c.user(doctor),
      facilityId: c.facility(facility),
      specialtyId: specialty ? c.specialty(specialty) : undefined,
      diagnoses: { create: diagnoses },
      prescriptionItems: { create: prescription.map((p, i) => ({ ...p, sortOrder: i })) },
    },
  });
  if (sign) {
    await tx.medicalRecord.update({
      where: { id: record.id },
      data: {
        status: 'FINALIZED',
        signedAt: at(record.visitAt, 40),
        signatureHash: computeRecordSignature({
          ...record,
          diagnoses,
          prescriptionItems: prescription,
        }),
      },
    });
  }
  return record.id;
}

async function createReferral(tx: Prisma.TransactionClient, c: Ctx, r: ReferralInput) {
  const escortId = r.escort ? c.user(r.escort) : null;
  const recorder = escortId ?? c.user(r.referredBy);
  const referral = await tx.referral.create({
    data: {
      code: r.code,
      patientId: c.patient(r.patient),
      sourceRecordId: r.sourceRecordId,
      fromFacilityId: c.facility(r.from),
      toFacilityId: c.facility(r.to),
      referredById: c.user(r.referredBy),
      escortId,
      priority: r.priority,
      status: r.status,
      requiredSpecialtyId: r.requiredSpecialty ? c.specialty(r.requiredSpecialty) : null,
      reason: r.reason,
      clinicalSummary: r.clinicalSummary,
      initialTreatment: r.initialTreatment,
      createdAt: r.createdAt,
      acceptedAt: r.acceptedAt,
      acceptedById: r.acceptedBy ? c.user(r.acceptedBy) : null,
      acceptanceType: r.acceptanceType,
      forwardNote: r.forwardNote,
      preparationNote: r.preparationNote,
      rejectionReason: r.rejectionReason,
      redirectCategory: r.redirectCategory,
      redirectFacilityId: r.redirectFacility ? c.facility(r.redirectFacility) : null,
      transportMode: r.transportMode,
      vehicleId: r.vehicle ? c.vehicle(r.vehicle) : null,
      vehicleInfo: r.vehicleInfo ?? r.vehicle ?? null,
      transportNote: r.transportNote,
      pickupRequestedAt: r.pickupRequestedAt,
      pickupAssignedAt: r.pickupAssignedAt,
      pickedUpAt: r.transportMode === 'PICKUP' ? r.departedAt : null,
      departedAt: r.departedAt,
      estimatedArrivalAt: r.departedAt && r.etaMinutes ? at(r.departedAt, r.etaMinutes) : null,
      arrivedAt: r.arrivedAt,
      arrivingNotifiedAt: r.arrivedAt && r.track ? at(r.arrivedAt, -5) : null,
      receivedById: r.receivedBy ? c.user(r.receivedBy) : null,
    },
  });
  if (r.vitals?.length && r.departedAt) {
    await tx.referralVitalLog.createMany({
      data: r.vitals.map(({ minute, v }) => ({
        ...v,
        referralId: referral.id,
        clientId: randomUUID(),
        recordedAt: at(r.departedAt!, minute),
        receivedAt: at(r.departedAt!, minute),
        recordedById: recorder,
      })),
    });
  }
  if (r.track && r.departedAt && r.arrivedAt) {
    await tx.referralLocation.createMany({
      data: trackPoints(ROUTES[r.track.route], r.departedAt, r.arrivedAt, r.track.stepMin).map(
        (p) => ({
          ...p,
          referralId: referral.id,
          clientId: randomUUID(),
          receivedAt: p.recordedAt,
          accuracy: 12,
          recordedById: recorder,
        }),
      ),
    });
  }
  return referral.id;
}

/** Hồ sơ tiếp nối tại tuyến trên (như POST /referrals/:id/arrive) rồi ký. */
const continuation = (
  r: Omit<RecordInput, 'encounterType' | 'sign'> & { sourceReferralId: string },
): RecordInput => ({ ...r, encounterType: 'EMERGENCY', sign: true });

/**
 * Dựng kịch bản. Bỏ qua nếu đã có, vì chạy lại `db:seed` không được nhân bản dữ liệu.
 * Trả về mô tả ngắn để in ra console.
 */
export async function seedDemoScenarios(prisma: PrismaClient, now = new Date()) {
  if (
    await prisma.medicalRecord.findUnique({ where: { code: 'DEMO-KB-01' }, select: { id: true } })
  )
    return 'đã có (chạy demo:reset để dựng lại)';
  const c = await loadContext(prisma);
  for (const { key, dateOfBirth, ...p } of patients) {
    const row = await prisma.patient.upsert({
      where: { nationalId: p.nationalId },
      create: { ...p, dateOfBirth: new Date(dateOfBirth) },
      update: {},
    });
    c.patients.set(key, row.id);
  }
  const cuong = await prisma.patient.findUniqueOrThrow({ where: { nationalId: '010090001234' } });
  c.patients.set('cuong', cuong.id);

  await prisma.$transaction(
    async (tx) => {
      // ── 1. Chấn thương sọ não, xe đón từ tỉnh (3 ngày trước) ──────────────────────────────
      const t1 = vnAt(3, 6, 40, now);
      const rec1 = await createRecord(tx, c, {
        code: 'DEMO-KB-01',
        patient: 'phao',
        doctor: 'bs.an',
        facility: 'DEMO-TYT-02761',
        specialty: 'GENERAL_INTERNAL',
        visitAt: t1,
        encounterType: 'EMERGENCY',
        chiefComplaint: 'Ngã xe máy, đau đầu, nôn',
        symptoms:
          'Ngã xe máy trên đường đèo lúc 6h15, không đội mũ bảo hiểm, đập đầu xuống đường. Bất tỉnh khoảng 5 phút, sau đó tỉnh lại, đau đầu nhiều, nôn 2 lần.',
        physicalExamination:
          'Lơ mơ, GCS 13 (E3V4M6). Đồng tử 2 bên 3mm, phản xạ ánh sáng (+). Bầm tím, sưng nề vùng thái dương phải. Không liệt khu trú.',
        pulse: 96,
        systolicBp: 150,
        diastolicBp: 90,
        respiratoryRate: 20,
        spo2: 95,
        temperature: 36.7,
        weightKg: 62,
        diagnoses: [{ icdCode: 'S06.5', isPrimary: true }],
        diagnosisNote: 'Chấn thương sọ não kín, nghi máu tụ dưới màng cứng bán cầu phải.',
        treatmentPlan:
          'Chuyển tuyến cấp cứu BVĐK tỉnh. Cố định cột sống cổ, thở oxy, theo dõi GCS mỗi 15 phút.',
        sign: true,
      });
      const ref1 = await createReferral(tx, c, {
        code: 'DEMO-CT-01',
        patient: 'phao',
        sourceRecordId: rec1,
        from: 'DEMO-TYT-02761',
        to: 'DEMO-BVDK-15',
        referredBy: 'bs.an',
        escort: 'dd.hoa',
        priority: 'CRITICAL',
        status: 'ARRIVED',
        requiredSpecialty: 'NEUROSURGERY',
        reason: 'S06.5 Nghi máu tụ dưới màng cứng — cần chụp CT sọ và phẫu thuật thần kinh',
        clinicalSummary:
          'Nam 38 tuổi, TNGT xe máy, bất tỉnh 5 phút, nôn 2 lần. GCS 13, đồng tử đều 3mm. Mạch 96, HA 150/90, SpO2 95%.',
        initialTreatment:
          'Cố định cột sống cổ bằng nẹp, thở oxy kính 3 lít/phút, truyền NaCl 0,9% 500ml.',
        createdAt: at(t1, 25),
        acceptedAt: at(t1, 27),
        acceptedBy: 'bs.minh',
        acceptanceType: 'READY',
        preparationNote: 'Đã báo phòng CT và phòng mổ cấp cứu, kíp ngoại thần kinh chờ sẵn.',
        transportMode: 'PICKUP',
        vehicle: '24A-115.01',
        transportNote: 'Trạm chỉ có xe bán tải, không phù hợp ca tối khẩn',
        pickupRequestedAt: at(t1, 25),
        pickupAssignedAt: at(t1, 28),
        departedAt: at(t1, 80),
        etaMinutes: 75,
        arrivedAt: at(t1, 152),
        receivedBy: 'bs.minh',
        vitals: [
          {
            minute: 0,
            v: {
              pulse: 94,
              systolicBp: 148,
              diastolicBp: 88,
              spo2: 96,
              gcs: 13,
              consciousness: 'VOICE',
            },
          },
          {
            minute: 15,
            v: {
              pulse: 90,
              systolicBp: 155,
              diastolicBp: 92,
              spo2: 96,
              gcs: 13,
              consciousness: 'VOICE',
            },
          },
          {
            minute: 30,
            v: {
              pulse: 82,
              systolicBp: 165,
              diastolicBp: 95,
              spo2: 94,
              gcs: 12,
              consciousness: 'VOICE',
              note: 'Nôn thêm 1 lần, kêu đau đầu tăng',
            },
          },
          {
            minute: 45,
            v: {
              pulse: 76,
              systolicBp: 172,
              diastolicBp: 98,
              spo2: 94,
              gcs: 11,
              consciousness: 'PAIN',
              note: 'Đồng tử phải 4mm, phản xạ chậm. Đã báo BV nhận.',
            },
          },
          {
            minute: 60,
            v: {
              pulse: 74,
              systolicBp: 170,
              diastolicBp: 96,
              spo2: 95,
              gcs: 11,
              consciousness: 'PAIN',
            },
          },
        ],
        track: { route: 'mkToBvdk', stepMin: 3 },
      });
      await createRecord(
        tx,
        c,
        continuation({
          code: 'DEMO-KB-02',
          patient: 'phao',
          doctor: 'bs.minh',
          facility: 'DEMO-BVDK-15',
          specialty: 'NEUROSURGERY',
          visitAt: at(t1, 152),
          sourceReferralId: ref1,
          chiefComplaint: 'Chuyển tuyến từ Trạm Y tế Xã Mường Khương — chấn thương sọ não',
          symptoms:
            'Diễn biến trên xe: GCS giảm từ 13 xuống 11, đồng tử phải giãn 4mm, mạch chậm dần, HA tăng.',
          physicalExamination: 'GCS 11. Đồng tử P 4mm, T 3mm. Liệt nhẹ nửa người trái.',
          pulse: 74,
          systolicBp: 170,
          diastolicBp: 96,
          spo2: 95,
          diagnoses: [{ icdCode: 'S06.5', isPrimary: true }],
          diagnosisNote:
            'CT sọ: máu tụ dưới màng cứng cấp bán cầu phải dày 14mm, đẩy lệch đường giữa 8mm.',
          treatmentPlan: 'Mổ cấp cứu lấy máu tụ, mở sọ giải áp. Hậu phẫu tại khoa Hồi sức.',
        }),
      );

      // ── 2. Hành trình 2 chặng: tỉnh ổn định rồi chuyển tiếp lên Việt Đức (hôm qua) ─────────
      const t2 = vnAt(1, 9, 5, now);
      const rec3 = await createRecord(tx, c, {
        code: 'DEMO-KB-03',
        patient: 'my',
        doctor: 'bs.an',
        facility: 'DEMO-TYT-02761',
        visitAt: t2,
        encounterType: 'EMERGENCY',
        chiefComplaint: 'Ngã từ nương ruộng bậc thang cao khoảng 4m',
        symptoms: 'Ngã đập đầu và ngực phải xuống đá, khó thở tăng dần, lơ mơ.',
        physicalExamination:
          'GCS 12. Thở nhanh 30 lần/phút, rì rào phế nang phổi phải giảm, gõ vang. Vết thương da đầu vùng đỉnh 4cm.',
        pulse: 118,
        systolicBp: 100,
        diastolicBp: 60,
        respiratoryRate: 30,
        spo2: 88,
        weightKg: 48,
        diagnoses: [
          { icdCode: 'T07', isPrimary: true },
          { icdCode: 'S27.0', isPrimary: false },
          { icdCode: 'S06.6', isPrimary: false },
        ],
        diagnosisNote: 'Đa chấn thương: nghi tràn khí màng phổi phải, chấn thương sọ não.',
        treatmentPlan: 'Chuyển cấp cứu tuyến tỉnh, thở oxy mask, băng ép vết thương da đầu.',
        sign: true,
      });
      const ref3 = await createReferral(tx, c, {
        code: 'DEMO-CT-02',
        patient: 'my',
        sourceRecordId: rec3,
        from: 'DEMO-TYT-02761',
        to: 'DEMO-BVDK-15',
        referredBy: 'bs.an',
        escort: 'dd.hoa',
        priority: 'CRITICAL',
        status: 'ARRIVED',
        reason: 'T07 Đa chấn thương — nghi tràn khí màng phổi, chấn thương sọ não',
        clinicalSummary:
          'Nữ 30 tuổi ngã cao 4m. GCS 12, thở nhanh 30 lần/phút, SpO2 88% với oxy, mạch 118, HA 100/60.',
        initialTreatment: 'Thở oxy mask 8 lít/phút, băng ép vết thương đầu, truyền Ringer lactat.',
        createdAt: at(t2, 18),
        acceptedAt: at(t2, 21),
        acceptedBy: 'bs.binh',
        acceptanceType: 'STABILIZE_FORWARD',
        forwardNote:
          'Hết giường hồi sức ngoại thần kinh — dẫn lưu màng phổi, đặt nội khí quản, chụp CT rồi chuyển BV Việt Đức.',
        transportMode: 'PICKUP',
        vehicle: '24A-115.02',
        pickupRequestedAt: at(t2, 18),
        pickupAssignedAt: at(t2, 22),
        departedAt: at(t2, 75),
        etaMinutes: 75,
        arrivedAt: at(t2, 148),
        receivedBy: 'bs.binh',
        vitals: [
          {
            minute: 0,
            v: {
              pulse: 120,
              systolicBp: 98,
              diastolicBp: 60,
              spo2: 87,
              respiratoryRate: 30,
              gcs: 12,
            },
          },
          {
            minute: 20,
            v: {
              pulse: 124,
              systolicBp: 94,
              diastolicBp: 58,
              spo2: 86,
              respiratoryRate: 32,
              gcs: 12,
              note: 'Tăng oxy 10 lít/phút',
            },
          },
          {
            minute: 40,
            v: {
              pulse: 122,
              systolicBp: 96,
              diastolicBp: 60,
              spo2: 88,
              respiratoryRate: 30,
              gcs: 12,
            },
          },
          {
            minute: 60,
            v: {
              pulse: 118,
              systolicBp: 100,
              diastolicBp: 62,
              spo2: 89,
              respiratoryRate: 28,
              gcs: 12,
            },
          },
        ],
        track: { route: 'mkToBvdk', stepMin: 3 },
      });
      const rec4 = await createRecord(
        tx,
        c,
        continuation({
          code: 'DEMO-KB-04',
          patient: 'my',
          doctor: 'bs.binh',
          facility: 'DEMO-BVDK-15',
          specialty: 'EMERGENCY_ICU',
          visitAt: at(t2, 148),
          sourceReferralId: ref3,
          chiefComplaint: 'Chuyển tuyến từ Trạm Y tế Xã Mường Khương — đa chấn thương',
          symptoms: 'Trên xe SpO2 86–89%, mạch 118–124.',
          physicalExamination:
            'Đã dẫn lưu màng phổi phải ra khí và 200ml máu, SpO2 lên 96%. GCS 11, đặt nội khí quản bảo vệ đường thở.',
          pulse: 104,
          systolicBp: 110,
          diastolicBp: 70,
          spo2: 96,
          diagnoses: [
            { icdCode: 'T07', isPrimary: true },
            { icdCode: 'S27.0', isPrimary: false },
            { icdCode: 'S06.6', isPrimary: false },
          ],
          diagnosisNote:
            'CT: xuất huyết dưới nhện lan toả, đụng dập thuỳ trán. Tràn khí màng phổi P đã dẫn lưu.',
          treatmentPlan:
            'Đã ổn định hô hấp, tuần hoàn. Chuyển tiếp BV Việt Đức theo dõi, can thiệp ngoại thần kinh.',
        }),
      );
      const ref4 = await createReferral(tx, c, {
        code: 'DEMO-CT-03',
        patient: 'my',
        sourceRecordId: rec4,
        from: 'DEMO-BVDK-15',
        to: 'DEMO-BV-VIETDUC',
        referredBy: 'bs.binh',
        escort: 'bs.minh',
        priority: 'URGENT',
        status: 'ARRIVED',
        requiredSpecialty: 'NEUROSURGERY',
        reason: 'Chuyển tiếp theo kế hoạch: theo dõi, can thiệp ngoại thần kinh sau ổn định',
        clinicalSummary:
          'Đa chấn thương, đã dẫn lưu màng phổi P và đặt nội khí quản. Xuất huyết dưới nhện, đụng dập trán. Huyết động ổn.',
        initialTreatment: 'Thở máy qua NKQ, an thần Midazolam, dẫn lưu màng phổi kín.',
        createdAt: at(t2, 260),
        acceptedAt: at(t2, 266),
        acceptedBy: 'bs.duc',
        acceptanceType: 'READY',
        preparationNote: 'Giường Hồi sức ngoại số 12, kíp mổ thần kinh trực.',
        transportMode: 'FACILITY_VEHICLE',
        vehicle: '24A-115.01',
        departedAt: at(t2, 275),
        etaMinutes: 270,
        arrivedAt: at(t2, 545),
        receivedBy: 'bs.duc',
        vitals: [0, 45, 90, 135, 180, 225, 265].map((minute, i) => ({
          minute,
          v: {
            pulse: 102 - i * 2,
            systolicBp: 112 + (i % 2) * 4,
            diastolicBp: 70,
            spo2: 96 + (i > 3 ? 1 : 0),
            respiratoryRate: 16,
            consciousness: 'UNRESPONSIVE' as const,
            note: i === 0 ? 'Thở máy, an thần' : undefined,
          },
        })),
        track: { route: 'bvdkToVietDuc', stepMin: 6 },
      });
      await createRecord(
        tx,
        c,
        continuation({
          code: 'DEMO-KB-05',
          patient: 'my',
          doctor: 'bs.duc',
          facility: 'DEMO-BV-VIETDUC',
          specialty: 'NEUROSURGERY',
          visitAt: at(t2, 545),
          sourceReferralId: ref4,
          chiefComplaint:
            'Chuyển tuyến từ Bệnh viện Đa khoa Tỉnh Lào Cai — đa chấn thương, chặng 2',
          symptoms: 'Hành trình 2 chặng: TYT Mường Khương → BVĐK Lào Cai (ổn định) → BV Việt Đức.',
          pulse: 90,
          systolicBp: 118,
          diastolicBp: 72,
          spo2: 97,
          diagnoses: [
            { icdCode: 'S06.6', isPrimary: true },
            { icdCode: 'S27.0', isPrimary: false },
          ],
          diagnosisNote: 'Xuất huyết dưới nhện, đụng dập thuỳ trán, chưa có chỉ định mổ.',
          treatmentPlan: 'Điều trị bảo tồn tại Hồi sức ngoại, chụp CT kiểm tra sau 24 giờ.',
        }),
      );

      // ── 3. Ca thường bị đề nghị chuyển → gửi đúng nơi (5 ngày trước) ─────────────────────
      const t3 = vnAt(5, 8, 30, now);
      const rec6 = await createRecord(tx, c, {
        code: 'DEMO-KB-06',
        patient: 'thang',
        doctor: 'bs.lan',
        facility: 'DEMO-TYT-02683',
        specialty: 'GENERAL_INTERNAL',
        visitAt: t3,
        chiefComplaint: 'Đau háng phải, không đi lại được sau ngã trong nhà',
        symptoms: 'Trượt chân ngã đập hông phải 2 ngày trước, đau tăng, không tự đứng dậy được.',
        physicalExamination: 'Chân phải ngắn, xoay ngoài. Ấn đau vùng bẹn phải. Mạch mu chân rõ.',
        pulse: 84,
        systolicBp: 145,
        diastolicBp: 85,
        temperature: 36.8,
        spo2: 97,
        diagnoses: [{ icdCode: 'S72.0', isPrimary: true }],
        diagnosisNote: 'Nghi gãy cổ xương đùi phải trên nền loãng xương.',
        treatmentPlan: 'Bất động, giảm đau, chuyển tuyến trên phẫu thuật.',
        prescription: [
          {
            drugName: 'Paracetamol',
            strength: '500mg',
            quantity: 10,
            unit: 'viên',
            instructions: 'Uống 1 viên khi đau, cách nhau 6 giờ',
          },
        ],
        sign: true,
      });
      await createReferral(tx, c, {
        code: 'DEMO-CT-04',
        patient: 'thang',
        sourceRecordId: rec6,
        from: 'DEMO-TYT-02683',
        to: 'DEMO-BVDK-15',
        referredBy: 'bs.lan',
        priority: 'ROUTINE',
        status: 'REJECTED',
        requiredSpecialty: 'ORTHOPEDICS_TRAUMA',
        reason: 'S72.0 Gãy cổ xương đùi — cần phẫu thuật thay khớp háng',
        clinicalSummary: 'Nam 70 tuổi, gãy cổ xương đùi phải sau ngã, tỉnh, huyết động ổn.',
        createdAt: at(t3, 35),
        acceptedAt: at(t3, 55),
        acceptedBy: 'bs.binh',
        rejectionReason:
          'Bệnh viện chưa triển khai thay khớp háng toàn phần; BV Việt Đức có chuyên khoa này.',
        redirectCategory: 'NO_SPECIALTY',
        redirectFacility: 'DEMO-BV-VIETDUC',
        transportMode: 'FAMILY',
        transportNote: 'Gia đình tự thuê xe',
      });
      const ref7 = await createReferral(tx, c, {
        code: 'DEMO-CT-05',
        patient: 'thang',
        sourceRecordId: rec6,
        from: 'DEMO-TYT-02683',
        to: 'DEMO-BV-VIETDUC',
        referredBy: 'bs.lan',
        priority: 'ROUTINE',
        status: 'ARRIVED',
        requiredSpecialty: 'ORTHOPEDICS_TRAUMA',
        reason: 'S72.0 Gãy cổ xương đùi — chuyển theo đề nghị của BVĐK Lào Cai',
        clinicalSummary: 'Nam 70 tuổi, gãy cổ xương đùi phải sau ngã, tỉnh, huyết động ổn.',
        createdAt: at(t3, 70),
        acceptedAt: at(t3, 95),
        acceptedBy: 'bs.duc',
        acceptanceType: 'READY',
        preparationNote: 'Hẹn khoa Chấn thương chỉnh hình, nhập viện qua cấp cứu.',
        transportMode: 'FAMILY',
        vehicleInfo: 'Xe gia đình thuê',
        departedAt: at(t3, 120),
        etaMinutes: 330,
        arrivedAt: at(t3, 470),
        receivedBy: 'bs.duc',
      });
      await createRecord(
        tx,
        c,
        continuation({
          code: 'DEMO-KB-07',
          patient: 'thang',
          doctor: 'bs.duc',
          facility: 'DEMO-BV-VIETDUC',
          specialty: 'ORTHOPEDICS_TRAUMA',
          visitAt: at(t3, 470),
          sourceReferralId: ref7,
          chiefComplaint: 'Chuyển tuyến từ Trạm Y tế Xã Bát Xát — gãy cổ xương đùi phải',
          diagnoses: [{ icdCode: 'S72.0', isPrimary: true }],
          diagnosisNote: 'X-quang: gãy cổ xương đùi phải Garden IV.',
          treatmentPlan: 'Phẫu thuật thay khớp háng bán phần theo lịch.',
        }),
      );

      // ── 4. Hàng đợi hôm nay (demo trực tiếp) ─────────────────────────────────────────────
      await createRecord(tx, c, {
        code: 'DEMO-KB-08',
        patient: 'chu',
        doctor: 'bs.an',
        facility: 'DEMO-TYT-02761',
        specialty: 'GENERAL_INTERNAL',
        visitAt: at(now, -12),
        encounterType: 'EMERGENCY',
        chiefComplaint: 'Tai nạn giao thông, đau đầu, lơ mơ',
        symptoms:
          'Va chạm xe máy với ô tô tải trên QL4D khoảng 30 phút trước. Bất tỉnh 10 phút tại chỗ, người dân đưa vào trạm.',
        physicalExamination:
          'GCS 12 (E3V4M5). Đồng tử P 3,5mm, T 3mm. Tụ máu dưới da đầu vùng thái dương - đỉnh phải. Chảy máu mũi.',
        pulse: 102,
        systolicBp: 158,
        diastolicBp: 94,
        respiratoryRate: 22,
        spo2: 93,
        temperature: 36.5,
        weightKg: 58,
        diagnoses: [{ icdCode: 'S06.5', isPrimary: true }],
        diagnosisNote: 'Chấn thương sọ não, nghi máu tụ nội sọ. Dị ứng Cephalosporin.',
      });
      const appt = await tx.appointment.create({
        data: {
          code: 'DEMO-LH-01',
          patientId: c.patient('dung'),
          facilityId: c.facility('DEMO-TYT-02761'),
          specialtyId: c.specialty('PEDIATRICS'),
          startAt: vnAt(0, 7, 30, now),
          endAt: vnAt(0, 7, 45, now),
          reason: 'Bé sốt cao, ho, thở nhanh',
          initialSymptoms: 'Sốt 39°C 3 ngày, ho có đờm, bỏ bú',
          status: 'CHECKED_IN',
          confirmedAt: vnAt(1, 20, 0, now),
          checkedInAt: vnAt(0, 7, 25, now),
          handledById: c.user('bs.an'),
        },
      });
      await createRecord(tx, c, {
        code: 'DEMO-KB-09',
        patient: 'dung',
        doctor: 'bs.an',
        facility: 'DEMO-TYT-02761',
        specialty: 'PEDIATRICS',
        appointmentId: appt.id,
        visitAt: vnAt(0, 7, 30, now),
        chiefComplaint: 'Sốt cao, ho, thở nhanh 3 ngày',
        symptoms: 'Sốt 39°C, ho có đờm, bỏ bú, quấy khóc.',
        physicalExamination: 'Thở nhanh 48 lần/phút, rút lõm lồng ngực nhẹ, ran ẩm 2 đáy phổi.',
        pulse: 140,
        temperature: 39.2,
        respiratoryRate: 48,
        spo2: 92,
        weightKg: 16,
        diagnoses: [{ icdCode: 'J18.9', isPrimary: true }],
        diagnosisNote: 'Viêm phổi trẻ em, có dấu hiệu suy hô hấp nhẹ (SpO2 92%).',
      });

      // ── 5. Lịch hẹn hôm nay & ngày mai ──────────────────────────────────────────────────
      const appointments: Prisma.AppointmentCreateManyInput[] = [
        {
          code: 'DEMO-LH-02',
          patientId: c.patient('cuong'),
          facilityId: c.facility('DEMO-TYT-02761'),
          specialtyId: c.specialty('GENERAL_INTERNAL'),
          startAt: vnAt(0, 14, 0, now),
          endAt: vnAt(0, 14, 15, now),
          reason: 'Tái khám tăng huyết áp, lấy thuốc',
          status: 'CONFIRMED',
          confirmedAt: vnAt(1, 16, 0, now),
          handledById: c.user('bs.an'),
        },
        {
          code: 'DEMO-LH-03',
          patientId: c.patient('sinh'),
          facilityId: c.facility('DEMO-TYT-02683'),
          specialtyId: c.specialty('GENERAL_INTERNAL'),
          startAt: vnAt(0, 15, 0, now),
          endAt: vnAt(0, 15, 15, now),
          reason: 'Khám thai định kỳ tuần 28',
          status: 'PENDING',
        },
        {
          code: 'DEMO-LH-04',
          patientId: c.patient('phao'),
          facilityId: c.facility('DEMO-TYT-02761'),
          startAt: vnAt(-1, 8, 0, now),
          endAt: vnAt(-1, 8, 15, now),
          reason: 'Thay băng, cắt chỉ vết mổ sau ra viện',
          status: 'PENDING',
        },
        {
          code: 'DEMO-LH-05',
          patientId: c.patient('cuong'),
          facilityId: c.facility('DEMO-BVDK-15'),
          specialtyId: c.specialty('CARDIOLOGY'),
          startAt: vnAt(-1, 9, 0, now),
          endAt: vnAt(-1, 9, 15, now),
          reason: 'Tái khám tim mạch sau 1 tháng dùng Bisoprolol',
          status: 'PENDING',
        },
      ];
      await tx.appointment.createMany({ data: appointments });
    },
    { timeout: 60_000 },
  );
  return '3 ca chuyển tuyến đã hoàn tất (1 ca 2 chặng), 2 ca trong hàng đợi hôm nay, 5 lịch hẹn';
}

/**
 * Xoá mọi dữ liệu phát sinh khi diễn tập ở các cơ sở và bệnh nhân demo: phiếu chuyển tuyến, hồ sơ
 * (trừ lịch sử gốc `DEMO-BA-*` của Lò Văn Cường), lịch hẹn. Đồng thời trả xe, giường và trạng thái trực
 * về mặc định. Không đụng tới dữ liệu giả lập thống kê (mã `SIM…`).
 */
export async function resetDemoScenarios(prisma: PrismaClient) {
  const facilityIds = (
    await prisma.healthFacility.findMany({
      where: { code: { startsWith: 'DEMO-' } },
      select: { id: true },
    })
  ).map((f) => f.id);
  const patientIds = (
    await prisma.patient.findMany({
      where: { nationalId: { in: DEMO_PATIENT_IDS } },
      select: { id: true },
    })
  ).map((p) => p.id);
  const notSim = { NOT: { code: { startsWith: 'SIM' } } };
  const touches = (field: 'fromFacilityId' | 'facilityId') => [
    { patientId: { in: patientIds } },
    { [field]: { in: facilityIds } },
  ];
  return prisma.$transaction(async (tx) => {
    const referrals = await tx.referral.deleteMany({
      where: {
        ...notSim,
        OR: [...touches('fromFacilityId'), { toFacilityId: { in: facilityIds } }],
      },
    });
    const records = await tx.medicalRecord.deleteMany({
      where: {
        ...notSim,
        NOT: { code: { startsWith: 'DEMO-BA-' } },
        OR: touches('facilityId'),
      },
    });
    const appointments = await tx.appointment.deleteMany({
      where: { ...notSim, OR: touches('facilityId') },
    });
    await tx.vehicle.updateMany({
      where: { facilityId: { in: facilityIds } },
      data: { status: 'AVAILABLE' },
    });
    return { referrals: referrals.count, records: records.count, appointments: appointments.count };
  });
}
