import type { Metadata } from "next";

import { requireSuperAdmin } from "@/lib/context";
import { prisma } from "@/lib/db";
import { Logo } from "@/components/brand";
import { signOutAction } from "@/app/(app)/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { AdminNav } from "./admin-nav";

export const metadata: Metadata = { title: "Super Admin" };

export default async function AdminDashboardPage() {
  await requireSuperAdmin();

  const [businessCount, userCount, subscriptionsByStatus, activeSubs, invoiceCount, quotationCount, paymentAgg] = await Promise.all([
    prisma.business.count(),
    prisma.user.count(),
    prisma.subscription.groupBy({ by: ["status"], _count: true }),
    prisma.subscription.findMany({ where: { status: "ACTIVE" }, include: { plan: { select: { priceMonthly: true } } } }),
    prisma.invoice.count(),
    prisma.quotation.count(),
    prisma.payment.aggregate({ where: { status: "ACTIVE" }, _sum: { amount: true } }),
  ]);

  const mrr = activeSubs.reduce((sum, s) => sum + Number(s.plan.priceMonthly), 0);
  const statusCount = (s: string) => subscriptionsByStatus.find((c) => c.status === s)?._count ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <Logo href="/admin" />
        <form action={signOutAction}>
          <button className="text-sm text-muted-foreground hover:text-foreground">Sign out</button>
        </form>
      </header>
      <AdminNav />

      <h1 className="mb-6 text-xl font-semibold tracking-tight">Platform overview</h1>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Businesses</CardTitle></CardHeader>
          <CardContent className="pt-0"><p className="text-2xl font-semibold">{businessCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Users</CardTitle></CardHeader>
          <CardContent className="pt-0"><p className="text-2xl font-semibold">{userCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Active subscriptions</CardTitle></CardHeader>
          <CardContent className="pt-0"><p className="text-2xl font-semibold">{statusCount("ACTIVE")}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">MRR (simulated)</CardTitle></CardHeader>
          <CardContent className="pt-0"><p className="text-2xl font-semibold">₹{mrr.toLocaleString("en-IN")}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Collected (all-time)</CardTitle></CardHeader>
          <CardContent className="pt-0"><p className="text-2xl font-semibold">₹{(paymentAgg._sum.amount ?? 0).toString()}</p></CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Subscriptions by status</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
            {(["TRIALING", "ACTIVE", "PAST_DUE", "GRACE", "SUSPENDED", "CANCELED"] as const).map((s) => (
              <div key={s}>
                <p className="text-lg font-semibold">{statusCount(s)}</p>
                <p className="text-[10px] text-muted-foreground">{s.toLowerCase()}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Platform volume</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-center">
            <div><p className="text-lg font-semibold">{invoiceCount}</p><p className="text-xs text-muted-foreground">invoices</p></div>
            <div><p className="text-lg font-semibold">{quotationCount}</p><p className="text-xs text-muted-foreground">quotations</p></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
