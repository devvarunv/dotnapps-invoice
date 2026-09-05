-- CreateEnum
CREATE TYPE "BulkAction" AS ENUM ('SEND_INVOICE', 'SEND_REMINDER');

-- CreateEnum
CREATE TYPE "BulkItemStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "BulkSendBatch" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "action" "BulkAction" NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulkSendBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkSendItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "status" "BulkItemStatus" NOT NULL,
    "failureReason" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkSendItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BulkSendBatch_businessId_idx" ON "BulkSendBatch"("businessId");

-- CreateIndex
CREATE INDEX "BulkSendBatch_businessId_createdAt_idx" ON "BulkSendBatch"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "BulkSendItem_batchId_idx" ON "BulkSendItem"("batchId");

-- CreateIndex
CREATE INDEX "BulkSendItem_invoiceId_idx" ON "BulkSendItem"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "BulkSendItem_batchId_invoiceId_key" ON "BulkSendItem"("batchId", "invoiceId");

-- AddForeignKey
ALTER TABLE "BulkSendBatch" ADD CONSTRAINT "BulkSendBatch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkSendBatch" ADD CONSTRAINT "BulkSendBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkSendItem" ADD CONSTRAINT "BulkSendItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "BulkSendBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkSendItem" ADD CONSTRAINT "BulkSendItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
