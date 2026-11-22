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
  clinicalImages: {
    id: string;
    type: ClinicalImageType;
    secureUrl: string;
    thumbnailUrl: string;
    description: string | null;
    takenAt: string | null;
  }[];
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
