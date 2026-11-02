-- AlterTable
ALTER TABLE "page_views" ADD COLUMN     "referrer_host" VARCHAR(100),
ADD COLUMN     "store_id" TEXT;

-- CreateIndex
CREATE INDEX "page_views_product_id_created_at_idx" ON "page_views"("product_id", "created_at");

-- CreateIndex
CREATE INDEX "page_views_store_id_created_at_idx" ON "page_views"("store_id", "created_at");

