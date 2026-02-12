/*
  Warnings:

  - You are about to alter the column `country` on the `users` table. The data in that column could be lost. The data in that column will be cast from `VarChar(50)` to `VarChar(2)`.

*/
-- AlterTable
ALTER TABLE "users" ALTER COLUMN "country" SET DEFAULT 'ID',
ALTER COLUMN "country" SET DATA TYPE VARCHAR(2);
