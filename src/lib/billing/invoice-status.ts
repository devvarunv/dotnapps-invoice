import { Prisma, type InvoiceStatus } from "@prisma/client";

/**
 * Derived display status for an invoice (spec: "DRAFT → SENT → VIEWED →
 * PARTIALLY PAID → PAID; unpaid invoices become OVERDUE after due date.").
 *
 * Deliberately NOT stored on the Invoice row. Spec's own acceptance
 * criterion is "Overdue status is deterministic and safe against stale
 * jobs" — a stored status needs a cron to flip it when the due date
 * passes, and that cron can fail to run. Computing it from `dueDate` and
 * ACTIVE payment allocations at read time can't go stale.
 */
export type EffectiveInvoiceStatus =
  | "DRAFT"
  | "SENT"
  | "VIEWED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

export function paidAmount(
  allocations: { amount: Prisma.Decimal; payment: { status: "ACTIVE" | "REVERSED" } }[],
): Prisma.Decimal {
  return allocations
    .filter((a) => a.payment.status === "ACTIVE")
    .reduce((sum, a) => sum.add(a.amount), new Prisma.Decimal(0));
}

export function computeEffectiveInvoiceStatus(invoice: {
  status: InvoiceStatus;
  grandTotal: Prisma.Decimal;
  dueDate: Date | null;
  paid: Prisma.Decimal;
}): EffectiveInvoiceStatus {
  if (invoice.status === "DRAFT" || invoice.status === "CANCELLED") {
    return invoice.status;
  }

  const balance = invoice.grandTotal.sub(invoice.paid);
  if (balance.lessThanOrEqualTo(0)) return "PAID";

  const isOverdue = invoice.dueDate !== null && invoice.dueDate < new Date();
  if (isOverdue) return "OVERDUE";

  if (invoice.paid.greaterThan(0)) return "PARTIALLY_PAID";

  // SENT or VIEWED, not overdue, nothing paid yet.
  return invoice.status;
}

export const EFFECTIVE_STATUS_LABELS: Record<EffectiveInvoiceStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  VIEWED: "Viewed",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};

export const EFFECTIVE_STATUS_TONE: Record<
  EffectiveInvoiceStatus,
  "neutral" | "brand" | "success" | "warning" | "danger"
> = {
  DRAFT: "neutral",
  SENT: "brand",
  VIEWED: "brand",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "danger",
  CANCELLED: "danger",
};
