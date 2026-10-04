-- CreateEnum
CREATE TYPE "SupportTopic" AS ENUM ('order', 'refund', 'seller', 'personal_data', 'other');

-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('open', 'answered', 'closed');

-- AlterTable : identité de l'éditeur et contact affichés dans les pages légales
ALTER TABLE "marketplace_settings" ADD COLUMN "legal_name" VARCHAR(160),
ADD COLUMN "legal_form" VARCHAR(160),
ADD COLUMN "legal_address" VARCHAR(300),
ADD COLUMN "rccm" VARCHAR(60),
ADD COLUMN "niu" VARCHAR(30),
ADD COLUMN "contact_email" VARCHAR(150),
ADD COLUMN "contact_phone" VARCHAR(30),
ADD COLUMN "hosting_info" VARCHAR(300);

-- AlterTable : conditions vendeurs acceptées à l'inscription
ALTER TABLE "sellers" ADD COLUMN "terms_version" VARCHAR(20),
ADD COLUMN "terms_accepted_at" TIMESTAMP(3);

-- AlterTable : conditions générales acceptées à la commande
ALTER TABLE "orders" ADD COLUMN "terms_version" VARCHAR(20),
ADD COLUMN "terms_accepted_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "support_requests" (
    "id" TEXT NOT NULL,
    "topic" "SupportTopic" NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "order_number" VARCHAR(30),
    "message" VARCHAR(3000) NOT NULL,
    "status" "SupportStatus" NOT NULL DEFAULT 'open',
    "reply" TEXT,
    "replied_at" TIMESTAMP(3),
    "ip_hash" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_requests_status_idx" ON "support_requests"("status");
