import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { requireBusinessContext } from "@/lib/context";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/primitives";
import { RetryButton } from "./retry-button";
import { SentMessage } from "./sent-message";

export const metadata: Metadata = { title: "Bulk batch" };

const ITEM_TONE = { SENT: "success", FAILED: "danger", SKIPPED: "warning" } as const;

export default async function BulkBatchDetailPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const ctx = await requireBusinessContext();

  const batch = await prisma.bulkSendBatch.findFirst({
    where: { id: batchId, businessId: ctx.business.id },
    include: {
      createdBy: { select: { name: true } },
      items: {
        include: { invoice: { select: { number: true, customer: { select: { name: true } } } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!batch) notFound();

  const retryable = batch.items.filter((i) => i.status !== "SENT").length;

  return (
    <div>
      <Link href="/invoices/bulk" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Bulk activity
      </Link>
      <PageHeader
        title={batch.name}
        description={`${batch.createdBy.name} · ${formatDate(batch.createdAt)} · ${batch.channel}`}
        actions={retryable > 0 ? <RetryButton batchId={batch.id} count={retryable} /> : undefined}
      />

      <div className="mb-6 grid grid-cols-3 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-5 text-center">
            <p className="text-2xl font-semibold">{batch.totalCount}</p>
            <p className="text-xs text-muted-foreground">total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-400">{batch.sentCount}</p>
            <p className="text-xs text-muted-foreground">sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <p className="text-2xl font-semibold text-amber-700 dark:text-amber-400">{batch.skippedCount}</p>
            <p className="text-xs text-muted-foreground">skipped</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <p className="text-2xl font-semibold text-destructive">{batch.failedCount}</p>
            <p className="text-xs text-muted-foreground">failed</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {batch.items.map((item) => (
              <li key={item.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{item.invoice.number} · {item.invoice.customer.name}</p>
                    {item.failureReason && <p className="text-xs text-muted-foreground">{item.failureReason}</p>}
                  </div>
                  <Badge tone={ITEM_TONE[item.status]}>{item.status.toLowerCase()}</Badge>
                </div>
                {item.status === "SENT" && item.message && <SentMessage text={item.message} />}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
