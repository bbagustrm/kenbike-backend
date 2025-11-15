/*
  Warnings:

  - Made the column `country` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "postal_code" VARCHAR(10),
ADD COLUMN     "province" VARCHAR(100),
ALTER COLUMN "country" SET NOT NULL,
ALTER COLUMN "country" SET DEFAULT 'Indonesia',
ALTER COLUMN "address" SET DATA TYPE VARCHAR(500);

-- CreateIndex
CREATE INDEX "users_country_idx" ON "users"("country");

-- CreateIndex
CREATE INDEX "users_postal_code_idx" ON "users"("postal_code");
