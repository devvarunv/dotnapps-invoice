"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { PermissionError } from "@/lib/rbac";
import { paidAmount, computeEffectiveInvoiceStatus } from "@/lib/billing/invoice-status";
import { renderReminderTemplate, defaultReminderTemplate } from "@/lib/billing/reminders";
import { sendReminderSchema } from "@/lib/validation";
import { fieldErrors, formValue, type ActionState } from "@/lib/form";

export async function sendReminderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requirePermission("reminders:manage");
  } catch (e) {
    if (e instanceof PermissionError) {
      return { error: "You don't have permission to send reminders." };
    }
    throw e;
  }

  const parsed = sendReminderSchema.safeParse({
    invoiceId: formValue(formData, "invoiceId"),
    kind: formValue(formData, "kind"),
  });
  if (!parsed.success) {
    return { error: "Invalid request.", fieldErrors: fieldErrors(parsed.error) };
  }
  const { invoiceId, kind } = parsed.data;

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, businessId: ctx.business.id },
    include: {
      customer: true,
      allocations: { include: { payment: { select: { status: true } } } },
    },
  });
  if (!invoice) return { error: "That invoice no longer exists." };

  const paid = paidAmount(invoice.allocations);
  const effective = computeEffectiveInvoiceStatus({
    status: invoice.status,
    grandTotal: invoice.grandTotal,
    dueDate: invoice.dueDate,
    paid,
  });
  if (effective === "PAID" || effective === "CANCELLED" || effective === "DRAFT") {
    return { error: `This invoice is ${effective.toLowerCase()} — no reminder needed.` };
  }
  if (!invoice.dueDate) {
    return { error: "This invoice has no due date, so date-based reminders don't apply." };
  }

  const existing = await prisma.reminderEvent.findUnique({
    where: { invoiceId_kind: { invoiceId, kind } },
  });
  if (existing) {
    return { error: "This reminder was already sent for this invoice." };
  }

  const rule = await prisma.reminderRule.findUnique({
    where: { businessId_kind: { businessId: ctx.business.id, kind } },
  });
  const template = rule?.template ?? defaultReminderTemplate(kind);

  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/i/${invoice.publicToken}`;
  const message = renderReminderTemplate(template, {
    customerName: invoice.customer.name,
    invoiceNumber: invoice.number,
    amount: `${invoice.currency} ${invoice.grandTotal.sub(paid).toString()}`,
    dueDate: invoice.dueDate.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
    link: publicUrl,
  });

  await prisma.reminderEvent.create({
    data: { businessId: ctx.business.id, invoiceId, kind, sentById: ctx.user.id },
  });

  await recordAudit({
    action: "reminder.send",
    businessId: ctx.business.id,
    actorId: ctx.user.id,
    targetType: "Invoice",
    targetId: invoiceId,
    metadata: { kind },
  });

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/reminders");
  return {
    ok: true,
    message: "Reminder logged. Copy the message below to send it yourself — email/WhatsApp/SMS delivery ships in a later phase.",
    data: { text: message },
  };
}
