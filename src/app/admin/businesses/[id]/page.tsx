import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { requireSuperAdmin } from "@/lib/context";
import { prisma } from "@/lib/db";
import { computeUsage } from "@/lib/billing/entitlements";
import { getPlanLimits, PLAN_LIMIT_LABELS, type PlanLimits } from "@/lib/billing/plans";
import { ROLE_LABELS } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Business · Super Admin" };

export default async function AdminBusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireSuperAdmin();

  const business = await prisma.business.findUnique({
    where: { id },
    include: {
      subscription: { include: { plan: true } },
      memberships: { include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!business) notFound();

  const usage = business.subscription ? await computeUsage(business.id) : null;
  const limits = business.subscription ? getPlanLimits(business.subscription.plan) : null;
  const metrics = Object.keys(PLAN_LIMIT_LABELS) as (keyof PlanLimits)[];

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/admin/businesses" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Businesses
      </Link>
      <h1 className="mb-1 text-xl font-semibold tracking-tight">{business.name}</h1>
      <p className="mb-6 text-sm text-muted-foreground">Created {formatDate(business.createdAt)} · {business.city ?? "—"}, {business.state ?? "—"}</p>

      {business.subscription && usage && limits && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Subscription: {business.subscription.plan.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm"><Badge>{business.subscription.status}</Badge></p>
            <ul className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
              {metrics.map((m) => (
                <li key={m}>{PLAN_LIMIT_LABELS[m]}: {usage[m]} / {limits[m] ?? "∞"}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Members ({business.memberships.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {business.memberships.map((m) => (
              <li key={m.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <p className="font-medium">{m.user.name}</p>
                  <p className="text-xs text-muted-foreground">{m.user.email}</p>
                </div>
                <Badge tone={m.role === "OWNER" ? "brand" : "neutral"}>{ROLE_LABELS[m.role]}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
