/*
  Warnings:

  - A unique constraint covering the columns `[user_id,product_id,order_id]` on the table `reviews` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "is_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "order_id" TEXT;

-- CreateTable
CREATE TABLE "review_replies" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discussions" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discussions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discussion_replies" (
    "id" TEXT NOT NULL,
    "discussion_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_official" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discussion_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discussion_likes" (
    "id" TEXT NOT NULL,
    "discussion_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discussion_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discussion_reply_likes" (
    "id" TEXT NOT NULL,
    "reply_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discussion_reply_likes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "review_replies_review_id_idx" ON "review_replies"("review_id");

-- CreateIndex
CREATE INDEX "review_replies_user_id_idx" ON "review_replies"("user_id");

-- CreateIndex
CREATE INDEX "discussions_product_id_idx" ON "discussions"("product_id");

-- CreateIndex
CREATE INDEX "discussions_user_id_idx" ON "discussions"("user_id");

-- CreateIndex
CREATE INDEX "discussions_created_at_idx" ON "discussions"("created_at");

-- CreateIndex
CREATE INDEX "discussion_replies_discussion_id_idx" ON "discussion_replies"("discussion_id");

-- CreateIndex
CREATE INDEX "discussion_replies_user_id_idx" ON "discussion_replies"("user_id");

-- CreateIndex
CREATE INDEX "discussion_likes_discussion_id_idx" ON "discussion_likes"("discussion_id");

-- CreateIndex
CREATE INDEX "discussion_likes_user_id_idx" ON "discussion_likes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "discussion_likes_discussion_id_user_id_key" ON "discussion_likes"("discussion_id", "user_id");

-- CreateIndex
CREATE INDEX "discussion_reply_likes_reply_id_idx" ON "discussion_reply_likes"("reply_id");

-- CreateIndex
CREATE INDEX "discussion_reply_likes_user_id_idx" ON "discussion_reply_likes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "discussion_reply_likes_reply_id_user_id_key" ON "discussion_reply_likes"("reply_id", "user_id");

-- CreateIndex
CREATE INDEX "reviews_order_id_idx" ON "reviews"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_user_id_product_id_order_id_key" ON "reviews"("user_id", "product_id", "order_id");

-- AddForeignKey
ALTER TABLE "review_replies" ADD CONSTRAINT "review_replies_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_replies" ADD CONSTRAINT "review_replies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussion_replies" ADD CONSTRAINT "discussion_replies_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "discussions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussion_replies" ADD CONSTRAINT "discussion_replies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussion_likes" ADD CONSTRAINT "discussion_likes_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "discussions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussion_likes" ADD CONSTRAINT "discussion_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussion_reply_likes" ADD CONSTRAINT "discussion_reply_likes_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "discussion_replies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussion_reply_likes" ADD CONSTRAINT "discussion_reply_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
