import { prisma } from "@/lib/db";

/**
 * A plan's limits (spec §19 "Meter invoices, quotations, customers, team
 * members, bulk sends, ... storage as needed."). A missing/undefined key
 * means unlimited for that metric — app code never special-cases a plan
 * by name (spec: "Configurable plans and limits"), only by these numbers.
 */
export type PlanLimits = {
  maxUsers?: number;
  maxCustomers?: number;
  maxInvoicesPerMonth?: number;
  maxQuotationsPerMonth?: number;
  maxBulkSendsPerMonth?: number;
  maxStorageMB?: number;
};

export const PLAN_LIMIT_LABELS: Record<keyof PlanLimits, string> = {
  maxUsers: "Team members",
  maxCustomers: "Customers",
  maxInvoicesPerMonth: "Invoices / month",
  maxQuotationsPerMonth: "Quotations / month",
  maxBulkSendsPerMonth: "Bulk sends / month",
  maxStorageMB: "Receipt storage (MB)",
};

type DefaultPlan = {
  name: string;
  slug: string;
  priceMonthly: number;
  sortOrder: number;
  limits: PlanLimits;
};

export const DEFAULT_PLANS: DefaultPlan[] = [
  {
    name: "Starter",
    slug: "starter",
    priceMonthly: 0,
    sortOrder: 0,
    limits: { maxUsers: 2, maxCustomers: 20, maxInvoicesPerMonth: 10, maxQuotationsPerMonth: 10, maxBulkSendsPerMonth: 2, maxStorageMB: 50 },
  },
  {
    name: "Growth",
    slug: "growth",
    priceMonthly: 999,
    sortOrder: 1,
    limits: { maxUsers: 10, maxCustomers: 500, maxInvoicesPerMonth: 200, maxQuotationsPerMonth: 200, maxBulkSendsPerMonth: 20, maxStorageMB: 500 },
  },
  {
    name: "Scale",
    slug: "scale",
    priceMonthly: 2999,
    sortOrder: 2,
    // No limits set = unlimited on every metric.
    limits: {},
  },
];

/** Plans are platform-wide (unlike reminder rules/expense categories,
 * which are per-business) — seed once if the table is empty. */
export async function ensureDefaultPlans(): Promise<void> {
  const existing = await prisma.subscriptionPlan.count();
  if (existing > 0) return;

  await prisma.subscriptionPlan.createMany({
    data: DEFAULT_PLANS.map((p) => ({
      name: p.name,
      slug: p.slug,
      priceMonthly: p.priceMonthly,
      sortOrder: p.sortOrder,
      limits: p.limits,
    })),
    skipDuplicates: true,
  });
}

export function getPlanLimits(plan: { limits: unknown }): PlanLimits {
  return (plan.limits as PlanLimits) ?? {};
}
