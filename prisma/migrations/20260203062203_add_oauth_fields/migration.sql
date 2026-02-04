-- AlterTable
ALTER TABLE "users" ADD COLUMN     "provider" VARCHAR(20) DEFAULT 'local',
ADD COLUMN     "provider_id" VARCHAR(255),
ALTER COLUMN "password" DROP NOT NULL;
