"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { requirePermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { PermissionError } from "@/lib/rbac";
import { paidAmount } from "@/lib/billing/invoice-status";
import { recordPaymentSchema, reversePaymentSchema } from "@/lib/validation";
import { fieldErrors, formValue, type ActionState } from "@/lib/form";

export async function recordPaymentAction(
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

  const parsed = recordPaymentSchema.safeParse({
    invoiceId: formValue(formData, "invoiceId"),
    amount: formValue(formData, "amount"),
    paymentDate: formValue(formData, "paymentDate"),
    method: formValue(formData, "method"),
    referenceId: formValue(formData, "referenceId"),
    notes: formValue(formData, "notes"),
  });
  if (!parsed.success) {
    return { error: "Check the fields below.", fieldErrors: fieldErrors(parsed.error) };
  }
  const data = parsed.data;

  const invoice = await prisma.invoice.findFirst({
    where: { id: data.invoiceId, businessId: ctx.business.id },
    include: { allocations: { include: { payment: { select: { status: true } } } } },
  });
  if (!invoice) return { error: "That invoice no longer exists." };
  if (invoice.status === "DRAFT") return { error: "Send the invoice before recording a payment." };
  if (invoice.status === "CANCELLED") return { error: "This invoice is cancelled." };

  const paid = paidAmount(invoice.allocations);
  const balance = invoice.grandTotal.sub(paid);
  const amount = new Prisma.Decimal(data.amount);

  if (amount.greaterThan(balance)) {
    return {
      fieldErrors: { amount: `Amount exceeds the outstanding balance of ${invoice.currency} ${balance.toString()}.` },
    };
  }

  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        businessId: ctx.business.id,
        customerId: invoice.customerId,
        amount,
        paymentDate: new Date(data.paymentDate),
        method: data.method,
        referenceId: data.referenceId || null,
        notes: data.notes || null,
        createdById: ctx.user.id,
      },
    });
    await tx.paymentAllocation.create({
      data: { paymentId: created.id, invoiceId: invoice.id, amount },
    });
    return created;
  });

  await recordAudit({
    action: "payment.record",
    businessId: ctx.business.id,
    actorId: ctx.user.id,
    targetType: "Payment",
    targetId: payment.id,
    metadata: { invoiceId: invoice.id, invoiceNumber: invoice.number, amount: amount.toString() },
  });

  revalidatePath(`/invoices/${invoice.id}`);
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  return { ok: true, message: "Payment recorded." };
}

export async function reversePaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requirePermission("payments:record");
  } catch (e) {
    if (e instanceof PermissionError) {
      return { error: "You don't have permission to reverse payments." };
    }
    throw e;
  }

  const parsed = reversePaymentSchema.safeParse({
    paymentId: formValue(formData, "paymentId"),
    reason: formValue(formData, "reason"),
  });
  if (!parsed.success) return { error: "Invalid request." };

  const payment = await prisma.payment.findFirst({
    where: { id: parsed.data.paymentId, businessId: ctx.business.id },
    include: { allocations: { select: { invoiceId: true } } },
  });
  if (!payment) return { error: "That payment no longer exists." };
  if (payment.status === "REVERSED") return { ok: true, message: "Already reversed." };

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "REVERSED", reversedAt: new Date(), reversalReason: parsed.data.reason || null },
  });

  await recordAudit({
    action: "payment.reverse",
    businessId: ctx.business.id,
    actorId: ctx.user.id,
    targetType: "Payment",
    targetId: payment.id,
    metadata: { reason: parsed.data.reason },
  });

  for (const alloc of payment.allocations) {
    revalidatePath(`/invoices/${alloc.invoiceId}`);
  }
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  return { ok: true, message: "Payment reversed. It remains visible for audit purposes." };
}
