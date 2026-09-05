"use server";

import { revalidatePath } from "next/cache";

import { requireSuperAdmin } from "@/lib/context";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import type { PlanLimits } from "@/lib/billing/plans";
import { planFormSchema, setSubscriptionStatusSchema } from "@/lib/validation";
import { fieldErrors, formValue, type ActionState } from "@/lib/form";

function limitField(formData: FormData, key: string): number | undefined {
  const raw = formValue(formData, key);
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Create or update a subscription plan. Super-admin only — plans are
 * platform-wide, not scoped to any business. */
export async function savePlanAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireSuperAdmin();

  const parsed = planFormSchema.safeParse({
    name: formValue(formData, "name"),
    slug: formValue(formData, "slug"),
    priceMonthly: formValue(formData, "priceMonthly"),
    sortOrder: formValue(formData, "sortOrder") || "0",
    maxUsers: formValue(formData, "maxUsers"),
    maxCustomers: formValue(formData, "maxCustomers"),
    maxInvoicesPerMonth: formValue(formData, "maxInvoicesPerMonth"),
    maxQuotationsPerMonth: formValue(formData, "maxQuotationsPerMonth"),
    maxBulkSendsPerMonth: formValue(formData, "maxBulkSendsPerMonth"),
    maxStorageMB: formValue(formData, "maxStorageMB"),
  });
  if (!parsed.success) {
    return { error: "Check the fields below.", fieldErrors: fieldErrors(parsed.error) };
  }
  const data = parsed.data;

  const limits: PlanLimits = {
    maxUsers: limitField(formData, "maxUsers"),
    maxCustomers: limitField(formData, "maxCustomers"),
    maxInvoicesPerMonth: limitField(formData, "maxInvoicesPerMonth"),
    maxQuotationsPerMonth: limitField(formData, "maxQuotationsPerMonth"),
    maxBulkSendsPerMonth: limitField(formData, "maxBulkSendsPerMonth"),
    maxStorageMB: limitField(formData, "maxStorageMB"),
  };

  const planId = formValue(formData, "planId");
  if (planId) {
    const existing = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!existing) return { error: "That plan no longer exists." };
    await prisma.subscriptionPlan.update({
      where: { id: planId },
      data: { name: data.name, slug: data.slug, priceMonthly: data.priceMonthly, sortOrder: data.sortOrder, limits },
    });
  } else {
    await prisma.subscriptionPlan.create({
      data: { name: data.name, slug: data.slug, priceMonthly: data.priceMonthly, sortOrder: data.sortOrder, limits },
    });
  }

  await recordAudit({
    action: planId ? "admin.plan.update" : "admin.plan.create",
    actorId: admin.id,
    targetType: "SubscriptionPlan",
    metadata: { name: data.name },
  });

  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
  revalidatePath("/settings/subscription");
  return { ok: true, message: planId ? "Plan updated." : "Plan created." };
}

export async function togglePlanActiveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireSuperAdmin();
  const planId = formValue(formData, "planId");
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan) return { error: "That plan no longer exists." };

  await prisma.subscriptionPlan.update({ where: { id: planId }, data: { isActive: !plan.isActive } });
  await recordAudit({
    action: plan.isActive ? "admin.plan.deactivate" : "admin.plan.activate",
    actorId: admin.id,
    targetType: "SubscriptionPlan",
    targetId: planId,
  });

  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
  return { ok: true };
}

/** Support override — lets a super admin manually move a stuck
 * subscription (e.g. reactivate a business that paid outside the sandbox
 * flow, or investigate a support ticket). Distinct from the
 * business-facing `simulatePaymentAction` in Settings → Subscription. */
export async function setSubscriptionStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireSuperAdmin();

  const parsed = setSubscriptionStatusSchema.safeParse({
    businessId: formValue(formData, "businessId"),
    status: formValue(formData, "status"),
  });
  if (!parsed.success) return { error: "Invalid request." };

  const subscription = await prisma.subscription.findUnique({ where: { businessId: parsed.data.businessId } });
  if (!subscription) return { error: "That business has no subscription record." };

  await prisma.subscription.update({
    where: { businessId: parsed.data.businessId },
    data: {
      status: parsed.data.status,
      suspendedAt: parsed.data.status === "SUSPENDED" ? new Date() : subscription.suspendedAt,
      cancelledAt: parsed.data.status === "CANCELED" ? new Date() : subscription.cancelledAt,
    },
  });

  await recordAudit({
    action: "admin.subscription.set_status",
    actorId: admin.id,
    businessId: parsed.data.businessId,
    targetType: "Subscription",
    metadata: { status: parsed.data.status },
  });

  revalidatePath("/admin/subscriptions");
  return { ok: true, message: `Status set to ${parsed.data.status}.` };
}
