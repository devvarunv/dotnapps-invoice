import type { Metadata } from "next";

import { requireSuperAdmin } from "@/lib/context";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { Logo } from "@/components/brand";
import { signOutAction } from "@/app/(app)/actions";
import { Card } from "@/components/ui/primitives";
import { AdminNav } from "../admin-nav";
import { StatusForm } from "./status-form";

export const metadata: Metadata = { title: "Subscriptions · Super Admin" };

export default async function AdminSubscriptionsPage() {
  await requireSuperAdmin();

  const subscriptions = await prisma.subscription.findMany({
    orderBy: { createdAt: "desc" },
    include: { business: { select: { id: true, name: true } }, plan: { select: { name: true } } },
    take: 200,
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

      <h1 className="mb-1 text-xl font-semibold tracking-tight">Subscriptions</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Changing status here is a support override — businesses normally move through the lifecycle automatically
        or via Settings → Subscription.
      </p>

      <Card className="overflow-hidden p-0">
        <ul className="divide-y divide-border">
          {subscriptions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{s.business.name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.plan.name} · since {formatDate(s.createdAt)}
                  {s.currentPeriodEnd && ` · renews ${formatDate(s.currentPeriodEnd)}`}
                </p>
              </div>
              <StatusForm businessId={s.business.id} currentStatus={s.status} />
            </li>
          ))}
          {subscriptions.length === 0 && <li className="p-5 text-sm text-muted-foreground">No subscriptions yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
