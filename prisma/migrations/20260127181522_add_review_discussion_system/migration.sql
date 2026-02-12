/*
  Warnings:

  - You are about to drop the column `is_official` on the `discussion_replies` table. All the data in the column will be lost.
  - You are about to drop the `discussion_reply_likes` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[user_id,discussion_id]` on the table `discussion_likes` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id,discussion_reply_id]` on the table `discussion_likes` will be added. If there are existing duplicate values, this will fail.
  - Made the column `order_id` on table `reviews` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."discussion_reply_likes" DROP CONSTRAINT "discussion_reply_likes_reply_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."discussion_reply_likes" DROP CONSTRAINT "discussion_reply_likes_user_id_fkey";

-- DropIndex
DROP INDEX "public"."discussion_likes_discussion_id_user_id_key";

-- AlterTable
ALTER TABLE "discussion_likes" ADD COLUMN     "discussion_reply_id" TEXT,
ALTER COLUMN "discussion_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "discussion_replies" DROP COLUMN "is_official";

-- AlterTable
ALTER TABLE "reviews" ALTER COLUMN "is_verified" SET DEFAULT true,
ALTER COLUMN "order_id" SET NOT NULL;

-- DropTable
DROP TABLE "public"."discussion_reply_likes";

-- CreateIndex
CREATE INDEX "discussion_likes_discussion_reply_id_idx" ON "discussion_likes"("discussion_reply_id");

-- CreateIndex
CREATE UNIQUE INDEX "discussion_likes_user_id_discussion_id_key" ON "discussion_likes"("user_id", "discussion_id");

-- CreateIndex
CREATE UNIQUE INDEX "discussion_likes_user_id_discussion_reply_id_key" ON "discussion_likes"("user_id", "discussion_reply_id");

-- CreateIndex
CREATE INDEX "discussion_replies_created_at_idx" ON "discussion_replies"("created_at");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussion_likes" ADD CONSTRAINT "discussion_likes_discussion_reply_id_fkey" FOREIGN KEY ("discussion_reply_id") REFERENCES "discussion_replies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
