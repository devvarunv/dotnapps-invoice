"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { PermissionError } from "@/lib/rbac";
import { paidAmount, computeEffectiveInvoiceStatus } from "@/lib/billing/invoice-status";
import { suspensionGuard, planLimitGuard } from "@/lib/billing/guard";
import { processBulkInvoice, type BulkInvoice } from "@/lib/bulk/process";
import { createBulkBatchSchema, bulkMarkPaidSchema } from "@/lib/validation";
import { fieldErrors, formValue, type ActionState } from "@/lib/form";

function parseIds(raw: string): unknown {
  try {
    return JSON.parse(raw || "[]");
  } catch {
    return null;
  }
}

const INVOICE_INCLUDE = {
  customer: true,
  allocations: { include: { payment: { select: { status: true } } } },
} as const;

/**
 * Create a batch and process every selected invoice. "Process
 * asynchronously in batches" (spec §11) is implemented as a loop that
 * writes each item's outcome independently rather than a real background
 * worker — there's no queue infrastructure in this app yet, and the per-
 * item work here (a couple of DB writes, no outbound network call to a
 * real messaging provider) is fast enough to do inline. The resilience
 * property spec actually cares about — one failure can't stop the batch —
 * holds regardless: each iteration is wrapped so a thrown error becomes a
 * FAILED item, not an aborted request.
 */
export async function createBulkBatchAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requirePermission("bulk:send");
  } catch (e) {
    if (e instanceof PermissionError) {
      return { error: "You don't have permission to send in bulk." };
    }
    throw e;
  }

  const suspended = await suspensionGuard(ctx.business.id);
  if (suspended) return suspended;
  const limited = await planLimitGuard(ctx.business.id, "maxBulkSendsPerMonth");
  if (limited) return limited;

  const rawIds = parseIds(formValue(formData, "invoiceIds"));
  if (rawIds === null) return { error: "Something went wrong reading the selection. Please try again." };

  const parsed = createBulkBatchSchema.safeParse({
    invoiceIds: rawIds,
    action: formValue(formData, "action"),
    channel: formValue(formData, "channel"),
  });
  if (!parsed.success) {
    return { error: "Check your selection.", fieldErrors: fieldErrors(parsed.error) };
  }
  const { invoiceIds, action, channel } = parsed.data;

  const invoices = await prisma.invoice.findMany({
    where: { id: { in: invoiceIds }, businessId: ctx.business.id },
    include: INVOICE_INCLUDE,
  });
  if (invoices.length === 0) return { error: "None of the selected invoices could be found." };

  const batch = await prisma.bulkSendBatch.create({
    data: {
      businessId: ctx.business.id,
      name: `${action === "SEND_INVOICE" ? "Invoice" : "Reminder"} batch — ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`,
      action,
      channel,
      totalCount: invoices.length,
      createdById: ctx.user.id,
    },
  });

  for (const invoice of invoices) {
    try {
      await processBulkInvoice(ctx.business, invoice as BulkInvoice, action, channel, batch.id);
    } catch (err) {
      console.error("[bulk] failed to process invoice", invoice.id, err);
      await prisma.bulkSendItem.upsert({
        where: { batchId_invoiceId: { batchId: batch.id, invoiceId: invoice.id } },
        create: { batchId: batch.id, invoiceId: invoice.id, status: "FAILED", failureReason: "Unexpected error." },
        update: { status: "FAILED", failureReason: "Unexpected error." },
      });
    }
  }

  const counts = await prisma.bulkSendItem.groupBy({
    by: ["status"],
    where: { batchId: batch.id },
    _count: true,
  });
  const countFor = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  await prisma.bulkSendBatch.update({
    where: { id: batch.id },
    data: { sentCount: countFor("SENT"), failedCount: countFor("FAILED"), skippedCount: countFor("SKIPPED") },
  });

  await recordAudit({
    action: "bulk.send",
    businessId: ctx.business.id,
    actorId: ctx.user.id,
    targetType: "BulkSendBatch",
    targetId: batch.id,
    metadata: { action, channel, total: invoices.length },
  });

  revalidatePath("/invoices/bulk");
  redirect(`/invoices/bulk/${batch.id}`);
}

/** Re-attempt only the items that didn't succeed — e.g. after fixing a
 * customer's missing email, or completing the business profile. */
export async function retryBulkBatchAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requirePermission("bulk:send");
  } catch (e) {
    if (e instanceof PermissionError) {
      return { error: "You don't have permission to send in bulk." };
    }
    throw e;
  }

  const batchId = formValue(formData, "batchId");
  const batch = await prisma.bulkSendBatch.findFirst({
    where: { id: batchId, businessId: ctx.business.id },
    include: { items: { where: { status: { in: ["FAILED", "SKIPPED"] } } } },
  });
  if (!batch) return { error: "That batch no longer exists." };
  if (batch.items.length === 0) return { ok: true, message: "Nothing left to retry." };

  const invoices = await prisma.invoice.findMany({
    where: { id: { in: batch.items.map((i) => i.invoiceId) }, businessId: ctx.business.id },
    include: INVOICE_INCLUDE,
  });

  for (const invoice of invoices) {
    try {
      await processBulkInvoice(ctx.business, invoice as BulkInvoice, batch.action, batch.channel, batch.id);
    } catch (err) {
      console.error("[bulk] retry failed for invoice", invoice.id, err);
    }
  }

  const counts = await prisma.bulkSendItem.groupBy({
    by: ["status"],
    where: { batchId: batch.id },
    _count: true,
  });
  const countFor = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  await prisma.bulkSendBatch.update({
    where: { id: batch.id },
    data: { sentCount: countFor("SENT"), failedCount: countFor("FAILED"), skippedCount: countFor("SKIPPED") },
  });

  await recordAudit({
    action: "bulk.retry",
    businessId: ctx.business.id,
    actorId: ctx.user.id,
    targetType: "BulkSendBatch",
    targetId: batch.id,
    metadata: { retried: batch.items.length },
  });

  revalidatePath(`/invoices/bulk/${batch.id}`);
  return { ok: true, message: `Retried ${batch.items.length} item(s).` };
}

/** Bulk "Mark as Paid" (spec §11) — records a full payment for every
 * selected invoice that still has a balance, skipping the rest. Not
 * tracked as a BulkSendBatch since there's no message/channel step; each
 * payment is individually reversible and audited like any other. */
export async function bulkMarkPaidAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requirePermission("payments:record");
  } catch (e) {
    if (e instanceof PermissionError) {
      return { error: "You don't have permission to record payments." };
    }
    throw e;
  }

  const rawIds = parseIds(formValue(formData, "invoiceIds"));
  if (rawIds === null) return { error: "Something went wrong reading the selection. Please try again." };
  const parsed = bulkMarkPaidSchema.safeParse({ invoiceIds: rawIds });
  if (!parsed.success) return { error: "Select at least one invoice." };

  const invoices = await prisma.invoice.findMany({
    where: { id: { in: parsed.data.invoiceIds }, businessId: ctx.business.id },
    include: { allocations: { include: { payment: { select: { status: true } } } } },
  });

  let marked = 0;
  let skipped = 0;

  for (const invoice of invoices) {
    const effective = computeEffectiveInvoiceStatus({
      status: invoice.status,
      grandTotal: invoice.grandTotal,
      dueDate: invoice.dueDate,
      paid: paidAmount(invoice.allocations),
    });
    if (invoice.status === "DRAFT" || effective === "CANCELLED" || effective === "PAID") {
      skipped += 1;
      continue;
    }

    const balance = invoice.grandTotal.sub(paidAmount(invoice.allocations));
    if (balance.lessThanOrEqualTo(0)) {
      skipped += 1;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          businessId: ctx.business.id,
          customerId: invoice.customerId,
          amount: balance,
          paymentDate: new Date(),
          method: "OTHER",
          notes: "Recorded via bulk ‘Mark as Paid’",
          createdById: ctx.user.id,
        },
      });
      await tx.paymentAllocation.create({
        data: { paymentId: payment.id, invoiceId: invoice.id, amount: balance },
      });
    });
    marked += 1;
  }

  await recordAudit({
    action: "bulk.mark_paid",
    businessId: ctx.business.id,
    actorId: ctx.user.id,
    targetType: "Invoice",
    metadata: { marked, skipped },
  });

  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  return { ok: true, message: `Marked ${marked} invoice(s) as paid${skipped > 0 ? `, skipped ${skipped}.` : "."}` };
}
