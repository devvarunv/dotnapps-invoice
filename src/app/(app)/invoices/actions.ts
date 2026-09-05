"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { PermissionError } from "@/lib/rbac";
import { canSendDocuments } from "@/lib/billing/readiness";
import { suspensionGuard, planLimitGuard } from "@/lib/billing/guard";
import { computeLineItem, computeDocumentTotals, determineSupplyType } from "@/lib/billing/tax";
import { nextInvoiceNumber } from "@/lib/billing/numbering";
import { invoiceFormSchema } from "@/lib/validation";
import { fieldErrors, formValue, type ActionState } from "@/lib/form";

function parseItems(raw: string): unknown {
  try {
    return JSON.parse(raw || "[]");
  } catch {
    return null;
  }
}

export async function saveInvoiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const invoiceId = formValue(formData, "invoiceId");
  let ctx;
  try {
    ctx = await requirePermission(invoiceId ? "invoices:edit" : "invoices:create");
  } catch (e) {
    if (e instanceof PermissionError) {
      return { error: "You don't have permission to do that." };
    }
    throw e;
  }

  const suspended = await suspensionGuard(ctx.business.id);
  if (suspended) return suspended;
  if (!invoiceId) {
    const limited = await planLimitGuard(ctx.business.id, "maxInvoicesPerMonth");
    if (limited) return limited;
  }

  const rawItems = parseItems(formValue(formData, "items"));
  if (rawItems === null) {
    return { error: "Something went wrong reading the line items. Please try again." };
  }

  const parsed = invoiceFormSchema.safeParse({
    customerId: formValue(formData, "customerId"),
    invoiceDate: formValue(formData, "invoiceDate"),
    dueDate: formValue(formData, "dueDate"),
    paymentTerms: formValue(formData, "paymentTerms"),
    notes: formValue(formData, "notes"),
    termsAndConditions: formValue(formData, "termsAndConditions"),
    items: rawItems,
  });
  if (!parsed.success) {
    return { error: "Check the fields below.", fieldErrors: fieldErrors(parsed.error) };
  }
  const data = parsed.data;

  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, businessId: ctx.business.id },
  });
  if (!customer) {
    return { error: "Select a valid customer.", fieldErrors: { customerId: "Select a customer." } };
  }

  const supplyType = determineSupplyType(ctx.business.state, customer.billingState);
  const computedItems = data.items.map((item) => computeLineItem(item));
  const totals = computeDocumentTotals(computedItems, supplyType);

  const itemsCreate = data.items.map((item, i) => ({
    productServiceId: item.productServiceId || null,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    rate: item.rate,
    discountPercent: item.discountPercent,
    taxRatePercent: item.taxRatePercent,
    amount: computedItems[i].amount,
    sortOrder: i,
  }));

  const totalsData = {
    customerId: customer.id,
    invoiceDate: new Date(data.invoiceDate),
    dueDate: data.dueDate ? new Date(data.dueDate) : null,
    paymentTerms: data.paymentTerms || null,
    notes: data.notes || null,
    termsAndConditions: data.termsAndConditions || null,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxableValue: totals.taxableValue,
    cgstTotal: totals.cgstTotal,
    sgstTotal: totals.sgstTotal,
    igstTotal: totals.igstTotal,
    grandTotal: totals.grandTotal,
  };

  let id = invoiceId;
  if (invoiceId) {
    const existing = await prisma.invoice.findFirst({
      where: { id: invoiceId, businessId: ctx.business.id },
    });
    if (!existing) return { error: "That invoice no longer exists." };
    if (existing.status !== "DRAFT") return { error: "Only a draft invoice can be edited." };

    await prisma.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({ where: { invoiceId } });
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { ...totalsData, items: { create: itemsCreate } },
      });
    });
    await recordAudit({
      action: "invoice.update",
      businessId: ctx.business.id,
      actorId: ctx.user.id,
      targetType: "Invoice",
      targetId: invoiceId,
    });
  } else {
    const created = await prisma.$transaction(async (tx) => {
      const number = await nextInvoiceNumber(tx, ctx.business.id);
      return tx.invoice.create({
        data: {
          businessId: ctx.business.id,
          number,
          currency: ctx.business.currency,
          publicToken: randomBytes(20).toString("hex"),
          createdById: ctx.user.id,
          ...totalsData,
          items: { create: itemsCreate },
        },
      });
    });
    id = created.id;
    await recordAudit({
      action: "invoice.create",
      businessId: ctx.business.id,
      actorId: ctx.user.id,
      targetType: "Invoice",
      targetId: created.id,
      metadata: { number: created.number, grandTotal: created.grandTotal.toString() },
    });
  }

  revalidatePath("/invoices");
  redirect(`/invoices/${id}`);
}

export async function sendInvoiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requirePermission("invoices:send");
  } catch (e) {
    if (e instanceof PermissionError) {
      return { error: "You don't have permission to send invoices." };
    }
    throw e;
  }

  if (!canSendDocuments(ctx.business)) {
    return {
      error: "Finish your business profile (address, city, state, contact) in Settings before sending documents.",
    };
  }

  const id = formValue(formData, "invoiceId");
  const invoice = await prisma.invoice.findFirst({ where: { id, businessId: ctx.business.id } });
  if (!invoice) return { error: "That invoice no longer exists." };
  if (invoice.status !== "DRAFT") return { error: "Only draft invoices can be sent." };

  await prisma.invoice.update({
    where: { id },
    data: { status: "SENT", sentAt: new Date() },
  });
  await recordAudit({
    action: "invoice.send",
    businessId: ctx.business.id,
    actorId: ctx.user.id,
    targetType: "Invoice",
    targetId: id,
  });

  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
  return { ok: true, message: "Invoice sent. Share the customer link below." };
}

export async function cancelInvoiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requirePermission("invoices:cancel");
  } catch (e) {
    if (e instanceof PermissionError) {
      return { error: "You don't have permission to cancel invoices." };
    }
    throw e;
  }

  const id = formValue(formData, "invoiceId");
  const invoice = await prisma.invoice.findFirst({ where: { id, businessId: ctx.business.id } });
  if (!invoice) return { error: "That invoice no longer exists." };
  if (invoice.status === "CANCELLED") return { ok: true, message: "Already cancelled." };

  await prisma.invoice.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  await recordAudit({
    action: "invoice.cancel",
    businessId: ctx.business.id,
    actorId: ctx.user.id,
    targetType: "Invoice",
    targetId: id,
  });

  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
  return { ok: true, message: "Invoice cancelled. It remains visible for audit purposes." };
}
