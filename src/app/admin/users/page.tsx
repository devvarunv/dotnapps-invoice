import type { Metadata } from "next";

import { requireSuperAdmin } from "@/lib/context";
import { prisma } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { Logo } from "@/components/brand";
import { signOutAction } from "@/app/(app)/actions";
import { Card, Badge } from "@/components/ui/primitives";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AdminNav } from "../admin-nav";

export const metadata: Metadata = { title: "Users · Super Admin" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireSuperAdmin();
  const { q } = await searchParams;

  const users = await prisma.user.findMany({
    where: q
      ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }
      : undefined,
    orderBy: { createdAt: "desc" },
    include: { memberships: { include: { business: { select: { name: true } } } } },
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

      <h1 className="mb-4 text-xl font-semibold tracking-tight">Users</h1>

      <form method="get" className="mb-4 flex gap-2">
        <Input name="q" defaultValue={q ?? ""} placeholder="Search by name or email…" className="max-w-xs" />
        <Button type="submit" size="sm">Search</Button>
      </form>

      <Card className="overflow-hidden p-0">
        <ul className="divide-y divide-border">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {u.name}
                  {u.isSuperAdmin && <Badge tone="brand" className="ml-2">Super Admin</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {u.email} · joined {formatDate(u.createdAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {u.memberships.map((m) => (
                  <Badge key={m.id} tone="neutral">{m.business.name} · {ROLE_LABELS[m.role]}</Badge>
                ))}
              </div>
            </li>
          ))}
          {users.length === 0 && <li className="p-5 text-sm text-muted-foreground">No users found.</li>}
        </ul>
      </Card>
    </div>
  );
}
