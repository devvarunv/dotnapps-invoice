import Link from "next/link";
import type { SubscriptionStatus } from "@prisma/client";
import { formatDate } from "@/lib/utils";

const TONE_CLASS: Record<"info" | "warning" | "danger", string> = {
  info: "bg-primary/10 text-primary",
  warning: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  danger: "bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-200",
};

/** Shown across the app shell whenever billing needs attention (spec §19)
 * — never blocks reading, only nudges toward Settings → Subscription. */
export function BillingBanner({
  status,
  trialEndsAt,
  graceEndsAt,
}: {
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  graceEndsAt: Date | null;
}) {
  let tone: "info" | "warning" | "danger" | null = null;
  let message: string | null = null;

  if (status === "TRIALING" && trialEndsAt) {
    tone = "info";
    message = `Trial ends ${formatDate(trialEndsAt)}.`;
  } else if (status === "PAST_DUE") {
    tone = "warning";
    message = "Your last payment didn't go through.";
  } else if (status === "GRACE" && graceEndsAt) {
    tone = "warning";
    message = `Subscription will be suspended on ${formatDate(graceEndsAt)} unless payment is resolved.`;
  } else if (status === "SUSPENDED") {
    tone = "danger";
    message = "Subscription suspended — new invoices, quotations and customers are blocked. Your data is safe.";
  } else if (status === "CANCELED") {
    tone = "warning";
    message = "Subscription cancelled.";
  }

  if (!tone || !message) return null;

  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-2 text-sm sm:px-6 lg:px-8 ${TONE_CLASS[tone]}`}>
      <span>{message}</span>
      <Link href="/settings/subscription" className="shrink-0 font-medium underline underline-offset-2">
        Manage
      </Link>
    </div>
  );
}
