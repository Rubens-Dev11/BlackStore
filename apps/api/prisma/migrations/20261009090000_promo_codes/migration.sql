-- CreateEnum
CREATE TYPE "PromoDiscountType" AS ENUM ('percent', 'amount');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "discount_amount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "promo_code_id" TEXT,
ADD COLUMN     "promo_code_text" VARCHAR(30);

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "discount_amount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "promo_codes" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "store_id" TEXT,
    "discount_type" "PromoDiscountType" NOT NULL,
    "value" INTEGER NOT NULL,
    "max_uses" INTEGER,
    "once_per_customer" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");

-- CreateIndex
CREATE INDEX "promo_codes_store_id_idx" ON "promo_codes"("store_id");

-- CreateIndex
CREATE INDEX "orders_promo_code_id_idx" ON "orders"("promo_code_id");

-- AddForeignKey
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

