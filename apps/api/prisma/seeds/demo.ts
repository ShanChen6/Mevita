/**
 * Tài khoản & cơ sở y tế DEMO cho môi trường phát triển. Ở production chỉ chạy khi bật rõ ràng
 * `SEED_DEMO=true` và đặt `SEED_DEMO_PASSWORD` riêng (bản demo trực tuyến cho buổi bảo vệ).
 * Kịch bản: Trạm Y tế Xã Mường Khương (Lào Cai) → BVĐK Tỉnh Lào Cai → BV Hữu nghị Việt Đức (Hà Nội).
 * Bộ dữ liệu mẫu đầy đủ cho buổi bảo vệ sẽ làm ở Task 6.2.
 */
import { hashPassword } from '../../src/auth/password.js';
import { computeRecordSignature } from '../../src/medical-records/signature.js';
import type {
  FacilityLevel,
  FacilityType,
  PrismaClient,
  StaffPosition,
  UserRole,
} from '../../src/generated/prisma/client.js';

/** Giờ làm việc mặc định: T2–T6 07:30–11:30 & 13:30–16:30, T7 07:30–11:30 */
const DEFAULT_OPENING_HOURS = [1, 2, 3, 4, 5, 6].flatMap((dayOfWeek) => [
  { dayOfWeek, startMinute: 7 * 60 + 30, endMinute: 11 * 60 + 30 },
  ...(dayOfWeek < 6 ? [{ dayOfWeek, startMinute: 13 * 60 + 30, endMinute: 16 * 60 + 30 }] : []),
]);

const demoVehicles: {
  facility: string;
  plateNumber: string;
  type: 'ADVANCED_AMBULANCE' | 'BASIC_AMBULANCE' | 'TRANSPORT';
  equipment: string;
  driverName: string;
  driverPhone: string;
}[] = [
  {
    facility: 'DEMO-TYT-02761',
    plateNumber: '24C-008.88',
    type: 'TRANSPORT',
    equipment: 'Xe bán tải, cáng gấp',
    driverName: 'Vàng A Sùng',
    driverPhone: '0900000201',
  },
  {
    facility: 'DEMO-BVDK-15',
    plateNumber: '24A-115.01',
    type: 'ADVANCED_AMBULANCE',
    equipment: 'Máy thở, monitor, bơm tiêm điện, oxy',
    driverName: 'Đinh Văn Tài',
    driverPhone: '0900000115',
  },
  {
    facility: 'DEMO-BVDK-15',
    plateNumber: '24A-115.02',
    type: 'BASIC_AMBULANCE',
    equipment: 'Cáng, oxy, túi sơ cứu',
    driverName: 'Lò Văn Hùng',
    driverPhone: '0900000116',
  },
  {
    facility: 'DEMO-BV-VIETDUC',
    plateNumber: '29A-115.68',
    type: 'ADVANCED_AMBULANCE',
    equipment: 'Máy thở, monitor, máy sốc điện',
    driverName: 'Nguyễn Văn Bình',
    driverPhone: '0900000117',
  },
];

const facilities: {
  code: string;
  name: string;
  type: FacilityType;
  level: FacilityLevel;
  communeCode: string;
  acceptsReferrals: boolean;
  /** Số giả lập cho demo */
  emergencyPhone: string;
  /** Toạ độ gần đúng (theo vị trí xã/phường) — dùng cho theo dõi xe */
  latitude: number;
  longitude: number;
  specialties: string[];
}[] = [
  {
    code: 'DEMO-TYT-02761',
    name: 'Trạm Y tế Xã Mường Khương',
    type: 'COMMUNE_HEALTH_STATION',
    level: 'PRIMARY',
    communeCode: '02761',
    acceptsReferrals: false,
    emergencyPhone: '0900 333 115',
    latitude: 22.7676,
    longitude: 104.1236,
    specialties: ['GENERAL_INTERNAL', 'PEDIATRICS', 'FAMILY_MEDICINE'],
  },
  {
    code: 'DEMO-BVDK-15',
    name: 'Bệnh viện Đa khoa Tỉnh Lào Cai',
    type: 'PROVINCIAL_GENERAL_HOSPITAL',
    level: 'BASIC',
    communeCode: '02647', // Phường Lào Cai
    acceptsReferrals: true,
    emergencyPhone: '0900 111 115',
    latitude: 22.4127,
    longitude: 104.0226,
    specialties: ['EMERGENCY_ICU', 'GENERAL_SURGERY', 'NEUROSURGERY', 'CARDIOLOGY', 'PEDIATRICS'],
  },
  {
    code: 'DEMO-BV-VIETDUC',
    name: 'Bệnh viện Hữu nghị Việt Đức',
    type: 'CENTRAL_HOSPITAL',
    level: 'SPECIALIZED',
    communeCode: '00082', // Phường Cửa Nam, Hà Nội
    acceptsReferrals: true,
    emergencyPhone: '0900 222 115',
    latitude: 21.0285,
    longitude: 105.8472,
    specialties: ['EMERGENCY_ICU', 'NEUROSURGERY', 'ORTHOPEDICS_TRAUMA', 'GENERAL_SURGERY'],
  },
];

const staff: {
  email: string;
  phone: string;
  fullName: string;
  role: UserRole;
  facilityCode?: string;
  position?: StaffPosition;
  specialty?: string;
  academicTitle?: string;
}[] = [
  { email: 'admin@mevita.vn', phone: '0900000001', fullName: 'Quản trị Mevita', role: 'ADMIN' },
  {
    email: 'bs.an@mevita.vn',
    phone: '0900000002',
    fullName: 'Nguyễn Văn An',
    role: 'COMMUNE_STAFF',
    facilityCode: 'DEMO-TYT-02761',
    position: 'DOCTOR',
    specialty: 'GENERAL_INTERNAL',
    academicTitle: 'BS',
  },
  {
    email: 'dd.hoa@mevita.vn',
    phone: '0900000003',
    fullName: 'Lý Thị Hoa',
    role: 'COMMUNE_STAFF',
    facilityCode: 'DEMO-TYT-02761',
    position: 'NURSE',
    academicTitle: 'ĐD',
  },
  {
    email: 'bs.binh@mevita.vn',
    phone: '0900000004',
    fullName: 'Trần Thị Bình',
    role: 'PROVINCE_STAFF',
    facilityCode: 'DEMO-BVDK-15',
    position: 'DOCTOR',
    specialty: 'EMERGENCY_ICU',
    academicTitle: 'BSCKII',
  },
  {
    email: 'bs.minh@mevita.vn',
    phone: '0900000006',
    fullName: 'Lê Văn Minh',
    role: 'PROVINCE_STAFF',
    facilityCode: 'DEMO-BVDK-15',
    position: 'DOCTOR',
    specialty: 'NEUROSURGERY',
    academicTitle: 'BSCKI',
  },
  {
    email: 'bs.duc@mevita.vn',
    phone: '0900000005',
    fullName: 'Hoàng Minh Đức',
    role: 'PROVINCE_STAFF',
    facilityCode: 'DEMO-BV-VIETDUC',
    position: 'DOCTOR',
    specialty: 'NEUROSURGERY',
    academicTitle: 'TS.BS',
  },
];

const demoPatient = {
  email: 'cuong@mevita.vn',
  phone: '0912345678',
  fullName: 'Lò Văn Cường',
  dateOfBirth: new Date('1990-05-01'),
  nationalId: '010090001234',
  healthInsuranceNumber: 'DN4010090001234',
};

export async function seedDemo(prisma: PrismaClient) {
  const production = process.env.NODE_ENV === 'production';
  if (production && process.env.SEED_DEMO !== 'true') {
    console.log('↷ Bỏ qua dữ liệu demo (NODE_ENV=production; đặt SEED_DEMO=true để tạo bản demo)');
    return;
  }
  if (production && (!process.env.SEED_DEMO_PASSWORD || process.env.SEED_DEMO_PASSWORD.length < 10))
    throw new Error('Demo ở production cần SEED_DEMO_PASSWORD riêng, tối thiểu 10 ký tự');
  const password = process.env.SEED_DEMO_PASSWORD ?? 'Mevita@2026';
  const passwordHash = await hashPassword(password);
  const specialtyIds = new Map(
    (await prisma.specialty.findMany({ select: { id: true, code: true } })).map((s) => [
      s.code,
      s.id,
    ]),
  );

  const facilityIds = new Map<string, string>();
  for (const { specialties, ...f } of facilities) {
    const facility = await prisma.healthFacility.upsert({
      where: { code: f.code },
      create: f,
      update: {
        name: f.name,
        type: f.type,
        level: f.level,
        communeCode: f.communeCode,
        acceptsReferrals: f.acceptsReferrals,
        emergencyPhone: f.emergencyPhone,
        latitude: f.latitude,
        longitude: f.longitude,
      },
    });
    facilityIds.set(f.code, facility.id);
    if ((await prisma.facilityOpeningHours.count({ where: { facilityId: facility.id } })) === 0) {
      await prisma.facilityOpeningHours.createMany({
        data: DEFAULT_OPENING_HOURS.map((h) => ({ ...h, facilityId: facility.id })),
      });
    }
    await prisma.facilitySpecialty.createMany({
      data: specialties.map((code) => ({
        facilityId: facility.id,
        specialtyId: specialtyIds.get(code)!,
      })),
      skipDuplicates: true,
    });
  }
  // Xe chuyển viện (Task C): trạm chỉ có xe bán tải → ca cấp cứu nên yêu cầu xe đón
  for (const v of demoVehicles) {
    const { facility, ...data } = v;
    await prisma.vehicle.upsert({
      where: { plateNumber: v.plateNumber },
      create: { ...data, facilityId: facilityIds.get(facility)! },
      update: { ...data, facilityId: facilityIds.get(facility)! },
    });
  }

  for (const s of staff) {
    const facilityId = s.facilityCode ? facilityIds.get(s.facilityCode)! : undefined;
    const profile =
      facilityId && s.position
        ? {
            facilityId,
            position: s.position,
            academicTitle: s.academicTitle,
            specialtyId: s.specialty ? specialtyIds.get(s.specialty) : undefined,
          }
        : undefined;
    await prisma.user.upsert({
      where: { email: s.email },
      create: {
        email: s.email,
        phone: s.phone,
        fullName: s.fullName,
        role: s.role,
        passwordHash,
        ...(profile && { staffProfile: { create: profile } }),
      },
      update: {
        fullName: s.fullName,
        role: s.role,
        passwordHash,
        isActive: true,
        ...(profile && { staffProfile: { upsert: { create: profile, update: profile } } }),
      },
    });
  }

  await prisma.user.upsert({
    where: { email: demoPatient.email },
    create: {
      email: demoPatient.email,
      phone: demoPatient.phone,
      fullName: demoPatient.fullName,
      role: 'PATIENT',
      passwordHash,
      patient: {
        create: {
          fullName: demoPatient.fullName,
          dateOfBirth: demoPatient.dateOfBirth,
          gender: 'MALE',
          nationalId: demoPatient.nationalId,
          healthInsuranceNumber: demoPatient.healthInsuranceNumber,
          phone: demoPatient.phone,
          communeCode: '02761',
          addressDetail: 'Thôn Pạc Bo',
          bloodType: 'O_POSITIVE',
          allergies: 'Penicillin',
          chronicConditions: 'Tăng huyết áp',
        },
      },
    },
    update: { passwordHash, isActive: true },
  });

  const records = await seedDemoHistory(prisma, facilityIds, specialtyIds);
  console.log(
    `✔ Demo: ${facilities.length} cơ sở y tế, ${staff.length + 1} tài khoản (mật khẩu: SEED_DEMO_PASSWORD), ${records} hồ sơ khám`,
  );
}

/** Một số mã ICD-10 dùng trong dữ liệu demo (danh mục đầy đủ nạp ở Task 3.2). */
const demoIcd10 = [
  {
    code: 'I10',
    nameVi: 'Bệnh lý tăng huyết áp vô căn (nguyên phát)',
    nameEn: 'Essential (primary) hypertension',
    chapter: 'IX',
  },
  { code: 'R00.2', nameVi: 'Đánh trống ngực', nameEn: 'Palpitations', chapter: 'XVIII' },
  { code: 'R51', nameVi: 'Đau đầu', nameEn: 'Headache', chapter: 'XVIII' },
  {
    code: 'J06.9',
    nameVi: 'Nhiễm trùng đường hô hấp trên cấp, không đặc hiệu',
    nameEn: 'Acute upper respiratory infection, unspecified',
    chapter: 'X',
  },
];

interface DemoRecord {
  code: string;
  facility: string;
  doctorEmail: string;
  specialty: string;
  visitAt: string;
  chiefComplaint: string;
  symptoms: string;
  vitals: {
    pulse: number;
    temperature: number;
    systolicBp: number;
    diastolicBp: number;
    respiratoryRate: number;
    spo2: number;
  };
  diagnoses: { icdCode: string; isPrimary: boolean }[];
  diagnosisNote: string;
  treatmentPlan: string;
  prescription: {
    drugName: string;
    strength: string;
    quantity: number;
    unit: string;
    instructions: string;
    durationDays: number;
  }[];
}

const demoRecords: DemoRecord[] = [
  {
    code: 'DEMO-BA-2603-01',
    facility: 'DEMO-TYT-02761',
    doctorEmail: 'bs.an@mevita.vn',
    specialty: 'GENERAL_INTERNAL',
    visitAt: '2026-03-18T09:10:00+07:00',
    chiefComplaint: 'Ho, sốt 2 ngày',
    symptoms: 'Sốt 38,4°C, ho khan, đau họng, sổ mũi.',
    vitals: {
      pulse: 92,
      temperature: 38.4,
      systolicBp: 125,
      diastolicBp: 80,
      respiratoryRate: 20,
      spo2: 97,
    },
    diagnoses: [{ icdCode: 'J06.9', isPrimary: true }],
    diagnosisNote: 'Viêm đường hô hấp trên cấp, chưa có dấu hiệu viêm phổi.',
    treatmentPlan: 'Uống nhiều nước, nghỉ ngơi. Tái khám nếu sốt cao trên 3 ngày hoặc khó thở.',
    prescription: [
      {
        drugName: 'Paracetamol',
        strength: '500mg',
        quantity: 10,
        unit: 'viên',
        instructions: 'Uống 1 viên khi sốt trên 38,5°C, cách nhau ít nhất 6 giờ',
        durationDays: 3,
      },
    ],
  },
  {
    code: 'DEMO-BA-2610-01',
    facility: 'DEMO-TYT-02761',
    doctorEmail: 'bs.an@mevita.vn',
    specialty: 'GENERAL_INTERNAL',
    visitAt: '2026-10-05T07:45:00+07:00',
    chiefComplaint: 'Đau đầu, chóng mặt',
    symptoms: 'Đau đầu vùng chẩm buổi sáng khoảng 1 tuần, chóng mặt khi đứng dậy.',
    vitals: {
      pulse: 88,
      temperature: 36.6,
      systolicBp: 160,
      diastolicBp: 100,
      respiratoryRate: 18,
      spo2: 98,
    },
    diagnoses: [
      { icdCode: 'I10', isPrimary: true },
      { icdCode: 'R51', isPrimary: false },
    ],
    diagnosisNote: 'Tăng huyết áp độ 2, lần đầu phát hiện.',
    treatmentPlan:
      'Ăn nhạt, hạn chế rượu bia. Đo huyết áp tại nhà mỗi sáng. Chuyển khám chuyên khoa tim mạch.',
    prescription: [
      {
        drugName: 'Amlodipin',
        strength: '5mg',
        quantity: 30,
        unit: 'viên',
        instructions: 'Uống 1 viên mỗi sáng',
        durationDays: 30,
      },
    ],
  },
  {
    code: 'DEMO-BA-2611-01',
    facility: 'DEMO-BVDK-15',
    doctorEmail: 'bs.binh@mevita.vn',
    specialty: 'CARDIOLOGY',
    visitAt: '2026-11-10T08:20:00+07:00',
    chiefComplaint: 'Hồi hộp, đánh trống ngực',
    symptoms: 'Hồi hộp từng cơn, đang điều trị tăng huyết áp bằng Amlodipin 5mg.',
    vitals: {
      pulse: 96,
      temperature: 36.8,
      systolicBp: 150,
      diastolicBp: 95,
      respiratoryRate: 18,
      spo2: 98,
    },
    diagnoses: [
      { icdCode: 'I10', isPrimary: true },
      { icdCode: 'R00.2', isPrimary: false },
    ],
    diagnosisNote:
      'Tăng huyết áp chưa kiểm soát tốt, nhịp nhanh xoang. Điện tim không thấy rối loạn nhịp.',
    treatmentPlan: 'Phối hợp thêm Bisoprolol. Tái khám sau 1 tháng.',
    prescription: [
      {
        drugName: 'Amlodipin',
        strength: '5mg',
        quantity: 30,
        unit: 'viên',
        instructions: 'Uống 1 viên mỗi sáng',
        durationDays: 30,
      },
      {
        drugName: 'Bisoprolol',
        strength: '2,5mg',
        quantity: 30,
        unit: 'viên',
        instructions: 'Uống 1 viên sau ăn sáng',
        durationDays: 30,
      },
    ],
  },
];

/** Lịch sử khám (đã ký) của bệnh nhân demo. Bỏ qua hồ sơ đã tồn tại theo mã. */
async function seedDemoHistory(
  prisma: PrismaClient,
  facilityIds: Map<string, string>,
  specialtyIds: Map<string, string>,
): Promise<number> {
  for (const icd of demoIcd10) {
    await prisma.icd10Code.upsert({ where: { code: icd.code }, create: icd, update: {} });
  }
  const patient = await prisma.patient.findUniqueOrThrow({
    where: { nationalId: demoPatient.nationalId },
  });
  const doctors = new Map(
    (await prisma.user.findMany({ where: { email: { in: staff.map((s) => s.email) } } })).map(
      (u) => [u.email!, u.id],
    ),
  );

  for (const r of demoRecords) {
    if (await prisma.medicalRecord.findUnique({ where: { code: r.code }, select: { id: true } }))
      continue;
    await prisma.$transaction(async (tx) => {
      const record = await tx.medicalRecord.create({
        data: {
          code: r.code,
          patientId: patient.id,
          doctorId: doctors.get(r.doctorEmail)!,
          facilityId: facilityIds.get(r.facility)!,
          specialtyId: specialtyIds.get(r.specialty),
          visitAt: new Date(r.visitAt),
          chiefComplaint: r.chiefComplaint,
          symptoms: r.symptoms,
          ...r.vitals,
          diagnosisNote: r.diagnosisNote,
          treatmentPlan: r.treatmentPlan,
          diagnoses: { create: r.diagnoses },
          prescriptionItems: { create: r.prescription.map((p, i) => ({ ...p, sortOrder: i })) },
        },
      });
      const signatureHash = computeRecordSignature({
        ...record,
        diagnoses: r.diagnoses,
        prescriptionItems: r.prescription,
      });
      await tx.medicalRecord.update({
        where: { id: record.id },
        data: { status: 'FINALIZED', signedAt: record.visitAt, signatureHash },
      });
    });
  }
  return demoRecords.length;
}
