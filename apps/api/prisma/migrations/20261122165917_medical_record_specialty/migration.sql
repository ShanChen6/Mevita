-- AlterTable
ALTER TABLE "medical_records" ADD COLUMN     "specialty_id" UUID;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
