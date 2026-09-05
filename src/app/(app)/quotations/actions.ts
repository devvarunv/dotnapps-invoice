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
import { nextQuotationNumber, nextInvoiceNumber } from "@/lib/billing/numbering";
import { quotationFormSchema } from "@/lib/validation";
import { fieldErrors, formValue, type ActionState } from "@/lib/form";

function parseItems(raw: string): unknown {
  try {
    return JSON.parse(raw || "[]");
  } catch {
    return null;
  }
}

export async function saveQuotationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const quotationId = formValue(formData, "quotationId");
  let ctx;
  try {
    ctx = await requirePermission(quotationId ? "quotations:edit" : "quotations:create");
  } catch (e) {
    if (e instanceof PermissionError) {
      return { error: "You don't have permission to do that." };
    }
    throw e;
  }

  const suspended = await suspensionGuard(ctx.business.id);
  if (suspended) return suspended;
  if (!quotationId) {
    const limited = await planLimitGuard(ctx.business.id, "maxQuotationsPerMonth");
    if (limited) return limited;
  }

  const rawItems = parseItems(formValue(formData, "items"));
  if (rawItems === null) {
    return { error: "Something went wrong reading the line items. Please try again." };
  }

  const parsed = quotationFormSchema.safeParse({
    customerId: formValue(formData, "customerId"),
    quotationDate: formValue(formData, "quotationDate"),
    validUntil: formValue(formData, "validUntil"),
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
    quotationDate: new Date(data.quotationDate),
    validUntil: data.validUntil ? new Date(data.validUntil) : null,
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

  let id = quotationId;
  if (quotationId) {
    const existing = await prisma.quotation.findFirst({
      where: { id: quotationId, businessId: ctx.business.id },
    });
    if (!existing) return { error: "That quotation no longer exists." };
    if (existing.status !== "DRAFT") return { error: "Only a draft quotation can be edited." };

    await prisma.$transaction(async (tx) => {
      await tx.quotationItem.deleteMany({ where: { quotationId } });
      await tx.quotation.update({
        where: { id: quotationId },
        data: { ...totalsData, items: { create: itemsCreate } },
      });
    });
    await recordAudit({
      action: "quotation.update",
      businessId: ctx.business.id,
      actorId: ctx.user.id,
      targetType: "Quotation",
      targetId: quotationId,
    });
  } else {
    const created = await prisma.$transaction(async (tx) => {
      const number = await nextQuotationNumber(tx, ctx.business.id);
      return tx.quotation.create({
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
      action: "quotation.create",
      businessId: ctx.business.id,
      actorId: ctx.user.id,
      targetType: "Quotation",
      targetId: created.id,
      metadata: { number: created.number, grandTotal: created.grandTotal.toString() },
    });
  }

  revalidatePath("/quotations");
  redirect(`/quotations/${id}`);
}

export async function sendQuotationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requirePermission("quotations:send");
  } catch (e) {
    if (e instanceof PermissionError) {
      return { error: "You don't have permission to send quotations." };
    }
    throw e;
  }

  if (!canSendDocuments(ctx.business)) {
    return {
      error: "Finish your business profile (address, city, state, contact) in Settings before sending documents.",
    };
  }

  const id = formValue(formData, "quotationId");
  const quotation = await prisma.quotation.findFirst({
    where: { id, businessId: ctx.business.id },
  });
  if (!quotation) return { error: "That quotation no longer exists." };
  if (quotation.status !== "DRAFT") return { error: "Only draft quotations can be sent." };

  await prisma.quotation.update({
    where: { id },
    data: { status: "SENT", sentAt: new Date() },
  });
  await recordAudit({
    action: "quotation.send",
    businessId: ctx.business.id,
    actorId: ctx.user.id,
    targetType: "Quotation",
    targetId: id,
  });

  revalidatePath(`/quotations/${id}`);
  revalidatePath("/quotations");
  return { ok: true, message: "Quotation sent. Share the customer link below." };
}

export async function convertQuotationToInvoiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requirePermission("invoices:create");
  } catch (e) {
    if (e instanceof PermissionError) {
      return { error: "You don't have permission to create invoices." };
    }
    throw e;
  }

  const id = formValue(formData, "quotationId");
  const quotation = await prisma.quotation.findFirst({
    where: { id, businessId: ctx.business.id },
    include: { items: true, convertedInvoice: { select: { id: true } } },
  });
  if (!quotation) return { error: "That quotation no longer exists." };
  if (quotation.status !== "ACCEPTED") {
    return { error: "Only an accepted quotation can be converted to an invoice." };
  }
  if (quotation.convertedInvoice) {
    return { error: "This quotation has already been converted to an invoice." };
  }

  const invoice = await prisma.$transaction(async (tx) => {
    const number = await nextInvoiceNumber(tx, ctx.business.id);
    return tx.invoice.create({
      data: {
        businessId: ctx.business.id,
        customerId: quotation.customerId,
        quotationId: quotation.id,
        number,
        invoiceDate: new Date(),
        notes: quotation.notes,
        termsAndConditions: quotation.termsAndConditions,
        subtotal: quotation.subtotal,
        discountTotal: quotation.discountTotal,
        taxableValue: quotation.taxableValue,
        cgstTotal: quotation.cgstTotal,
        sgstTotal: quotation.sgstTotal,
        igstTotal: quotation.igstTotal,
        grandTotal: quotation.grandTotal,
        currency: quotation.currency,
        publicToken: randomBytes(20).toString("hex"),
        createdById: ctx.user.id,
        items: {
          create: quotation.items.map((item) => ({
            productServiceId: item.productServiceId,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            rate: item.rate,
            discountPercent: item.discountPercent,
            taxRatePercent: item.taxRatePercent,
            amount: item.amount,
            sortOrder: item.sortOrder,
          })),
        },
      },
    });
  });

  await recordAudit({
    action: "quotation.convert_to_invoice",
    businessId: ctx.business.id,
    actorId: ctx.user.id,
    targetType: "Invoice",
    targetId: invoice.id,
    metadata: { quotationId: quotation.id, quotationNumber: quotation.number, invoiceNumber: invoice.number },
  });

  revalidatePath(`/quotations/${id}`);
  redirect(`/invoices/${invoice.id}`);
}
