import { prisma } from "@/lib/db";
import { ensureDefaultPlans, getPlanLimits, type PlanLimits } from "./plans";

const TRIAL_DAYS = 14;

export class SuspendedError extends Error {
  constructor(message = "This business's subscription is suspended. Ask an owner to reactivate it in Settings → Subscription.") {
    super(message);
    this.name = "SuspendedError";
  }
}

export class PlanLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanLimitError";
  }
}

/** Lazily creates a TRIALING subscription on the entry-level plan for a
 * business that doesn't have one yet — same "ensure on first touch"
 * pattern as reminder rules (Phase 3) and expense categories (Phase 5).
 * Every business gets exactly one subscription (spec: "one/business"). */
export async function getSubscription(businessId: string) {
  await ensureDefaultPlans();

  const existing = await prisma.subscription.findUnique({
    where: { businessId },
    include: { plan: true },
  });
  if (existing) return existing;

  const entryPlan = await prisma.subscriptionPlan.findFirst({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  if (!entryPlan) throw new Error("No subscription plans configured.");

  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000);
  return prisma.subscription.create({
    data: { businessId, planId: entryPlan.id, status: "TRIALING", trialEndsAt },
    include: { plan: true },
  });
}

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

async function receiptStorageMB(businessId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ bytes: bigint | null }[]>`
    SELECT COALESCE(SUM(LENGTH("receiptData")), 0) AS bytes
    FROM "Expense"
    WHERE "businessId" = ${businessId}
  `;
  const bytes = Number(rows[0]?.bytes ?? 0);
  return Math.round((bytes / (1024 * 1024)) * 100) / 100;
}

async function currentCountFor(businessId: string, metric: keyof PlanLimits): Promise<number> {
  switch (metric) {
    case "maxUsers":
      return prisma.membership.count({ where: { businessId, status: "ACTIVE" } });
    case "maxCustomers":
      return prisma.customer.count({ where: { businessId, isArchived: false } });
    case "maxInvoicesPerMonth":
      return prisma.invoice.count({ where: { businessId, createdAt: { gte: startOfMonth() } } });
    case "maxQuotationsPerMonth":
      return prisma.quotation.count({ where: { businessId, createdAt: { gte: startOfMonth() } } });
    case "maxBulkSendsPerMonth":
      return prisma.bulkSendBatch.count({ where: { businessId, createdAt: { gte: startOfMonth() } } });
    case "maxStorageMB":
      return receiptStorageMB(businessId);
  }
}

export type UsageSnapshot = Record<keyof PlanLimits, number>;

/** Full usage snapshot for display (e.g. Settings → Subscription). */
export async function computeUsage(businessId: string): Promise<UsageSnapshot> {
  const metrics: (keyof PlanLimits)[] = [
    "maxUsers",
    "maxCustomers",
    "maxInvoicesPerMonth",
    "maxQuotationsPerMonth",
    "maxBulkSendsPerMonth",
    "maxStorageMB",
  ];
  const values = await Promise.all(metrics.map((m) => currentCountFor(businessId, m)));
  return Object.fromEntries(metrics.map((m, i) => [m, values[i]])) as UsageSnapshot;
}

export type LimitCheck = { ok: boolean; limit?: number; current: number };

/** Check a single metric before a create action — cheap (one count query)
 * so it's affordable to call inline in a mutation, not just for display. */
export async function checkLimit(businessId: string, metric: keyof PlanLimits): Promise<LimitCheck> {
  const subscription = await getSubscription(businessId);
  const limits = getPlanLimits(subscription.plan);
  const limit = limits[metric];
  const current = await currentCountFor(businessId, metric);
  if (limit === undefined || limit === null) return { ok: true, current };
  return { ok: current < limit, limit, current };
}

/** Blocks writes when the subscription is SUSPENDED. Spec: "Never delete
 * business data because of subscription status" — this only blocks new
 * mutations; every read path stays open regardless of status. */
export async function assertWritable(businessId: string): Promise<void> {
  const subscription = await getSubscription(businessId);
  if (subscription.status === "SUSPENDED") throw new SuspendedError();
}
