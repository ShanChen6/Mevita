/**
 * Tài khoản & cơ sở y tế DEMO cho môi trường phát triển (không chạy khi NODE_ENV=production).
 * Kịch bản: Trạm Y tế Xã Mường Khương (Lào Cai) → BVĐK Tỉnh Lào Cai → BV Hữu nghị Việt Đức (Hà Nội).
 * Bộ dữ liệu mẫu đầy đủ cho buổi bảo vệ sẽ làm ở Task 6.2.
 */
import { hashPassword } from '../../src/auth/password.js';
import type {
  FacilityLevel,
  FacilityType,
  PrismaClient,
  StaffPosition,
  UserRole,
} from '../../src/generated/prisma/client.js';

const facilities: {
  code: string;
  name: string;
  type: FacilityType;
  level: FacilityLevel;
  communeCode: string;
  acceptsReferrals: boolean;
  specialties: string[];
}[] = [
  {
    code: 'DEMO-TYT-02761',
    name: 'Trạm Y tế Xã Mường Khương',
    type: 'COMMUNE_HEALTH_STATION',
    level: 'PRIMARY',
    communeCode: '02761',
    acceptsReferrals: false,
    specialties: ['GENERAL_INTERNAL', 'PEDIATRICS', 'FAMILY_MEDICINE'],
  },
  {
    code: 'DEMO-BVDK-15',
    name: 'Bệnh viện Đa khoa Tỉnh Lào Cai',
    type: 'PROVINCIAL_GENERAL_HOSPITAL',
    level: 'BASIC',
    communeCode: '02647', // Phường Lào Cai
    acceptsReferrals: true,
    specialties: ['EMERGENCY_ICU', 'GENERAL_SURGERY', 'NEUROSURGERY', 'CARDIOLOGY', 'PEDIATRICS'],
  },
  {
    code: 'DEMO-BV-VIETDUC',
    name: 'Bệnh viện Hữu nghị Việt Đức',
    type: 'CENTRAL_HOSPITAL',
    level: 'SPECIALIZED',
    communeCode: '00082', // Phường Cửa Nam, Hà Nội
    acceptsReferrals: true,
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
  if (process.env.NODE_ENV === 'production') {
    console.log('↷ Bỏ qua dữ liệu demo (NODE_ENV=production)');
    return;
  }
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
      },
    });
    facilityIds.set(f.code, facility.id);
    await prisma.facilitySpecialty.createMany({
      data: specialties.map((code) => ({
        facilityId: facility.id,
        specialtyId: specialtyIds.get(code)!,
      })),
      skipDuplicates: true,
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

  console.log(
    `✔ Demo: ${facilities.length} cơ sở y tế, ${staff.length + 1} tài khoản (mật khẩu: SEED_DEMO_PASSWORD)`,
  );
}
