import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { requireBusinessContext } from "@/lib/context";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getSubscription, computeUsage } from "@/lib/billing/entitlements";
import { getPlanLimits, PLAN_LIMIT_LABELS, type PlanLimits } from "@/lib/billing/plans";
import { formatDate } from "@/lib/utils";
import { DeniedState } from "@/components/app/denied";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle, Badge, Alert } from "@/components/ui/primitives";
import { UsageBar } from "./usage-bar";
import { ChangePlanButton, SimulatePaymentButton, CancelSubscriptionButton } from "./subscription-buttons";

export const metadata: Metadata = { title: "Subscription" };

const STATUS_TONE = {
  TRIALING: "brand",
  ACTIVE: "success",
  PAST_DUE: "warning",
  GRACE: "warning",
  SUSPENDED: "danger",
  CANCELED: "neutral",
} as const;

const STATUS_LABELS = {
  TRIALING: "Trial",
  ACTIVE: "Active",
  PAST_DUE: "Payment past due",
  GRACE: "Grace period",
  SUSPENDED: "Suspended",
  CANCELED: "Cancelled",
} as const;

export default async function SubscriptionSettingsPage() {
  const ctx = await requireBusinessContext();
  if (!can(ctx.role, "billing:manage")) return <DeniedState message="Only the business owner can manage billing." />;

  const [subscription, usage, plans] = await Promise.all([
    getSubscription(ctx.business.id),
    computeUsage(ctx.business.id),
    prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  const metrics = Object.keys(PLAN_LIMIT_LABELS) as (keyof PlanLimits)[];
  const currentLimits = getPlanLimits(subscription.plan);

  return (
    <div>
      <Link href="/settings" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Settings
      </Link>
      <PageHeader
        title="Subscription"
        description="Plan, usage limits and billing status."
        actions={<Badge tone={STATUS_TONE[subscription.status]}>{STATUS_LABELS[subscription.status]}</Badge>}
      />

      {subscription.status === "TRIALING" && subscription.trialEndsAt && (
        <Alert tone="info" className="mb-6">
          Trial ends {formatDate(subscription.trialEndsAt)}. Simulate a payment below to stay active afterward.
        </Alert>
      )}
      {subscription.status === "GRACE" && subscription.graceEndsAt && (
        <Alert tone="error" className="mb-6">
          Your subscription will be suspended on {formatDate(subscription.graceEndsAt)} unless payment is resolved.
        </Alert>
      )}
      {subscription.status === "PAST_DUE" && (
        <Alert tone="error" className="mb-6">
          Your last payment didn&apos;t go through. Simulate a payment below before the grace period begins.
        </Alert>
      )}
      {subscription.status === "SUSPENDED" && (
        <Alert tone="error" className="mb-6">
          Your subscription is suspended — new invoices, quotations, customers and team invites are blocked until you reactivate. Nothing has been deleted.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Current plan: {subscription.plan.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-2xl font-semibold">
              {subscription.plan.currency} {subscription.plan.priceMonthly.toString()}
              <span className="text-sm font-normal text-muted-foreground">/month</span>
            </p>
            <div className="space-y-3">
              {metrics.map((m) => (
                <UsageBar key={m} label={PLAN_LIMIT_LABELS[m]} current={usage[m]} limit={currentLimits[m]} />
              ))}
            </div>
            {subscription.currentPeriodEnd && subscription.status === "ACTIVE" && (
              <p className="text-xs text-muted-foreground">Renews {formatDate(subscription.currentPeriodEnd)} (simulated).</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sandbox billing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              No real payment gateway is configured — this simulates a successful charge so you can see the full
              subscription lifecycle without a live processor.
            </p>
            <SimulatePaymentButton />
            {subscription.status !== "CANCELED" && (
              <div className="border-t border-border pt-4">
                <CancelSubscriptionButton />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Available plans</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {plans.map((plan) => {
          const limits = getPlanLimits(plan);
          const isCurrent = plan.id === subscription.planId;
          return (
            <Card key={plan.id} className={isCurrent ? "border-primary" : undefined}>
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <p className="text-xl font-semibold">
                  {plan.currency} {plan.priceMonthly.toString()}<span className="text-xs font-normal text-muted-foreground">/mo</span>
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {metrics.map((m) => (
                    <li key={m}>{PLAN_LIMIT_LABELS[m]}: {limits[m] ?? "Unlimited"}</li>
                  ))}
                </ul>
                {isCurrent ? (
                  <Badge tone="brand">Current plan</Badge>
                ) : (
                  <ChangePlanButton
                    planId={plan.id}
                    label={plan.sortOrder > subscription.plan.sortOrder ? "Upgrade" : "Downgrade"}
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
