/** Kiểu dữ liệu trả về từ API (apps/api) — dùng chung cho server và client components. */
import type {
  BloodType,
  ClinicalImageType,
  EncounterType,
  FacilityType,
  Gender,
} from '@/lib/labels';

export interface ProvinceOption {
  code: string;
  name: string;
  fullName: string;
}

export interface CommuneOption {
  code: string;
  name: string;
  fullName: string;
}

export interface PatientProfile {
  id: string;
  fullName: string;
  /** ISO, VD: 1990-05-01T00:00:00.000Z */
  dateOfBirth: string;
  gender: Gender;
  nationalId: string | null;
  healthInsuranceNumber: string | null;
  healthInsuranceExpiry: string | null;
  phone: string | null;
  bloodType: BloodType;
  allergies: string | null;
  chronicConditions: string | null;
  addressDetail: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  commune: {
    code: string;
    name: string;
    fullName: string;
    province: { code: string; name: string; fullName: string };
  } | null;
}

export interface MedicalRecordItem {
  id: string;
  code: string;
  visitAt: string;
  encounterType: EncounterType;
  chiefComplaint: string;
  symptoms: string | null;
  diagnosisNote: string | null;
  treatmentPlan: string | null;
  followUpDate: string | null;
  pulse: number | null;
  temperature: number | null;
  systolicBp: number | null;
  diastolicBp: number | null;
  respiratoryRate: number | null;
  spo2: number | null;
  weightKg: number | null;
  heightCm: number | null;
  signedAt: string | null;
  specialty: { code: string; name: string } | null;
  doctor: { fullName: string; academicTitle: string | null; position: string | null };
  facility: { id: string; name: string; type: FacilityType; address: string };
  diagnoses: { icdCode: string; name: string; isPrimary: boolean; note: string | null }[];
  prescriptionItems: {
    drugName: string;
    activeIngredient: string | null;
    strength: string | null;
    quantity: number;
    unit: string;
    instructions: string;
    durationDays: number | null;
  }[];
  clinicalImages: ClinicalImage[];
  /** Hồ sơ điều trị tiếp nối tại tuyến trên (Task 5.1) */
  sourceReferral?: { code: string; fromFacility: { name: string } } | null;
}

/** Ảnh cận lâm sàng — `secureUrl` (ảnh gốc) và `thumbnailUrl` là URL có chữ ký do API cấp. */
export interface ClinicalImage {
  id: string;
  type: ClinicalImageType;
  secureUrl: string;
  thumbnailUrl: string;
  description: string | null;
  takenAt: string | null;
  width?: number | null;
  height?: number | null;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export type AppointmentStatusValue =
  'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface FacilitySummary {
  id: string;
  name: string;
  type: FacilityType;
  addressDetail: string | null;
  phone: string | null;
  commune: { code: string; fullName: string; province: { code: string; fullName: string } };
}

export interface FacilityDetail extends FacilitySummary {
  slotDurationMinutes: number;
  specialties: { id: string; code: string; name: string }[];
  doctors: {
    id: string;
    fullName: string;
    academicTitle: string | null;
    specialtyId: string | null;
  }[];
  openingHours: { dayOfWeek: number; startMinute: number; endMinute: number }[];
}

export interface TimeSlot {
  startAt: string;
  endAt: string;
  remaining: number;
  available: boolean;
}

export interface Appointment {
  id: string;
  code: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatusValue;
  reason: string;
  initialSymptoms: string | null;
  cancellationReason: string | null;
  cancelledByPatient: boolean | null;
  confirmedAt: string | null;
  checkedInAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  facility: {
    id: string;
    name: string;
    type: FacilityType;
    addressDetail: string | null;
    phone: string | null;
    commune: { fullName: string; province: { fullName: string } };
  };
  specialty: { id: string; code: string; name: string } | null;
  doctor: {
    id: string;
    fullName: string;
    staffProfile: { academicTitle: string | null } | null;
  } | null;
  medicalRecord: { id: string; code: string; status: 'DRAFT' | 'FINALIZED' } | null;
}

export interface StaffAppointment extends Appointment {
  patient: {
    id: string;
    fullName: string;
    dateOfBirth: string;
    gender: Gender;
    phone: string | null;
    nationalId: string | null;
    healthInsuranceNumber: string | null;
    allergies: string | null;
  };
}

export type LookupKind =
  'NATIONAL_ID' | 'HEALTH_INSURANCE' | 'APPOINTMENT_CODE' | 'PHONE_OR_INSURANCE' | 'NAME';

export interface PatientLookupResult {
  id: string;
  fullName: string;
  dateOfBirth: string;
  gender: Gender;
  nationalId: string | null;
  healthInsuranceNumber: string | null;
  healthInsuranceExpiry: string | null;
  phone: string | null;
  bloodType: BloodType;
  allergies: string | null;
  chronicConditions: string | null;
  addressDetail: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  commune: PatientProfile['commune'];
  hasAccount: boolean;
  totalVisits: number;
  recentVisits: {
    id: string;
    code: string;
    visitAt: string;
    chiefComplaint: string;
    facility: { id: string; name: string };
    atThisFacility: boolean;
    specialty: string | null;
    doctor: string;
    diagnoses: { icdCode: string; name: string; isPrimary: boolean }[];
  }[];
  todayAppointment: {
    id: string;
    code: string;
    startAt: string;
    status: AppointmentStatusValue;
    reason: string;
    specialty: { name: string } | null;
  } | null;
  openEncounter: { id: string; code: string; createdAt: string } | null;
}

export interface Icd10Option {
  code: string;
  nameVi: string;
  nameEn: string | null;
  chapter: string | null;
}

export interface EncounterQueueItem {
  id: string;
  code: string;
  createdAt: string;
  encounterType: EncounterType;
  chiefComplaint: string;
  specialty: { name: string } | null;
  doctor: { id: string; fullName: string };
  appointment: { code: string; startAt: string } | null;
  patient: {
    id: string;
    fullName: string;
    dateOfBirth: string;
    gender: Gender;
    allergies: string | null;
  };
}

export interface MedicalRecordDetail {
  id: string;
  code: string;
  status: 'DRAFT' | 'FINALIZED';
  encounterType: EncounterType;
  visitAt: string;
  createdAt: string;
  updatedAt: string;
  chiefComplaint: string;
  symptoms: string | null;
  physicalExamination: string | null;
  pulse: number | null;
  temperature: number | null;
  systolicBp: number | null;
  diastolicBp: number | null;
  respiratoryRate: number | null;
  spo2: number | null;
  weightKg: number | null;
  heightCm: number | null;
  diagnosisNote: string | null;
  treatmentPlan: string | null;
  followUpDate: string | null;
  signedAt: string | null;
  signatureHash: string | null;
  facilityId: string;
  patientId: string;
  specialty: { id: string; code: string; name: string } | null;
  facility: { id: string; name: string };
  doctor: { id: string; fullName: string; academicTitle: string | null; position: string | null };
  appointment: { id: string; code: string; startAt: string; status: AppointmentStatusValue } | null;
  sourceReferral: {
    id: string;
    code: string;
    fromFacility: { name: string };
    arrivedAt: string | null;
  } | null;
  patient: {
    id: string;
    fullName: string;
    dateOfBirth: string;
    gender: Gender;
    nationalId: string | null;
    healthInsuranceNumber: string | null;
    bloodType: BloodType;
    allergies: string | null;
    chronicConditions: string | null;
  };
  diagnoses: { icdCode: string; name: string; isPrimary: boolean; note: string | null }[];
  prescriptionItems: MedicalRecordItem['prescriptionItems'];
  clinicalImages: ClinicalImage[];
}

export type ReferralPriorityValue = 'CRITICAL' | 'URGENT' | 'ROUTINE';
export type ReferralStatusValue = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'ARRIVED' | 'CANCELLED';

export interface ReferralFacility {
  id: string;
  name: string;
  type: FacilityType;
  phone: string | null;
  emergencyPhone: string | null;
  commune: { fullName: string; province: { code: string; fullName: string } };
}

export interface ReferralDestination extends ReferralFacility {
  level: 'PRIMARY' | 'BASIC' | 'SPECIALIZED';
  specialties: { code: string; name: string }[];
  sameProvince: boolean;
  onDutyCount: number;
}

export interface StaffOption {
  id: string;
  fullName: string;
  academicTitle: string | null;
  position: string;
}

export interface Referral {
  id: string;
  code: string;
  priority: ReferralPriorityValue;
  status: ReferralStatusValue;
  reason: string;
  clinicalSummary: string;
  initialTreatment: string | null;
  vehicleInfo: string | null;
  departedAt: string | null;
  estimatedArrivalAt: string | null;
  acceptedAt: string | null;
  preparationNote: string | null;
  rejectionReason: string | null;
  arrivedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  interProvincial: boolean;
  vitalLogCount: number;
  latestVital: VitalLog | null;
  /** Chỉ có ở chi tiết phiếu: ảnh cận lâm sàng của phiếu khám tuyến dưới */
  sourceImages?: ClinicalImage[];
  fromFacility: ReferralFacility;
  toFacility: ReferralFacility;
  referredBy: { id: string; name: string; phone: string | null };
  escort: { id: string; name: string; phone: string | null } | null;
  acceptedBy: { id: string; name: string } | null;
  receivedBy: { id: string; name: string } | null;
  continuationRecord: {
    id: string;
    code: string;
    status: 'DRAFT' | 'FINALIZED';
    signedAt: string | null;
  } | null;
  patient: {
    id: string;
    fullName: string;
    dateOfBirth: string;
    gender: Gender;
    bloodType: BloodType;
    allergies: string | null;
    chronicConditions: string | null;
    nationalId: string | null;
    healthInsuranceNumber: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
  };
  sourceRecord: {
    id: string;
    code: string;
    status: 'DRAFT' | 'FINALIZED';
    encounterType: EncounterType;
    visitAt: string;
    chiefComplaint: string;
    symptoms: string | null;
    physicalExamination: string | null;
    pulse: number | null;
    temperature: number | null;
    systolicBp: number | null;
    diastolicBp: number | null;
    respiratoryRate: number | null;
    spo2: number | null;
    diagnosisNote: string | null;
    diagnoses: { icdCode: string; name: string; isPrimary: boolean }[];
    prescriptionItems: {
      drugName: string;
      strength: string | null;
      quantity: number;
      unit: string;
      instructions: string;
    }[];
    imageCount: number;
  };
}

/** Nội dung cảnh báo realtime `new_incoming_referral` */
export interface IncomingReferralAlert {
  id: string;
  code: string;
  priority: ReferralPriorityValue;
  createdAt: string;
  estimatedArrivalAt: string | null;
  reason: string;
  patient: {
    fullName: string;
    dateOfBirth: string;
    gender: Gender;
    allergies: string | null;
    bloodType: BloodType;
  };
  diagnosis: { icdCode: string; name: string } | null;
  fromFacility: { name: string; province: string };
  referredBy: string | null;
}

export type ConsciousnessValue = 'ALERT' | 'VOICE' | 'PAIN' | 'UNRESPONSIVE';

/** Chỉ số nhập trên xe — `clientId` do thiết bị sinh, chống ghi trùng khi đồng bộ lại */
export interface VitalEntry {
  clientId: string;
  recordedAt: string;
  pulse: number | null;
  systolicBp: number | null;
  diastolicBp: number | null;
  spo2: number | null;
  respiratoryRate: number | null;
  temperature: number | null;
  consciousness: ConsciousnessValue | null;
  gcs: number | null;
  note: string | null;
}

/** Một lần đo sinh tồn trên xe đã lưu ở máy chủ */
export interface VitalLog extends VitalEntry {
  id: string;
  receivedAt: string;
  recordedBy: string;
}

/** Sự kiện realtime `vital_update` */
export interface VitalUpdateEvent {
  referralId: string;
  code: string;
  vitals: VitalLog[];
}

/** Sự kiện realtime `referral_updated` — `side` cho biết mình là phía gửi hay phía nhận */
export interface ReferralUpdatedEvent {
  id: string;
  code: string;
  action: 'accept' | 'preparation' | 'reject' | 'cancel' | 'arrive';
  status: ReferralStatusValue;
  side: 'incoming' | 'outgoing';
  priority: ReferralPriorityValue;
  sourceRecordId: string;
  patientName: string;
  fromFacility: string;
  toFacility: string;
  toFacilityPhone: string | null;
  preparationNote: string | null;
  rejectionReason: string | null;
  cancellationReason: string | null;
  by: string | null;
  at: string;
}

/** Thống kê toàn hệ thống (Task 5.2) */
export interface StatsOverview {
  range: { from: string; to: string; unit: 'day' | 'week' | 'month'; province: string | null };
  kpis: {
    appointments: number;
    appointmentsCompleted: number;
    cancelRate: number | null;
    noShowRate: number | null;
    visits: number;
    communeVisits: number;
    referrals: number;
    communeReferralRate: number | null;
    interProvincial: number;
    arrived: number;
    rejected: number;
    cancelled: number;
    active: number;
    medianAcceptMinutes: number | null;
    medianTransportMinutes: number | null;
  };
  appointmentsTrend: { bucket: string; status: AppointmentStatusValue; n: number }[];
  referralsTrend: { bucket: string; n: number }[];
  referralPriority: { priority: ReferralPriorityValue; n: number }[];
  stations: {
    id: string;
    name: string;
    province: string;
    visits: number;
    referrals: number;
    rate: number | null;
  }[];
  provinces: {
    code: string;
    name: string;
    visits: number;
    referrals: number;
    rate: number | null;
  }[];
  topDiagnoses: { code: string; name: string; chapter: string | null; n: number }[];
  diseasePattern: {
    chapters: string[];
    rows: { province: string; name: string; total: number; shares: number[] }[];
  };
  flows: { fromName: string; toName: string; inter: boolean; n: number }[];
}

export interface AdminUser {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string;
  role: 'PATIENT' | 'COMMUNE_STAFF' | 'PROVINCE_STAFF' | 'ADMIN';
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  staffProfile: {
    position: string;
    academicTitle: string | null;
    facility: { name: string };
  } | null;
}

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; fullName: string; email: string | null; role: string } | null;
}
