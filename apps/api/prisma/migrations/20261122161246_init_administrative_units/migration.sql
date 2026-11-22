-- CreateEnum
CREATE TYPE "ProvinceType" AS ENUM ('MUNICIPALITY', 'PROVINCE');

-- CreateEnum
CREATE TYPE "CommuneType" AS ENUM ('WARD', 'COMMUNE', 'SPECIAL_ZONE');

-- CreateTable
CREATE TABLE "provinces" (
    "code" VARCHAR(2) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(100) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "full_name_en" VARCHAR(150) NOT NULL,
    "code_name" VARCHAR(100) NOT NULL,
    "type" "ProvinceType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provinces_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "communes" (
    "code" VARCHAR(5) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(100) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "full_name_en" VARCHAR(150) NOT NULL,
    "code_name" VARCHAR(100) NOT NULL,
    "type" "CommuneType" NOT NULL,
    "province_code" VARCHAR(2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communes_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE UNIQUE INDEX "provinces_code_name_key" ON "provinces"("code_name");

-- CreateIndex
CREATE INDEX "communes_province_code_idx" ON "communes"("province_code");

-- CreateIndex
CREATE INDEX "communes_code_name_idx" ON "communes"("code_name");

-- AddForeignKey
ALTER TABLE "communes" ADD CONSTRAINT "communes_province_code_fkey" FOREIGN KEY ("province_code") REFERENCES "provinces"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
