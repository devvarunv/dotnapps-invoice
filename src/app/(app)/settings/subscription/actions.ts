"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { PermissionError } from "@/lib/rbac";
import { computeUsage } from "@/lib/billing/entitlements";
import { getPlanLimits, PLAN_LIMIT_LABELS, type PlanLimits } from "@/lib/billing/plans";
import { changePlanSchema } from "@/lib/validation";
import { fieldErrors, formValue, type ActionState } from "@/lib/form";

/**
 * Immediate upgrade, safe downgrade (spec §19: "Immediate upgrade
 * behavior; safe downgrade behavior."). Upgrading always succeeds; a
 * downgrade is blocked if current usage already exceeds any limit on the
 * target plan, with the specific metric named rather than a generic
 * "can't downgrade" message.
 */
export async function changePlanAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requirePermission("billing:manage");
  } catch (e) {
    if (e instanceof PermissionError) {
      return { error: "Only the business owner can change plans." };
    }
    throw e;
  }

  const parsed = changePlanSchema.safeParse({ planId: formValue(formData, "planId") });
  if (!parsed.success) return { error: "Select a plan.", fieldErrors: fieldErrors(parsed.error) };

  const targetPlan = await prisma.subscriptionPlan.findFirst({
    where: { id: parsed.data.planId, isActive: true },
  });
  if (!targetPlan) return { error: "That plan is no longer available." };

  const usage = await computeUsage(ctx.business.id);
  const limits = getPlanLimits(targetPlan);
  const overLimit = (Object.keys(limits) as (keyof PlanLimits)[]).find((metric) => {
    const limit = limits[metric];
    return limit !== undefined && limit !== null && usage[metric] > limit;
  });
  if (overLimit) {
    return {
      error: `Can't switch to ${targetPlan.name} — you're using ${usage[overLimit]} ${PLAN_LIMIT_LABELS[overLimit].toLowerCase()}, which is over that plan's limit of ${limits[overLimit]}. Reduce usage first, or choose a higher plan.`,
    };
  }

  await prisma.subscription.update({
    where: { businessId: ctx.business.id },
    data: { planId: targetPlan.id },
  });
  await recordAudit({
    action: "subscription.change_plan",
    businessId: ctx.business.id,
    actorId: ctx.user.id,
    targetType: "Subscription",
    metadata: { planId: targetPlan.id, planName: targetPlan.name },
  });

  revalidatePath("/settings/subscription");
  return { ok: true, message: `Switched to the ${targetPlan.name} plan.` };
}

/** Sandbox payment simulation — there's no real payment gateway anywhere
 * in this app (spec explicitly excludes AI/real integrations beyond core
 * billing), so this is the honest stand-in: it does exactly what it says,
 * moves the subscription to ACTIVE for a 30-day period, and is clearly
 * labeled as a simulation in the UI. */
export async function simulatePaymentAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requirePermission("billing:manage");
  } catch (e) {
    if (e instanceof PermissionError) {
      return { error: "Only the business owner can manage billing." };
    }
    throw e;
  }

  const currentPeriodEnd = new Date(Date.now() + 30 * 86_400_000);
  await prisma.subscription.update({
    where: { businessId: ctx.business.id },
    data: { status: "ACTIVE", currentPeriodEnd, graceEndsAt: null, suspendedAt: null, cancelledAt: null },
  });
  await recordAudit({
    action: "subscription.simulate_payment",
    businessId: ctx.business.id,
    actorId: ctx.user.id,
    targetType: "Subscription",
  });

  revalidatePath("/settings/subscription");
  return { ok: true, message: "Payment simulated. Subscription is now active for 30 days." };
}

/** Cancellation never deletes data (spec §19) — it only marks the
 * subscription CANCELED; every record the business created stays put. */
export async function cancelSubscriptionAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requirePermission("billing:manage");
  } catch (e) {
    if (e instanceof PermissionError) {
      return { error: "Only the business owner can manage billing." };
    }
    throw e;
  }

  await prisma.subscription.update({
    where: { businessId: ctx.business.id },
    data: { status: "CANCELED", cancelledAt: new Date() },
  });
  await recordAudit({
    action: "subscription.cancel",
    businessId: ctx.business.id,
    actorId: ctx.user.id,
    targetType: "Subscription",
  });

  revalidatePath("/settings/subscription");
  return { ok: true, message: "Subscription cancelled. Your data is safe — reactivate anytime." };
}
