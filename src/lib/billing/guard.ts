import { assertWritable, checkLimit, SuspendedError } from "./entitlements";
import { PLAN_LIMIT_LABELS, type PlanLimits } from "./plans";
import type { ActionState } from "@/lib/form";

/**
 * Server-action-friendly wrappers around the entitlements checks —
 * return an `ActionState` error instead of throwing, so callers can
 * `if (blocked) return blocked;` right after `requirePermission`.
 *
 * Wired into a representative set of create actions (customers, invoices,
 * quotations, team invites, bulk sends) rather than exhaustively every
 * mutation in the app — see README "Notes / next steps" for the honest
 * scope of what's actually enforced today.
 */

export async function suspensionGuard(businessId: string): Promise<ActionState | null> {
  try {
    await assertWritable(businessId);
    return null;
  } catch (e) {
    if (e instanceof SuspendedError) return { error: e.message };
    throw e;
  }
}

export async function planLimitGuard(businessId: string, metric: keyof PlanLimits): Promise<ActionState | null> {
  const check = await checkLimit(businessId, metric);
  if (check.ok) return null;
  return {
    error: `You've reached your plan's limit of ${check.limit} ${PLAN_LIMIT_LABELS[metric].toLowerCase()}. Upgrade in Settings → Subscription to continue.`,
  };
}
