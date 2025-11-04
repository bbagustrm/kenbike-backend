-- CreateTable
CREATE TABLE "gallery_images" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gallery_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gallery_images_productId_idx" ON "gallery_images"("productId");

-- AddForeignKey
ALTER TABLE "gallery_images" ADD CONSTRAINT "gallery_images_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
