-- CreateEnum
CREATE TYPE "DisputeReason" AS ENUM ('unusable', 'not_as_described', 'not_received', 'double_payment', 'removed');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('open', 'review', 'accepted', 'refunded', 'rejected');

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "seller_id" TEXT,
    "reason" "DisputeReason" NOT NULL,
    "description" VARCHAR(3000) NOT NULL,
    "refund_operator" "MobileMoneyOperator" NOT NULL,
    "refund_phone" VARCHAR(20) NOT NULL,
    "refund_account_name" VARCHAR(160) NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'open',
    "seller_deadline" TIMESTAMP(3),
    "seller_response" VARCHAR(3000),
    "seller_accepts_refund" BOOLEAN,
    "seller_responded_at" TIMESTAMP(3),
    "decision_note" VARCHAR(1000),
    "decided_at" TIMESTAMP(3),
    "refund_reference" VARCHAR(100),
    "refunded_at" TIMESTAMP(3),
    "ip_hash" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "disputes_reference_key" ON "disputes"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "disputes_order_item_id_key" ON "disputes"("order_item_id");

-- CreateIndex
CREATE INDEX "disputes_status_idx" ON "disputes"("status");

-- CreateIndex
CREATE INDEX "disputes_seller_id_status_idx" ON "disputes"("seller_id", "status");

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

