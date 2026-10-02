-- CreateEnum
CREATE TYPE "IdentityDocumentType" AS ENUM ('cni', 'passport');

-- CreateEnum
CREATE TYPE "IdentityCheckStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "identity_checks" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "document_type" "IdentityDocumentType" NOT NULL,
    "full_name" VARCHAR(160) NOT NULL,
    "document_front_key" VARCHAR(255),
    "document_back_key" VARCHAR(255),
    "selfie_key" VARCHAR(255),
    "status" "IdentityCheckStatus" NOT NULL DEFAULT 'pending',
    "review_note" VARCHAR(500),
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "identity_checks_seller_id_idx" ON "identity_checks"("seller_id");

-- CreateIndex
CREATE INDEX "identity_checks_status_idx" ON "identity_checks"("status");

-- AddForeignKey
ALTER TABLE "identity_checks" ADD CONSTRAINT "identity_checks_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

