import type { Metadata } from "next";

import { requireSuperAdmin } from "@/lib/context";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { Logo } from "@/components/brand";
import { signOutAction } from "@/app/(app)/actions";
import { Card, Badge } from "@/components/ui/primitives";
import { buttonClassName } from "@/components/ui/button";
import Link from "next/link";
import { AdminNav } from "../admin-nav";

export const metadata: Metadata = { title: "Audit log · Super Admin" };

const PAGE_SIZE = 50;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireSuperAdmin();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { name: true, email: true } }, business: { select: { name: true } } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <Logo href="/admin" />
        <form action={signOutAction}>
          <button className="text-sm text-muted-foreground hover:text-foreground">Sign out</button>
        </form>
      </header>
      <AdminNav />

      <h1 className="mb-4 text-xl font-semibold tracking-tight">Audit log</h1>
      <p className="mb-4 text-sm text-muted-foreground">Privileged, cross-business view of every audited mutation on the platform.</p>

      <Card className="overflow-hidden p-0">
        <ul className="divide-y divide-border">
          {logs.map((log) => (
            <li key={log.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
              <Badge tone="neutral">{log.action}</Badge>
              <span className="text-muted-foreground">{log.business?.name ?? "—"}</span>
              <span className="text-muted-foreground">{log.actor ? `${log.actor.name} (${log.actor.email})` : "system"}</span>
              <span className="ml-auto text-xs text-muted-foreground">{formatDate(log.createdAt)}</span>
            </li>
          ))}
          {logs.length === 0 && <li className="p-5 text-sm text-muted-foreground">No audit entries yet.</li>}
        </ul>
      </Card>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={`/admin/audit?page=${page - 1}`} className={buttonClassName({ variant: "outline", size: "sm" })}>Previous</Link>}
            {page < totalPages && <Link href={`/admin/audit?page=${page + 1}`} className={buttonClassName({ variant: "outline", size: "sm" })}>Next</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
