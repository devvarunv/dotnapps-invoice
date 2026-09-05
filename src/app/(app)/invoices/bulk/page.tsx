import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, History } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { DeniedState } from "@/components/app/denied";
import { PageHeader } from "@/components/app/page-header";
import { Card, Badge } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Bulk Activity" };

export default async function BulkActivityPage() {
  const check = await checkPermission("bulk:send");
  if (!check.ok) return <DeniedState />;
  const { ctx } = check;

  const batches = await prisma.bulkSendBatch.findMany({
    where: { businessId: ctx.business.id },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true } } },
    take: 50,
  });

  return (
    <div>
      <Link href="/invoices" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Invoices
      </Link>
      <PageHeader title="Bulk Activity" description="History of bulk invoice/reminder sends." />

      {batches.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-muted">
            <History className="size-5 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm font-medium">No bulk sends yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Select multiple invoices on the Invoices page to send or remind in bulk.
          </p>
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-border">
            {batches.map((b) => (
              <li key={b.id}>
                <Link href={`/invoices/bulk/${b.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.createdBy.name} · {formatDate(b.createdAt)} · {b.channel}
                    </p>
                  </div>
                  <Badge tone="success">{b.sentCount} sent</Badge>
                  {b.skippedCount > 0 && <Badge tone="warning">{b.skippedCount} skipped</Badge>}
                  {b.failedCount > 0 && <Badge tone="danger">{b.failedCount} failed</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
