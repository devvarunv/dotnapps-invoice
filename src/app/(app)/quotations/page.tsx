import Link from "next/link";
import type { Metadata } from "next";
import { FileText, Plus } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { DeniedState } from "@/components/app/denied";
import { PageHeader } from "@/components/app/page-header";
import { Card, Badge } from "@/components/ui/primitives";
import { buttonClassName } from "@/components/ui/button";

export const metadata: Metadata = { title: "Quotations" };

const STATUS_TONE = {
  DRAFT: "neutral",
  SENT: "brand",
  VIEWED: "brand",
  ACCEPTED: "success",
  REJECTED: "danger",
  EXPIRED: "warning",
} as const;

export default async function QuotationsPage() {
  const check = await checkPermission("quotations:view");
  if (!check.ok) return <DeniedState />;
  const { ctx } = check;

  const quotations = await prisma.quotation.findMany({
    where: { businessId: ctx.business.id },
    orderBy: { createdAt: "desc" },
    include: { customer: { select: { name: true, companyName: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Quotations"
        description="Create, send and track quotations through accept/reject and conversion to invoice."
        actions={
          can(ctx.role, "quotations:create") ? (
            <Link href="/quotations/new" className={buttonClassName({ size: "sm" })}>
              <Plus className="size-4" /> New quotation
            </Link>
          ) : undefined
        }
      />

      {quotations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-muted">
            <FileText className="size-5 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm font-medium">No quotations yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Create your first quotation to start winning work.
          </p>
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-border">
            {quotations.map((q) => (
              <li key={q.id}>
                <Link href={`/quotations/${q.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{q.number}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {q.customer.name}{q.customer.companyName ? ` · ${q.customer.companyName}` : ""} · {formatDate(q.quotationDate)}
                    </p>
                  </div>
                  <span className="text-sm tabular-nums">{q.currency} {q.grandTotal.toString()}</span>
                  <Badge tone={STATUS_TONE[q.status]}>{q.status}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
