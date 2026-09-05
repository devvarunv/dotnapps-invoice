import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Users } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { DeniedState } from "@/components/app/denied";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/primitives";
import { buttonClassName } from "@/components/ui/button";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage() {
  const check = await checkPermission("customers:view");
  if (!check.ok) return <DeniedState />;
  const { ctx } = check;

  const customers = await prisma.customer.findMany({
    where: { businessId: ctx.business.id, isArchived: false },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { quotations: true, invoices: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Profiles, GSTIN, addresses and transaction history."
        actions={
          can(ctx.role, "customers:create") ? (
            <Link href="/customers/new" className={buttonClassName({ size: "sm" })}>
              <Plus className="size-4" /> Add customer
            </Link>
          ) : undefined
        }
      />

      {customers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-muted">
            <Users className="size-5 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm font-medium">No customers yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Add your first customer to start creating quotations and invoices.
          </p>
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-border">
            {customers.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/customers/${c.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[c.companyName, c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {c._count.quotations} quotation{c._count.quotations === 1 ? "" : "s"} ·{" "}
                    {c._count.invoices} invoice{c._count.invoices === 1 ? "" : "s"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
