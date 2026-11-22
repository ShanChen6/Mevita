-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "cancelled_by_patient" BOOLEAN,
ADD COLUMN     "checked_in_at" TIMESTAMP(3),
ADD COLUMN     "confirmed_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "facility_opening_hours" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "day_of_week" SMALLINT NOT NULL,
    "start_minute" SMALLINT NOT NULL,
    "end_minute" SMALLINT NOT NULL,

    CONSTRAINT "facility_opening_hours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "facility_opening_hours_facility_id_day_of_week_idx" ON "facility_opening_hours"("facility_id", "day_of_week");

-- AddForeignKey
ALTER TABLE "facility_opening_hours" ADD CONSTRAINT "facility_opening_hours_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "health_facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Giờ làm việc hợp lệ
ALTER TABLE "facility_opening_hours" ADD CONSTRAINT "facility_opening_hours_range_chk"
  CHECK ("day_of_week" BETWEEN 0 AND 6 AND "start_minute" >= 0 AND "end_minute" <= 1440 AND "start_minute" < "end_minute");

-- Một bệnh nhân không có hai lịch hẹn còn hiệu lực cùng giờ bắt đầu
CREATE UNIQUE INDEX "appointments_patient_active_slot_key"
  ON "appointments" ("patient_id", "start_at")
  WHERE "status" NOT IN ('CANCELLED', 'NO_SHOW');
