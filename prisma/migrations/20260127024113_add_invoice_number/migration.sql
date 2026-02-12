/*
  Warnings:

  - A unique constraint covering the columns `[invoice_number]` on the table `orders` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "invoice_number" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "orders_invoice_number_key" ON "orders"("invoice_number");
