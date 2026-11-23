-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('ADVANCED_AMBULANCE', 'BASIC_AMBULANCE', 'TRANSPORT');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'ON_MISSION', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "TransportMode" AS ENUM ('FACILITY_VEHICLE', 'PICKUP', 'EMS_115', 'FAMILY', 'OTHER');

-- AlterTable
ALTER TABLE "referrals" ADD COLUMN     "arriving_notified_at" TIMESTAMP(3),
ADD COLUMN     "picked_up_at" TIMESTAMP(3),
ADD COLUMN     "pickup_assigned_at" TIMESTAMP(3),
ADD COLUMN     "pickup_requested_at" TIMESTAMP(3),
ADD COLUMN     "transport_mode" "TransportMode",
ADD COLUMN     "transport_note" VARCHAR(500),
ADD COLUMN     "vehicle_id" UUID;

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "plate_number" VARCHAR(20) NOT NULL,
    "type" "VehicleType" NOT NULL,
    "equipment" VARCHAR(255),
    "driver_name" VARCHAR(150),
    "driver_phone" VARCHAR(15),
    "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_latitude" DOUBLE PRECISION,
    "last_longitude" DOUBLE PRECISION,
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_locations" (
    "id" UUID NOT NULL,
    "referral_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "recorded_by_id" UUID NOT NULL,

    CONSTRAINT "referral_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_plate_number_key" ON "vehicles"("plate_number");

-- CreateIndex
CREATE INDEX "vehicles_facility_id_status_idx" ON "vehicles"("facility_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "referral_locations_client_id_key" ON "referral_locations"("client_id");

-- CreateIndex
CREATE INDEX "referral_locations_referral_id_recorded_at_idx" ON "referral_locations"("referral_id", "recorded_at");

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "health_facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_locations" ADD CONSTRAINT "referral_locations_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "referrals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_locations" ADD CONSTRAINT "referral_locations_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
