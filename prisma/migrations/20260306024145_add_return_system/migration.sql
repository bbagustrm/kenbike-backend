-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'ITEM_SENT', 'ITEM_RECEIVED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReturnReason" AS ENUM ('DAMAGED_ITEM', 'WRONG_ITEM', 'NOT_AS_DESCRIBED', 'MISSING_PARTS', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'RETURN_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'RETURN_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'RETURN_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'RETURN_ITEM_SENT';
ALTER TYPE "NotificationType" ADD VALUE 'RETURN_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'RETURN_REFUNDED';

-- CreateTable
CREATE TABLE "returns" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" "ReturnReason" NOT NULL,
    "description" TEXT NOT NULL,
    "refund_bank_name" VARCHAR(100) NOT NULL,
    "refund_account_number" VARCHAR(50) NOT NULL,
    "refund_account_name" VARCHAR(100) NOT NULL,
    "return_courier" VARCHAR(50),
    "return_tracking_number" VARCHAR(100),
    "item_sent_at" TIMESTAMP(3),
    "admin_notes" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" VARCHAR(255),
    "received_notes" TEXT,
    "received_at" TIMESTAMP(3),
    "received_by" VARCHAR(255),
    "refund_amount" DOUBLE PRECISION,
    "refund_method" VARCHAR(100),
    "refund_proof" VARCHAR(500),
    "refund_notes" TEXT,
    "refunded_at" TIMESTAMP(3),
    "refunded_by" VARCHAR(255),
    "cancel_reason" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_images" (
    "id" TEXT NOT NULL,
    "return_id" TEXT NOT NULL,
    "image_url" VARCHAR(500) NOT NULL,

    CONSTRAINT "return_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "returns_user_id_idx" ON "returns"("user_id");

-- CreateIndex
CREATE INDEX "returns_order_id_idx" ON "returns"("order_id");

-- CreateIndex
CREATE INDEX "returns_status_idx" ON "returns"("status");

-- CreateIndex
CREATE INDEX "returns_created_at_idx" ON "returns"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "returns_order_id_key" ON "returns"("order_id");

-- CreateIndex
CREATE INDEX "return_images_return_id_idx" ON "return_images"("return_id");

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_images" ADD CONSTRAINT "return_images_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
