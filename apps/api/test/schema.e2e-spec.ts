/**
 * Kiểm tra schema & ràng buộc DB trên PostgreSQL thật.
 * Mỗi test chạy trong một transaction và luôn rollback — không để lại dữ liệu.
 * Cần DB đã migrate + seed; tự bỏ qua nếu không kết nối được.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../src/generated/prisma/client.js';

type Tx = Prisma.TransactionClient;

class Rollback extends Error {}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/** Chạy `fn` trong transaction rồi rollback, trả về kết quả của `fn`. */
async function inRollback<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  let result: T | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      result = await fn(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
  return result as T;
}

/** Chạy `fn` trong savepoint, trả về lỗi DB nếu có (để transaction ngoài vẫn dùng tiếp được). */
async function dbError(tx: Tx, fn: () => Promise<unknown>): Promise<string | null> {
  await tx.$executeRawUnsafe('SAVEPOINT sp');
  try {
    await fn();
    await tx.$executeRawUnsafe('RELEASE SAVEPOINT sp');
    return null;
  } catch (error) {
    await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT sp');
    return String((error as Error).message);
  }
}

let n = 0;
const uniq = () => `${Date.now().toString(36)}${(n++).toString(36)}`.toUpperCase().slice(-12);

/** Kịch bản: Trạm Y tế Xã Mường Khương (Lào Cai) chuyển tuyến lên BVĐK Tỉnh Lào Cai. */
async function buildScenario(tx: Tx) {
  const commune = await tx.commune.findUniqueOrThrow({ where: { code: '02761' } });
  const provinceSeat = await tx.commune.findFirstOrThrow({
    where: { provinceCode: '15', type: 'WARD' },
  });
  const neurosurgery = await tx.specialty.findUniqueOrThrow({ where: { code: 'NEUROSURGERY' } });

  const station = await tx.healthFacility.create({
    data: {
      code: `T${uniq()}`,
      name: 'Trạm Y tế Xã Mường Khương',
      type: 'COMMUNE_HEALTH_STATION',
      level: 'PRIMARY',
      communeCode: commune.code,
    },
  });
  const hospital = await tx.healthFacility.create({
    data: {
      code: `H${uniq()}`,
      name: 'Bệnh viện Đa khoa Tỉnh Lào Cai',
      type: 'PROVINCIAL_GENERAL_HOSPITAL',
      level: 'BASIC',
      communeCode: provinceSeat.code,
      acceptsReferrals: true,
      specialties: { create: { specialtyId: neurosurgery.id } },
    },
  });

  const staff = (name: string, role: 'COMMUNE_STAFF' | 'PROVINCE_STAFF', facilityId: string) =>
    tx.user.create({
      data: {
        email: `${uniq().toLowerCase()}@test.mevita`,
        passwordHash: 'x',
        fullName: name,
        role,
        staffProfile: { create: { facilityId, position: 'DOCTOR' } },
      },
    });
  const communeDoctor = await staff('BS. Nguyễn Văn An', 'COMMUNE_STAFF', station.id);
  const provinceDoctor = await staff('BS. Trần Thị Bình', 'PROVINCE_STAFF', hospital.id);

  const patient = await tx.patient.create({
    data: {
      fullName: 'Lò Văn Cường',
      dateOfBirth: new Date('1990-05-01'),
      gender: 'MALE',
      nationalId: `0${uniq().replace(/\D/g, '').padEnd(11, '7')}`.slice(0, 12),
      communeCode: commune.code,
    },
  });

  return { station, hospital, communeDoctor, provinceDoctor, patient, neurosurgery };
}

describe('Prisma schema (DB integration)', () => {
  let dbReady = false;

  beforeAll(async () => {
    try {
      dbReady = (await prisma.specialty.count()) > 0;
    } catch {
      dbReady = false;
    }
    if (!dbReady) console.warn('⚠️  Bỏ qua test schema: DB chưa sẵn sàng hoặc chưa seed.');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('dựng trọn luồng: lịch hẹn → khám → chuyển tuyến → nhật ký sinh tồn → tiếp nhận', async (ctx) => {
    if (!dbReady) return ctx.skip();

    const result = await inRollback(async (tx) => {
      const s = await buildScenario(tx);
      const start = new Date('2026-12-01T08:00:00+07:00');

      const appointment = await tx.appointment.create({
        data: {
          code: `LH${uniq()}`,
          patientId: s.patient.id,
          facilityId: s.station.id,
          doctorId: s.communeDoctor.id,
          startAt: start,
          endAt: new Date(start.getTime() + 15 * 60_000),
          reason: 'Đau đầu sau tai nạn',
        },
      });

      await tx.icd10Code.create({
        data: { code: 'S06.5', nameVi: 'Chấn thương máu tụ dưới màng cứng' },
      });
      const record = await tx.medicalRecord.create({
        data: {
          code: `BA${uniq()}`,
          patientId: s.patient.id,
          doctorId: s.communeDoctor.id,
          facilityId: s.station.id,
          appointmentId: appointment.id,
          encounterType: 'EMERGENCY',
          chiefComplaint: 'Chấn thương đầu do tai nạn giao thông',
          pulse: 110,
          systolicBp: 90,
          diastolicBp: 60,
          spo2: 92,
          diagnoses: { create: { icdCode: 'S06.5', isPrimary: true } },
          prescriptionItems: {
            create: {
              drugName: 'Natri clorid 0,9%',
              quantity: 1,
              unit: 'chai',
              instructions: 'Truyền tĩnh mạch',
            },
          },
        },
      });

      const referral = await tx.referral.create({
        data: {
          code: `CT${uniq()}`,
          patientId: s.patient.id,
          sourceRecordId: record.id,
          fromFacilityId: s.station.id,
          toFacilityId: s.hospital.id,
          referredById: s.communeDoctor.id,
          escortId: s.communeDoctor.id,
          priority: 'CRITICAL',
          reason: 'Nghi máu tụ nội sọ, vượt khả năng chuyên môn tuyến xã',
          clinicalSummary: 'Bệnh nhân nam 36 tuổi, chấn thương đầu, GCS 12',
          estimatedArrivalAt: new Date(start.getTime() + 90 * 60_000),
        },
      });

      await tx.referralVitalLog.createMany({
        data: [0, 5, 10].map((min, i) => ({
          referralId: referral.id,
          clientId: crypto.randomUUID(),
          recordedAt: new Date(start.getTime() + min * 60_000),
          recordedById: s.communeDoctor.id,
          pulse: 110 + i * 4,
          spo2: 92 - i,
          gcs: 12 - i,
          consciousness: 'VOICE' as const,
        })),
      });

      await tx.referral.update({
        where: { id: referral.id },
        data: {
          status: 'ACCEPTED',
          acceptedById: s.provinceDoctor.id,
          acceptedAt: new Date(),
          preparationNote: 'Đã chuẩn bị phòng mổ số 2, dự trù 2 đơn vị máu O',
        },
      });

      // Tuyến tỉnh tiếp nhận và viết tiếp bệnh án
      await tx.referral.update({
        where: { id: referral.id },
        data: { status: 'ARRIVED', arrivedAt: new Date(), receivedById: s.provinceDoctor.id },
      });
      await tx.medicalRecord.create({
        data: {
          code: `BA${uniq()}`,
          patientId: s.patient.id,
          doctorId: s.provinceDoctor.id,
          facilityId: s.hospital.id,
          sourceReferralId: referral.id,
          encounterType: 'INPATIENT',
          chiefComplaint: 'Tiếp nhận chuyển tuyến',
        },
      });

      return tx.referral.findUniqueOrThrow({
        where: { id: referral.id },
        include: {
          fromFacility: { include: { commune: { include: { province: true } } } },
          vitalLogs: { orderBy: { recordedAt: 'asc' } },
          sourceRecord: { include: { doctor: true, diagnoses: { include: { icd10: true } } } },
          continuationRecord: true,
        },
      });
    });

    expect(result.status).toBe('ARRIVED');
    expect(result.fromFacility.commune.province.name).toBe('Lào Cai');
    expect(result.vitalLogs.map((v) => v.gcs)).toEqual([12, 11, 10]);
    expect(result.sourceRecord.doctor.fullName).toBe('BS. Nguyễn Văn An');
    expect(result.sourceRecord.diagnoses[0]?.icd10.code).toBe('S06.5');
    expect(result.continuationRecord?.encounterType).toBe('INPATIENT');
  });

  it('thực thi các ràng buộc toàn vẹn dữ liệu', async (ctx) => {
    if (!dbReady) return ctx.skip();

    const errors = await inRollback(async (tx) => {
      const s = await buildScenario(tx);
      const start = new Date('2026-12-02T09:00:00+07:00');
      const end = new Date(start.getTime() + 15 * 60_000);
      const appt = (status?: 'CANCELLED') =>
        tx.appointment.create({
          data: {
            code: `LH${uniq()}`,
            patientId: s.patient.id,
            facilityId: s.station.id,
            doctorId: s.communeDoctor.id,
            startAt: start,
            endAt: end,
            reason: 'Khám',
            status,
          },
        });

      await appt();
      await tx.icd10Code.createMany({
        data: [
          { code: 'J18.9', nameVi: 'Viêm phổi' },
          { code: 'I10', nameVi: 'Tăng huyết áp vô căn' },
        ],
        skipDuplicates: true,
      });
      const record = await tx.medicalRecord.create({
        data: {
          code: `BA${uniq()}`,
          patientId: s.patient.id,
          doctorId: s.communeDoctor.id,
          facilityId: s.station.id,
          chiefComplaint: 'Ho, sốt',
          diagnoses: { create: { icdCode: 'J18.9', isPrimary: true } },
        },
      });
      const referral = await tx.referral.create({
        data: {
          code: `CT${uniq()}`,
          patientId: s.patient.id,
          sourceRecordId: record.id,
          fromFacilityId: s.station.id,
          toFacilityId: s.hospital.id,
          referredById: s.communeDoctor.id,
          priority: 'URGENT',
          reason: 'x',
          clinicalSummary: 'x',
        },
      });
      const clientId = crypto.randomUUID();
      const vital = (extra: Partial<Prisma.ReferralVitalLogUncheckedCreateInput> = {}) =>
        tx.referralVitalLog.create({
          data: {
            referralId: referral.id,
            clientId: crypto.randomUUID(),
            recordedAt: new Date(),
            recordedById: s.communeDoctor.id,
            ...extra,
          },
        });
      await vital({ clientId });

      return {
        doubleBooking: await dbError(tx, () => appt()),
        cancelledSameSlotAllowed: await dbError(tx, () => appt('CANCELLED')),
        secondPrimaryDiagnosis: await dbError(tx, () =>
          tx.diagnosis.create({
            data: { medicalRecordId: record.id, icdCode: 'I10', isPrimary: true },
          }),
        ),
        secondaryDiagnosisAllowed: await dbError(tx, () =>
          tx.diagnosis.create({ data: { medicalRecordId: record.id, icdCode: 'I10' } }),
        ),
        finalizedWithoutSignature: await dbError(tx, () =>
          tx.medicalRecord.update({ where: { id: record.id }, data: { status: 'FINALIZED' } }),
        ),
        duplicateVitalSync: await dbError(tx, () => vital({ clientId })),
        invalidSpo2: await dbError(tx, () => vital({ spo2: 150 })),
        invalidGcs: await dbError(tx, () => vital({ gcs: 2 })),
        referralToSelf: await dbError(tx, () =>
          tx.referral.create({
            data: {
              code: `CT${uniq()}`,
              patientId: s.patient.id,
              sourceRecordId: record.id,
              fromFacilityId: s.station.id,
              toFacilityId: s.station.id,
              referredById: s.communeDoctor.id,
              priority: 'ROUTINE',
              reason: 'x',
              clinicalSummary: 'x',
            },
          }),
        ),
        invalidNationalId: await dbError(tx, () =>
          tx.patient.create({
            data: {
              fullName: 'X',
              dateOfBirth: new Date('2000-01-01'),
              gender: 'FEMALE',
              nationalId: '12345',
            },
          }),
        ),
        userWithoutLogin: await dbError(tx, () =>
          tx.user.create({ data: { passwordHash: 'x', fullName: 'X', role: 'PATIENT' } }),
        ),
        invalidTimeRange: await dbError(tx, () =>
          tx.appointment.create({
            data: {
              code: `LH${uniq()}`,
              patientId: s.patient.id,
              facilityId: s.station.id,
              startAt: end,
              endAt: start,
              reason: 'x',
            },
          }),
        ),
      };
    });

    expect(errors.doubleBooking).toMatch(/appointments_doctor_active_slot_key|Unique constraint/);
    expect(errors.cancelledSameSlotAllowed).toBeNull();
    expect(errors.secondPrimaryDiagnosis).toMatch(/Unique constraint/);
    expect(errors.secondaryDiagnosisAllowed).toBeNull();
    expect(errors.finalizedWithoutSignature).toMatch(/medical_records_signature_chk/);
    expect(errors.duplicateVitalSync).toMatch(/Unique constraint/);
    expect(errors.invalidSpo2).toMatch(/referral_vital_logs_vitals_chk/);
    expect(errors.invalidGcs).toMatch(/referral_vital_logs_vitals_chk/);
    expect(errors.referralToSelf).toMatch(/referrals_distinct_facilities_chk/);
    expect(errors.invalidNationalId).toMatch(/patients_national_id_chk/);
    expect(errors.userWithoutLogin).toMatch(/users_email_or_phone_chk/);
    expect(errors.invalidTimeRange).toMatch(/appointments_time_range_chk/);
  });
});
