import type { Metadata } from "next";

import { requireSuperAdmin } from "@/lib/context";
import { prisma } from "@/lib/db";
import { ensureDefaultPlans } from "@/lib/billing/plans";
import { Logo } from "@/components/brand";
import { signOutAction } from "@/app/(app)/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { AdminNav } from "../admin-nav";
import { PlanForm } from "./plan-form";
import { TogglePlanActiveButton } from "./toggle-active-button";

export const metadata: Metadata = { title: "Plans · Super Admin" };

export default async function AdminPlansPage() {
  await requireSuperAdmin();
  await ensureDefaultPlans();

  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { subscriptions: true } } },
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <Logo href="/admin" />
        <form action={signOutAction}>
          <button className="text-sm text-muted-foreground hover:text-foreground">Sign out</button>
        </form>
      </header>
      <AdminNav />

      <h1 className="mb-4 text-xl font-semibold tracking-tight">Plans</h1>

      <div className="space-y-6">
        {plans.map((plan) => (
          <Card key={plan.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{plan.name} <span className="font-normal text-muted-foreground">({plan._count.subscriptions} businesses)</span></CardTitle>
              <TogglePlanActiveButton planId={plan.id} isActive={plan.isActive} />
            </CardHeader>
            <CardContent>
              <PlanForm plan={plan} />
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <CardTitle>New plan</CardTitle>
          </CardHeader>
          <CardContent>
            <PlanForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
