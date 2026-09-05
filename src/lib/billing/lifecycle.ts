import type { SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Subscription lifecycle (spec §19: "Failed payment → retry/grace period
 * → possible suspension." / "Never delete business data because of
 * subscription status."). Two failure chains, both ending at SUSPENDED —
 * a status that blocks new writes (`assertWritable`) but never deletes or
 * hides existing data:
 *
 *   TRIALING --(trial ends)--> GRACE --(grace ends)--> SUSPENDED
 *   ACTIVE --(period ends)--> PAST_DUE --(still unpaid)--> GRACE --(grace ends)--> SUSPENDED
 *
 * Pure and unit-tested without a database — the batch runner below is the
 * only part that touches Prisma.
 */

const GRACE_DAYS = 7;
const PAST_DUE_GRACE_DAYS = 3;

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

export type LifecycleInput = {
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  graceEndsAt: Date | null;
};

export type LifecycleTransition = {
  nextStatus: SubscriptionStatus;
  graceEndsAt?: Date;
  suspendedAt?: Date;
} | null;

export function computeLifecycleTransition(sub: LifecycleInput, now: Date = new Date()): LifecycleTransition {
  switch (sub.status) {
    case "TRIALING":
      if (sub.trialEndsAt && sub.trialEndsAt <= now) {
        return { nextStatus: "GRACE", graceEndsAt: addDays(now, GRACE_DAYS) };
      }
      return null;

    case "ACTIVE":
      if (sub.currentPeriodEnd && sub.currentPeriodEnd <= now) {
        return { nextStatus: "PAST_DUE" };
      }
      return null;

    case "PAST_DUE":
      if (sub.currentPeriodEnd && addDays(sub.currentPeriodEnd, PAST_DUE_GRACE_DAYS) <= now) {
        return { nextStatus: "GRACE", graceEndsAt: addDays(now, GRACE_DAYS) };
      }
      return null;

    case "GRACE":
      if (sub.graceEndsAt && sub.graceEndsAt <= now) {
        return { nextStatus: "SUSPENDED", suspendedAt: now };
      }
      return null;

    // SUSPENDED and CANCELED are terminal until a human acts (reactivate
    // via a payment sim, or the business is deleted by its owner).
    default:
      return null;
  }
}

/** Applied by the `/api/billing/lifecycle` cron endpoint across every
 * subscription. Returns how many changed, for the caller to log. */
export async function runLifecycleForAllSubscriptions(now: Date = new Date()): Promise<number> {
  const subscriptions = await prisma.subscription.findMany({
    where: { status: { in: ["TRIALING", "ACTIVE", "PAST_DUE", "GRACE"] } },
  });

  let changed = 0;
  for (const sub of subscriptions) {
    const transition = computeLifecycleTransition(sub, now);
    if (!transition) continue;
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: transition.nextStatus,
        graceEndsAt: transition.graceEndsAt ?? sub.graceEndsAt,
        suspendedAt: transition.suspendedAt ?? sub.suspendedAt,
      },
    });
    changed += 1;
  }
  return changed;
}
