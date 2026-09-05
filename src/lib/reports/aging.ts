import { Prisma } from "@prisma/client";

/** Receivables aging buckets (spec §16: "current, 1–30, 31–60, 61–90, 90+ days"). */
export type AgingBucketKey = "current" | "d1_30" | "d31_60" | "d61_90" | "d90plus";

export const AGING_BUCKET_ORDER: AgingBucketKey[] = ["current", "d1_30", "d31_60", "d61_90", "d90plus"];

export const AGING_BUCKET_LABELS: Record<AgingBucketKey, string> = {
  current: "Current",
  d1_30: "1–30 days",
  d31_60: "31–60 days",
  d61_90: "61–90 days",
  d90plus: "90+ days",
};

/** No due date is treated as "current" — there's nothing to be overdue
 * against. An invoice due today or in the future is also "current". */
export function agingBucketFor(dueDate: Date | null, now: Date = new Date()): AgingBucketKey {
  if (!dueDate || dueDate >= now) return "current";
  const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000);
  if (daysPastDue <= 30) return "d1_30";
  if (daysPastDue <= 60) return "d31_60";
  if (daysPastDue <= 90) return "d61_90";
  return "d90plus";
}

export type AgingBucket = { count: number; amount: Prisma.Decimal };

function emptyBuckets(): Record<AgingBucketKey, AgingBucket> {
  return {
    current: { count: 0, amount: new Prisma.Decimal(0) },
    d1_30: { count: 0, amount: new Prisma.Decimal(0) },
    d31_60: { count: 0, amount: new Prisma.Decimal(0) },
    d61_90: { count: 0, amount: new Prisma.Decimal(0) },
    d90plus: { count: 0, amount: new Prisma.Decimal(0) },
  };
}

/** Buckets every invoice with a positive balance — callers should already
 * have excluded PAID/CANCELLED/DRAFT invoices; a zero-or-negative balance
 * here is just skipped defensively. Aging is always "as of now", not
 * bound to a reporting period — it doesn't make sense to filter it by an
 * arbitrary date range. */
export function computeReceivablesAging(
  invoices: { dueDate: Date | null; balance: Prisma.Decimal }[],
  now: Date = new Date(),
): Record<AgingBucketKey, AgingBucket> {
  const buckets = emptyBuckets();
  for (const inv of invoices) {
    if (inv.balance.lessThanOrEqualTo(0)) continue;
    const bucket = agingBucketFor(inv.dueDate, now);
    buckets[bucket].count += 1;
    buckets[bucket].amount = buckets[bucket].amount.add(inv.balance);
  }
  return buckets;
}
