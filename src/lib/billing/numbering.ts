import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"> | Prisma.TransactionClient;

/**
 * Auto-generate a unique quotation/invoice number using the business's
 * prefix/sequence (spec §8, §9, §21 "Unique quotation/invoice numbers are
 * scoped to the business."). The `increment` update is a single atomic
 * row-level operation, so concurrent calls for the same business can't
 * hand out the same number even without a higher isolation level.
 *
 * Call inside the same `$transaction` that creates the Quotation/Invoice
 * row, so a failed create doesn't still burn a number silently — small
 * gaps from an aborted transaction are acceptable, duplicates are not.
 */
export async function nextQuotationNumber(tx: Tx, businessId: string): Promise<string> {
  const business = await tx.business.update({
    where: { id: businessId },
    data: { quotationNextSeq: { increment: 1 } },
    select: { quotationPrefix: true, quotationNextSeq: true },
  });
  return `${business.quotationPrefix}${business.quotationNextSeq - 1}`;
}

export async function nextInvoiceNumber(tx: Tx, businessId: string): Promise<string> {
  const business = await tx.business.update({
    where: { id: businessId },
    data: { invoiceNextSeq: { increment: 1 } },
    select: { invoicePrefix: true, invoiceNextSeq: true },
  });
  return `${business.invoicePrefix}${business.invoiceNextSeq - 1}`;
}
