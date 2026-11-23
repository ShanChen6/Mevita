-- CreateEnum
CREATE TYPE "ReferralAcceptance" AS ENUM ('READY', 'STABILIZE_FORWARD');

-- CreateEnum
CREATE TYPE "RedirectCategory" AS ENUM ('NO_SPECIALTY', 'NO_EQUIPMENT', 'NOT_INDICATED', 'OTHER');

-- AlterTable
ALTER TABLE "health_facilities" ADD COLUMN     "capacity_note" VARCHAR(300),
ADD COLUMN     "capacity_updated_at" TIMESTAMP(3),
ADD COLUMN     "er_beds_available" INTEGER,
ADD COLUMN     "er_beds_total" INTEGER,
ADD COLUMN     "icu_beds_available" INTEGER;

-- AlterTable
ALTER TABLE "referrals" ADD COLUMN     "acceptance_type" "ReferralAcceptance",
ADD COLUMN     "escalated_at" TIMESTAMP(3),
ADD COLUMN     "escalation_level" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "forward_note" VARCHAR(500),
ADD COLUMN     "redirect_category" "RedirectCategory",
ADD COLUMN     "redirect_facility_id" UUID,
ADD COLUMN     "required_specialty_id" UUID;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_required_specialty_id_fkey" FOREIGN KEY ("required_specialty_id") REFERENCES "specialties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_redirect_facility_id_fkey" FOREIGN KEY ("redirect_facility_id") REFERENCES "health_facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
