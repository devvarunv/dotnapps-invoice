"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { PermissionError } from "@/lib/rbac";
import { suspensionGuard, planLimitGuard } from "@/lib/billing/guard";
import { customerSchema } from "@/lib/validation";
import { fieldErrors, formValue, type ActionState } from "@/lib/form";

function boolField(fd: FormData, key: string): boolean {
  return formValue(fd, key) === "on" || formValue(fd, key) === "true";
}

export async function saveCustomerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const customerId = formValue(formData, "customerId");
  const permission = customerId ? "customers:edit" : "customers:create";

  let ctx;
  try {
    ctx = await requirePermission(permission);
  } catch (e) {
    if (e instanceof PermissionError) {
      return { error: "You don't have permission to do that." };
    }
    throw e;
  }

  const suspended = await suspensionGuard(ctx.business.id);
  if (suspended) return suspended;
  if (!customerId) {
    const limited = await planLimitGuard(ctx.business.id, "maxCustomers");
    if (limited) return limited;
  }

  const parsed = customerSchema.safeParse({
    name: formValue(formData, "name"),
    companyName: formValue(formData, "companyName"),
    email: formValue(formData, "email"),
    phone: formValue(formData, "phone"),
    gstin: formValue(formData, "gstin"),
    billingAddressLine1: formValue(formData, "billingAddressLine1"),
    billingAddressLine2: formValue(formData, "billingAddressLine2"),
    billingCity: formValue(formData, "billingCity"),
    billingState: formValue(formData, "billingState"),
    billingPostalCode: formValue(formData, "billingPostalCode"),
    billingCountry: formValue(formData, "billingCountry") || "IN",
    shippingSameAsBilling: boolField(formData, "shippingSameAsBilling"),
    shippingAddressLine1: formValue(formData, "shippingAddressLine1"),
    shippingAddressLine2: formValue(formData, "shippingAddressLine2"),
    shippingCity: formValue(formData, "shippingCity"),
    shippingState: formValue(formData, "shippingState"),
    shippingPostalCode: formValue(formData, "shippingPostalCode"),
    shippingCountry: formValue(formData, "shippingCountry"),
    notes: formValue(formData, "notes"),
  });
  if (!parsed.success) {
    return { error: "Check the fields below.", fieldErrors: fieldErrors(parsed.error) };
  }

  const data = parsed.data;
  const values = {
    name: data.name,
    companyName: data.companyName || null,
    email: data.email || null,
    phone: data.phone || null,
    gstin: data.gstin || null,
    billingAddressLine1: data.billingAddressLine1 || null,
    billingAddressLine2: data.billingAddressLine2 || null,
    billingCity: data.billingCity || null,
    billingState: data.billingState || null,
    billingPostalCode: data.billingPostalCode || null,
    billingCountry: data.billingCountry,
    shippingSameAsBilling: data.shippingSameAsBilling,
    shippingAddressLine1: data.shippingSameAsBilling ? null : data.shippingAddressLine1 || null,
    shippingAddressLine2: data.shippingSameAsBilling ? null : data.shippingAddressLine2 || null,
    shippingCity: data.shippingSameAsBilling ? null : data.shippingCity || null,
    shippingState: data.shippingSameAsBilling ? null : data.shippingState || null,
    shippingPostalCode: data.shippingSameAsBilling ? null : data.shippingPostalCode || null,
    shippingCountry: data.shippingSameAsBilling ? null : data.shippingCountry || null,
    notes: data.notes || null,
  };

  let id = customerId;
  if (customerId) {
    const existing = await prisma.customer.findFirst({
      where: { id: customerId, businessId: ctx.business.id },
    });
    if (!existing) return { error: "That customer no longer exists." };

    await prisma.customer.update({ where: { id: customerId }, data: values });
    await recordAudit({
      action: "customer.update",
      businessId: ctx.business.id,
      actorId: ctx.user.id,
      targetType: "Customer",
      targetId: customerId,
    });
  } else {
    const created = await prisma.customer.create({
      data: { ...values, businessId: ctx.business.id, createdById: ctx.user.id },
    });
    id = created.id;
    await recordAudit({
      action: "customer.create",
      businessId: ctx.business.id,
      actorId: ctx.user.id,
      targetType: "Customer",
      targetId: created.id,
      metadata: { name: created.name },
    });
  }

  revalidatePath("/customers");
  redirect(`/customers/${id}`);
}

export async function archiveCustomerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requirePermission("customers:delete");
  } catch (e) {
    if (e instanceof PermissionError) {
      return { error: "You don't have permission to do that." };
    }
    throw e;
  }

  const customerId = formValue(formData, "customerId");
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId: ctx.business.id },
  });
  if (!customer) return { error: "That customer no longer exists." };

  await prisma.customer.update({
    where: { id: customerId },
    data: { isArchived: !customer.isArchived },
  });
  await recordAudit({
    action: customer.isArchived ? "customer.unarchive" : "customer.archive",
    businessId: ctx.business.id,
    actorId: ctx.user.id,
    targetType: "Customer",
    targetId: customerId,
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  return { ok: true, message: customer.isArchived ? "Customer restored." : "Customer archived." };
}
