-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PATIENT', 'COMMUNE_STAFF', 'PROVINCE_STAFF', 'ADMIN');

-- CreateEnum
CREATE TYPE "StaffPosition" AS ENUM ('DOCTOR', 'NURSE', 'MIDWIFE', 'PHYSICIAN_ASSISTANT', 'COORDINATOR', 'RECEPTIONIST');

-- CreateEnum
CREATE TYPE "FacilityType" AS ENUM ('COMMUNE_HEALTH_STATION', 'PROVINCIAL_GENERAL_HOSPITAL', 'PROVINCIAL_SPECIALTY_HOSPITAL', 'REGIONAL_HOSPITAL', 'CENTRAL_HOSPITAL');

-- CreateEnum
CREATE TYPE "FacilityLevel" AS ENUM ('PRIMARY', 'BASIC', 'SPECIALIZED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "BloodType" AS ENUM ('A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "EncounterType" AS ENUM ('OUTPATIENT', 'EMERGENCY', 'INPATIENT');

-- CreateEnum
CREATE TYPE "MedicalRecordStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateEnum
CREATE TYPE "ClinicalImageType" AS ENUM ('LAB_RESULT', 'XRAY', 'ULTRASOUND', 'CT', 'MRI', 'ECG', 'OTHER');

-- CreateEnum
CREATE TYPE "ReferralPriority" AS ENUM ('CRITICAL', 'URGENT', 'ROUTINE');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'ARRIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConsciousnessLevel" AS ENUM ('ALERT', 'VOICE', 'PAIN', 'UNRESPONSIVE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(15),
    "password_hash" TEXT NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "role" "UserRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_profiles" (
    "user_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "position" "StaffPosition" NOT NULL,
    "specialty_id" UUID,
    "license_number" VARCHAR(50),
    "academic_title" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "user_agent" VARCHAR(500),
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(50) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" VARCHAR(50),
    "metadata" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_facilities" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "FacilityType" NOT NULL,
    "level" "FacilityLevel" NOT NULL,
    "commune_code" VARCHAR(5) NOT NULL,
    "address_detail" VARCHAR(255),
    "phone" VARCHAR(20),
    "emergency_phone" VARCHAR(20),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accepts_referrals" BOOLEAN NOT NULL DEFAULT false,
    "slot_duration_minutes" INTEGER NOT NULL DEFAULT 15,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specialties" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "specialties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_specialties" (
    "facility_id" UUID NOT NULL,
    "specialty_id" UUID NOT NULL,
    "is_bookable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "facility_specialties_pkey" PRIMARY KEY ("facility_id","specialty_id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "full_name" VARCHAR(150) NOT NULL,
    "date_of_birth" DATE NOT NULL,
    "gender" "Gender" NOT NULL,
    "national_id" VARCHAR(12),
    "health_insurance_number" VARCHAR(15),
    "health_insurance_expiry" DATE,
    "phone" VARCHAR(15),
    "commune_code" VARCHAR(5),
    "address_detail" VARCHAR(255),
    "blood_type" "BloodType" NOT NULL DEFAULT 'UNKNOWN',
    "allergies" TEXT,
    "chronic_conditions" TEXT,
    "emergency_contact_name" VARCHAR(150),
    "emergency_contact_phone" VARCHAR(15),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "patient_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "specialty_id" UUID,
    "doctor_id" UUID,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "initial_symptoms" TEXT,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "cancellation_reason" TEXT,
    "handled_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_records" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "patient_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "appointment_id" UUID,
    "source_referral_id" UUID,
    "encounter_type" "EncounterType" NOT NULL DEFAULT 'OUTPATIENT',
    "visit_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chief_complaint" TEXT NOT NULL,
    "symptoms" TEXT,
    "physical_examination" TEXT,
    "pulse" INTEGER,
    "temperature" DOUBLE PRECISION,
    "systolic_bp" INTEGER,
    "diastolic_bp" INTEGER,
    "respiratory_rate" INTEGER,
    "spo2" INTEGER,
    "weight_kg" DOUBLE PRECISION,
    "height_cm" DOUBLE PRECISION,
    "diagnosis_note" TEXT,
    "treatment_plan" TEXT,
    "follow_up_date" DATE,
    "status" "MedicalRecordStatus" NOT NULL DEFAULT 'DRAFT',
    "signed_at" TIMESTAMP(3),
    "signature_hash" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "icd10_codes" (
    "code" VARCHAR(10) NOT NULL,
    "name_vi" TEXT NOT NULL,
    "name_en" TEXT,
    "chapter" VARCHAR(10),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "icd10_codes_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "diagnoses" (
    "id" UUID NOT NULL,
    "medical_record_id" UUID NOT NULL,
    "icd_code" VARCHAR(10) NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,

    CONSTRAINT "diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_items" (
    "id" UUID NOT NULL,
    "medical_record_id" UUID NOT NULL,
    "drug_name" VARCHAR(255) NOT NULL,
    "active_ingredient" VARCHAR(255),
    "strength" VARCHAR(50),
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" VARCHAR(30) NOT NULL,
    "instructions" TEXT NOT NULL,
    "duration_days" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_images" (
    "id" UUID NOT NULL,
    "medical_record_id" UUID NOT NULL,
    "type" "ClinicalImageType" NOT NULL,
    "cloudinary_public_id" TEXT NOT NULL,
    "secure_url" TEXT NOT NULL,
    "format" VARCHAR(10),
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "description" TEXT,
    "taken_at" TIMESTAMP(3),
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "patient_id" UUID NOT NULL,
    "source_record_id" UUID NOT NULL,
    "from_facility_id" UUID NOT NULL,
    "to_facility_id" UUID NOT NULL,
    "referred_by_id" UUID NOT NULL,
    "priority" "ReferralPriority" NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "clinical_summary" TEXT NOT NULL,
    "initial_treatment" TEXT,
    "escort_id" UUID,
    "vehicle_info" VARCHAR(100),
    "departed_at" TIMESTAMP(3),
    "estimated_arrival_at" TIMESTAMP(3),
    "accepted_by_id" UUID,
    "accepted_at" TIMESTAMP(3),
    "preparation_note" TEXT,
    "rejection_reason" TEXT,
    "received_by_id" UUID,
    "arrived_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_vital_logs" (
    "id" UUID NOT NULL,
    "referral_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by_id" UUID NOT NULL,
    "pulse" INTEGER,
    "systolic_bp" INTEGER,
    "diastolic_bp" INTEGER,
    "spo2" INTEGER,
    "respiratory_rate" INTEGER,
    "temperature" DOUBLE PRECISION,
    "consciousness" "ConsciousnessLevel",
    "gcs" INTEGER,
    "note" TEXT,

    CONSTRAINT "referral_vital_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "staff_profiles_license_number_key" ON "staff_profiles"("license_number");

-- CreateIndex
CREATE INDEX "staff_profiles_facility_id_idx" ON "staff_profiles"("facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "health_facilities_code_key" ON "health_facilities"("code");

-- CreateIndex
CREATE INDEX "health_facilities_commune_code_idx" ON "health_facilities"("commune_code");

-- CreateIndex
CREATE INDEX "health_facilities_type_idx" ON "health_facilities"("type");

-- CreateIndex
CREATE UNIQUE INDEX "specialties_code_key" ON "specialties"("code");

-- CreateIndex
CREATE UNIQUE INDEX "specialties_name_key" ON "specialties"("name");

-- CreateIndex
CREATE INDEX "facility_specialties_specialty_id_idx" ON "facility_specialties"("specialty_id");

-- CreateIndex
CREATE UNIQUE INDEX "patients_user_id_key" ON "patients"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "patients_national_id_key" ON "patients"("national_id");

-- CreateIndex
CREATE UNIQUE INDEX "patients_health_insurance_number_key" ON "patients"("health_insurance_number");

-- CreateIndex
CREATE INDEX "patients_full_name_idx" ON "patients"("full_name");

-- CreateIndex
CREATE INDEX "patients_phone_idx" ON "patients"("phone");

-- CreateIndex
CREATE INDEX "patients_commune_code_idx" ON "patients"("commune_code");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_code_key" ON "appointments"("code");

-- CreateIndex
CREATE INDEX "appointments_patient_id_start_at_idx" ON "appointments"("patient_id", "start_at");

-- CreateIndex
CREATE INDEX "appointments_facility_id_start_at_idx" ON "appointments"("facility_id", "start_at");

-- CreateIndex
CREATE INDEX "appointments_doctor_id_start_at_idx" ON "appointments"("doctor_id", "start_at");

-- CreateIndex
CREATE INDEX "appointments_status_idx" ON "appointments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "medical_records_code_key" ON "medical_records"("code");

-- CreateIndex
CREATE UNIQUE INDEX "medical_records_appointment_id_key" ON "medical_records"("appointment_id");

-- CreateIndex
CREATE UNIQUE INDEX "medical_records_source_referral_id_key" ON "medical_records"("source_referral_id");

-- CreateIndex
CREATE INDEX "medical_records_patient_id_visit_at_idx" ON "medical_records"("patient_id", "visit_at");

-- CreateIndex
CREATE INDEX "medical_records_facility_id_visit_at_idx" ON "medical_records"("facility_id", "visit_at");

-- CreateIndex
CREATE INDEX "medical_records_doctor_id_visit_at_idx" ON "medical_records"("doctor_id", "visit_at");

-- CreateIndex
CREATE INDEX "diagnoses_icd_code_idx" ON "diagnoses"("icd_code");

-- CreateIndex
CREATE UNIQUE INDEX "diagnoses_medical_record_id_icd_code_key" ON "diagnoses"("medical_record_id", "icd_code");

-- CreateIndex
CREATE INDEX "prescription_items_medical_record_id_idx" ON "prescription_items"("medical_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_images_cloudinary_public_id_key" ON "clinical_images"("cloudinary_public_id");

-- CreateIndex
CREATE INDEX "clinical_images_medical_record_id_idx" ON "clinical_images"("medical_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_code_key" ON "referrals"("code");

-- CreateIndex
CREATE INDEX "referrals_to_facility_id_status_idx" ON "referrals"("to_facility_id", "status");

-- CreateIndex
CREATE INDEX "referrals_from_facility_id_created_at_idx" ON "referrals"("from_facility_id", "created_at");

-- CreateIndex
CREATE INDEX "referrals_patient_id_idx" ON "referrals"("patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "referral_vital_logs_client_id_key" ON "referral_vital_logs"("client_id");

-- CreateIndex
CREATE INDEX "referral_vital_logs_referral_id_recorded_at_idx" ON "referral_vital_logs"("referral_id", "recorded_at");

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "health_facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_facilities" ADD CONSTRAINT "health_facilities_commune_code_fkey" FOREIGN KEY ("commune_code") REFERENCES "communes"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_specialties" ADD CONSTRAINT "facility_specialties_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "health_facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_specialties" ADD CONSTRAINT "facility_specialties_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_commune_code_fkey" FOREIGN KEY ("commune_code") REFERENCES "communes"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "health_facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_handled_by_id_fkey" FOREIGN KEY ("handled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "health_facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_source_referral_id_fkey" FOREIGN KEY ("source_referral_id") REFERENCES "referrals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_medical_record_id_fkey" FOREIGN KEY ("medical_record_id") REFERENCES "medical_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_icd_code_fkey" FOREIGN KEY ("icd_code") REFERENCES "icd10_codes"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_medical_record_id_fkey" FOREIGN KEY ("medical_record_id") REFERENCES "medical_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_images" ADD CONSTRAINT "clinical_images_medical_record_id_fkey" FOREIGN KEY ("medical_record_id") REFERENCES "medical_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_images" ADD CONSTRAINT "clinical_images_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_source_record_id_fkey" FOREIGN KEY ("source_record_id") REFERENCES "medical_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_from_facility_id_fkey" FOREIGN KEY ("from_facility_id") REFERENCES "health_facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_to_facility_id_fkey" FOREIGN KEY ("to_facility_id") REFERENCES "health_facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_by_id_fkey" FOREIGN KEY ("referred_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_escort_id_fkey" FOREIGN KEY ("escort_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_accepted_by_id_fkey" FOREIGN KEY ("accepted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_vital_logs" ADD CONSTRAINT "referral_vital_logs_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "referrals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_vital_logs" ADD CONSTRAINT "referral_vital_logs_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- Ràng buộc bổ sung (Prisma schema không biểu diễn được)
-- ─────────────────────────────────────────────────────────────

-- Tài khoản phải có email hoặc số điện thoại để đăng nhập
ALTER TABLE "users" ADD CONSTRAINT "users_email_or_phone_chk"
  CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL);

-- CCCD gồm đúng 12 chữ số
ALTER TABLE "patients" ADD CONSTRAINT "patients_national_id_chk"
  CHECK ("national_id" IS NULL OR "national_id" ~ '^[0-9]{12}$');

-- Toạ độ hợp lệ
ALTER TABLE "health_facilities" ADD CONSTRAINT "health_facilities_coordinates_chk"
  CHECK (("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90)
     AND ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180));
ALTER TABLE "health_facilities" ADD CONSTRAINT "health_facilities_slot_duration_chk"
  CHECK ("slot_duration_minutes" BETWEEN 5 AND 240);

-- Lịch hẹn: giờ kết thúc sau giờ bắt đầu
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_time_range_chk"
  CHECK ("end_at" > "start_at");

-- Một bác sĩ không thể có hai lịch hẹn còn hiệu lực cùng giờ bắt đầu
CREATE UNIQUE INDEX "appointments_doctor_active_slot_key"
  ON "appointments" ("doctor_id", "start_at")
  WHERE "doctor_id" IS NOT NULL AND "status" NOT IN ('CANCELLED', 'NO_SHOW');

-- Mỗi hồ sơ khám chỉ có một chẩn đoán chính
CREATE UNIQUE INDEX "diagnoses_one_primary_per_record_key"
  ON "diagnoses" ("medical_record_id")
  WHERE "is_primary";

-- Hồ sơ đã ký phải có thời điểm ký và mã băm
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_signature_chk"
  CHECK ("status" <> 'FINALIZED' OR ("signed_at" IS NOT NULL AND "signature_hash" IS NOT NULL));

-- Chỉ số sinh tồn trong ngưỡng sinh lý có thể ghi nhận
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_vitals_chk" CHECK (
  ("pulse" IS NULL OR "pulse" BETWEEN 0 AND 300)
  AND ("temperature" IS NULL OR "temperature" BETWEEN 25 AND 45)
  AND ("systolic_bp" IS NULL OR "systolic_bp" BETWEEN 0 AND 300)
  AND ("diastolic_bp" IS NULL OR "diastolic_bp" BETWEEN 0 AND 250)
  AND ("respiratory_rate" IS NULL OR "respiratory_rate" BETWEEN 0 AND 100)
  AND ("spo2" IS NULL OR "spo2" BETWEEN 0 AND 100)
);
ALTER TABLE "referral_vital_logs" ADD CONSTRAINT "referral_vital_logs_vitals_chk" CHECK (
  ("pulse" IS NULL OR "pulse" BETWEEN 0 AND 300)
  AND ("temperature" IS NULL OR "temperature" BETWEEN 25 AND 45)
  AND ("systolic_bp" IS NULL OR "systolic_bp" BETWEEN 0 AND 300)
  AND ("diastolic_bp" IS NULL OR "diastolic_bp" BETWEEN 0 AND 250)
  AND ("respiratory_rate" IS NULL OR "respiratory_rate" BETWEEN 0 AND 100)
  AND ("spo2" IS NULL OR "spo2" BETWEEN 0 AND 100)
  AND ("gcs" IS NULL OR "gcs" BETWEEN 3 AND 15)
);

-- Chuyển tuyến: nơi gửi khác nơi nhận
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_distinct_facilities_chk"
  CHECK ("from_facility_id" <> "to_facility_id");
