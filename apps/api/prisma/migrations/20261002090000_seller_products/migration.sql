-- CreateEnum
CREATE TYPE "ProductReviewStatus" AS ENUM ('draft', 'pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "FileScanStatus" AS ENUM ('pending', 'clean', 'infected', 'failed');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "review_note" VARCHAR(500),
ADD COLUMN     "review_status" "ProductReviewStatus" NOT NULL DEFAULT 'approved',
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "scan_result" VARCHAR(200),
ADD COLUMN     "scan_status" "FileScanStatus",
ADD COLUMN     "scanned_at" TIMESTAMP(3),
ADD COLUMN     "submitted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "products_review_status_idx" ON "products"("review_status");

