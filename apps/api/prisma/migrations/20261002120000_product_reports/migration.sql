-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('piracy', 'malware', 'scam', 'illegal', 'broken', 'other');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('open', 'resolved', 'dismissed');

-- CreateTable
CREATE TABLE "product_reports" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "details" VARCHAR(1000),
    "reporter_email" VARCHAR(150),
    "ip_hash" VARCHAR(64),
    "status" "ReportStatus" NOT NULL DEFAULT 'open',
    "resolution_note" VARCHAR(500),
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_reports_status_idx" ON "product_reports"("status");

-- CreateIndex
CREATE INDEX "product_reports_product_id_idx" ON "product_reports"("product_id");

-- AddForeignKey
ALTER TABLE "product_reports" ADD CONSTRAINT "product_reports_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

