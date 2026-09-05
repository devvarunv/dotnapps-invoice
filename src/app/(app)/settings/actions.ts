"use server";

import { revalidatePath } from "next/cache";

import { requireBusinessContext, requirePermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { PermissionError } from "@/lib/rbac";
import {
  businessProfileSchema,
  changePasswordSchema,
  updateProfileSchema,
} from "@/lib/validation";
import { fieldErrors, formValue, type ActionState } from "@/lib/form";
import { rateLimit, clientIp, RATE_LIMITS } from "@/lib/rate-limit";

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireBusinessContext();

  const parsed = updateProfileSchema.safeParse({
    name: formValue(formData, "name"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error) };
  }

  await prisma.user.update({
    where: { id: ctx.user.id },
    data: { name: parsed.data.name },
  });
  await recordAudit({
    action: "profile.update",
    businessId: ctx.business.id,
    actorId: ctx.user.id,
    targetType: "User",
    targetId: ctx.user.id,
  });

  revalidatePath("/settings/profile");
  return { ok: true, message: "Profile updated." };
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireBusinessContext();

  const ip = await clientIp();
  const rl = rateLimit(
    `pwchange:${ctx.user.id}:${ip}`,
    RATE_LIMITS.passwordChange.limit,
    RATE_LIMITS.passwordChange.windowMs,
  );
  if (!rl.allowed) {
    return { error: `Too many attempts. Try again in ${Math.ceil(rl.retryAfterSeconds / 60)} minute(s).` };
  }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formValue(formData, "currentPassword"),
    newPassword: formValue(formData, "newPassword"),
    confirmPassword: formValue(formData, "confirmPassword"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error) };
  }

  const fresh = await prisma.user.findUniqueOrThrow({
    where: { id: ctx.user.id },
  });
  const ok = await verifyPassword(parsed.data.currentPassword, fresh.passwordHash);
  if (!ok) {
    return { fieldErrors: { currentPassword: "That password is incorrect." } };
  }

  await prisma.user.update({
    where: { id: ctx.user.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  });
  await recordAudit({
    action: "profile.password_change",
    businessId: ctx.business.id,
    actorId: ctx.user.id,
    targetType: "User",
    targetId: ctx.user.id,
  });

  return { ok: true, message: "Password changed." };
}

export async function updateBusinessAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requirePermission("business:manage");
  } catch (e) {
    if (e instanceof PermissionError) {
      return { error: "You don't have permission to edit business settings." };
    }
    throw e;
  }

  const parsed = businessProfileSchema.safeParse({
    name: formValue(formData, "name"),
    contactEmail: formValue(formData, "contactEmail"),
    contactPhone: formValue(formData, "contactPhone"),
    addressLine1: formValue(formData, "addressLine1"),
    addressLine2: formValue(formData, "addressLine2"),
    city: formValue(formData, "city"),
    state: formValue(formData, "state"),
    postalCode: formValue(formData, "postalCode"),
    country: formValue(formData, "country") || "IN",
    gstin: formValue(formData, "gstin"),
    registrationType: formValue(formData, "registrationType") || "UNREGISTERED",
    currency: formValue(formData, "currency") || "INR",
    quotationPrefix: formValue(formData, "quotationPrefix"),
    invoicePrefix: formValue(formData, "invoicePrefix"),
    bankAccountName: formValue(formData, "bankAccountName"),
    bankAccountNumber: formValue(formData, "bankAccountNumber"),
    bankIfsc: formValue(formData, "bankIfsc"),
    bankName: formValue(formData, "bankName"),
    upiId: formValue(formData, "upiId"),
  });
  if (!parsed.success) {
    return { error: "Check the fields below.", fieldErrors: fieldErrors(parsed.error) };
  }

  const data = parsed.data;
  await prisma.business.update({
    where: { id: ctx.business.id },
    data: {
      name: data.name,
      contactEmail: data.contactEmail || null,
      contactPhone: data.contactPhone || null,
      addressLine1: data.addressLine1 || null,
      addressLine2: data.addressLine2 || null,
      city: data.city || null,
      state: data.state || null,
      postalCode: data.postalCode || null,
      country: data.country,
      gstin: data.gstin || null,
      registrationType: data.registrationType,
      currency: data.currency,
      quotationPrefix: data.quotationPrefix || undefined,
      invoicePrefix: data.invoicePrefix || undefined,
      bankAccountName: data.bankAccountName || null,
      bankAccountNumber: data.bankAccountNumber || null,
      bankIfsc: data.bankIfsc || null,
      bankName: data.bankName || null,
      upiId: data.upiId || null,
    },
  });

  await recordAudit({
    action: "business.update",
    businessId: ctx.business.id,
    actorId: ctx.user.id,
    targetType: "Business",
    targetId: ctx.business.id,
  });

  revalidatePath("/", "layout");
  return { ok: true, message: "Business settings saved." };
}
