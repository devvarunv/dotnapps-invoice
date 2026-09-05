import Link from "next/link";
import type { Metadata } from "next";

import { requireSuperAdmin } from "@/lib/context";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { Logo } from "@/components/brand";
import { signOutAction } from "@/app/(app)/actions";
import { Card, Badge } from "@/components/ui/primitives";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AdminNav } from "../admin-nav";

export const metadata: Metadata = { title: "Businesses · Super Admin" };

const STATUS_TONE = {
  TRIALING: "brand",
  ACTIVE: "success",
  PAST_DUE: "warning",
  GRACE: "warning",
  SUSPENDED: "danger",
  CANCELED: "neutral",
} as const;

export default async function AdminBusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireSuperAdmin();
  const { q } = await searchParams;

  const businesses = await prisma.business.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      subscription: { include: { plan: { select: { name: true } } } },
      _count: { select: { memberships: true } },
    },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <Logo href="/admin" />
        <form action={signOutAction}>
          <button className="text-sm text-muted-foreground hover:text-foreground">Sign out</button>
        </form>
      </header>
      <AdminNav />

      <h1 className="mb-4 text-xl font-semibold tracking-tight">Businesses</h1>

      <form method="get" className="mb-4 flex gap-2">
        <Input name="q" defaultValue={q ?? ""} placeholder="Search by name…" className="max-w-xs" />
        <Button type="submit" size="sm">Search</Button>
      </form>

      <Card className="overflow-hidden p-0">
        <ul className="divide-y divide-border">
          {businesses.map((b) => (
            <li key={b.id}>
              <Link href={`/admin/businesses/${b.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-muted/50">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{b.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {b._count.memberships} member{b._count.memberships === 1 ? "" : "s"} · created {formatDate(b.createdAt)}
                  </p>
                </div>
                {b.subscription && (
                  <>
                    <span className="text-xs text-muted-foreground">{b.subscription.plan.name}</span>
                    <Badge tone={STATUS_TONE[b.subscription.status]}>{b.subscription.status}</Badge>
                  </>
                )}
              </Link>
            </li>
          ))}
          {businesses.length === 0 && <li className="p-5 text-sm text-muted-foreground">No businesses found.</li>}
        </ul>
      </Card>
    </div>
  );
}
