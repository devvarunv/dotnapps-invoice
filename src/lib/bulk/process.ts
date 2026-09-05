import type { Business, Customer, Invoice, PaymentAllocation, ReminderChannel } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { paidAmount, computeEffectiveInvoiceStatus } from "@/lib/billing/invoice-status";
import { canSendDocuments } from "@/lib/billing/readiness";
import { renderReminderTemplate } from "@/lib/billing/reminders";
import { defaultBulkInvoiceTemplate, defaultBulkReminderTemplate } from "./templates";

export type BulkInvoice = Invoice & {
  customer: Customer;
  allocations: (PaymentAllocation & { payment: { status: "ACTIVE" | "REVERSED" } })[];
};

export type BulkItemOutcome = {
  status: "SENT" | "FAILED" | "SKIPPED";
  failureReason?: string;
  message?: string;
};

/**
 * Validate and (if valid) render the message for one invoice in a bulk
 * send/reminder batch. Pure — the caller writes the result and any status
 * transition, so one item's outcome never depends on another's and a
 * throw here can't corrupt the batch (spec: "one failure must not stop
 * the batch").
 */
export function evaluateBulkItem(
  business: Business,
  invoice: BulkInvoice,
  action: "SEND_INVOICE" | "SEND_REMINDER",
  channel: ReminderChannel,
): BulkItemOutcome {
  if (!canSendDocuments(business)) {
    return { status: "FAILED", failureReason: "Business profile is incomplete (address/city/state/contact)." };
  }

  const effective = computeEffectiveInvoiceStatus({
    status: invoice.status,
    grandTotal: invoice.grandTotal,
    dueDate: invoice.dueDate,
    paid: paidAmount(invoice.allocations),
  });

  if (effective === "CANCELLED") {
    return { status: "SKIPPED", failureReason: "Invoice is cancelled." };
  }
  if (action === "SEND_REMINDER") {
    if (invoice.status === "DRAFT") return { status: "SKIPPED", failureReason: "Invoice hasn't been sent yet." };
    if (effective === "PAID") return { status: "SKIPPED", failureReason: "Invoice is already paid." };
  }

  const contact = channel === "EMAIL" ? invoice.customer.email : invoice.customer.phone;
  if (!contact) {
    return {
      status: "SKIPPED",
      failureReason: `Customer has no ${channel === "EMAIL" ? "email address" : "phone number"} on file.`,
    };
  }

  const paid = paidAmount(invoice.allocations);
  const balance = invoice.grandTotal.sub(paid);
  const template = action === "SEND_INVOICE" ? defaultBulkInvoiceTemplate() : defaultBulkReminderTemplate();
  const link = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/i/${invoice.publicToken}`;
  const message = renderReminderTemplate(template, {
    customerName: invoice.customer.name,
    invoiceNumber: invoice.number,
    amount: `${invoice.currency} ${balance.toString()}`,
    dueDate: invoice.dueDate ? formatDate(invoice.dueDate) : "no due date set",
    link,
  });

  return { status: "SENT", message };
}

/**
 * Process one invoice within a batch: evaluate, persist the BulkSendItem
 * outcome, and — for a successful SEND_INVOICE on a still-draft invoice —
 * transition it to SENT, exactly like the single-invoice send action.
 * Wrapped in try/catch by the caller's loop, never here, so a DB error on
 * one item surfaces as a FAILED item rather than aborting the batch.
 */
export async function processBulkInvoice(
  business: Business,
  invoice: BulkInvoice,
  action: "SEND_INVOICE" | "SEND_REMINDER",
  channel: ReminderChannel,
  batchId: string,
): Promise<void> {
  const outcome = evaluateBulkItem(business, invoice, action, channel);

  if (outcome.status === "SENT" && action === "SEND_INVOICE" && invoice.status === "DRAFT") {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: "SENT", sentAt: new Date() },
    });
  }

  await prisma.bulkSendItem.upsert({
    where: { batchId_invoiceId: { batchId, invoiceId: invoice.id } },
    create: {
      batchId,
      invoiceId: invoice.id,
      status: outcome.status,
      failureReason: outcome.failureReason,
      message: outcome.message,
    },
    update: {
      status: outcome.status,
      failureReason: outcome.failureReason ?? null,
      message: outcome.message ?? null,
    },
  });
}
