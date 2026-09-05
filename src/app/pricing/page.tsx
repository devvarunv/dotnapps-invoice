import Link from "next/link";
import type { Metadata } from "next";
import { Check } from "lucide-react";

import { prisma } from "@/lib/db";
import { ensureDefaultPlans } from "@/lib/billing/plans";
import { getPlanLimits, PLAN_LIMIT_LABELS, type PlanLimits } from "@/lib/billing/plans";
import { Logo } from "@/components/brand";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { buttonClassName } from "@/components/ui/button";

export const metadata: Metadata = { title: "Pricing" };

export default async function PricingPage() {
  await ensureDefaultPlans();
  const plans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  const metrics = Object.keys(PLAN_LIMIT_LABELS) as (keyof PlanLimits)[];

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
        <Logo href="/" />
        <nav className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">Log in</Link>
          <Link href="/signup" className={buttonClassName({ size: "sm" })}>Get started</Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight">Simple, transparent pricing</h1>
          <p className="mt-4 text-muted-foreground">
            Start on a 14-day trial. Upgrade or downgrade anytime — your data is never deleted, ever.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {plans.map((plan) => {
            const limits = getPlanLimits(plan);
            return (
              <Card key={plan.id} className={plan.sortOrder === 1 ? "border-primary shadow-md" : undefined}>
                <CardHeader>
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  <p className="text-3xl font-semibold">
                    {plan.currency} {plan.priceMonthly.toString()}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    {metrics.map((m) => (
                      <li key={m} className="flex items-center gap-2">
                        <Check className="size-4 shrink-0 text-primary" />
                        <span>{limits[m] ?? "Unlimited"} {PLAN_LIMIT_LABELS[m].toLowerCase()}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/signup" className={buttonClassName({ className: "w-full justify-center" })}>
                    Start free trial
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
