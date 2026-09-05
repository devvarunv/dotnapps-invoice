import Link from "next/link";
import type { Metadata } from "next";
import { CreditCard, Download } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS } from "@/lib/billing/payments";
import { DeniedState } from "@/components/app/denied";
import { PageHeader } from "@/components/app/page-header";
import { Card, Badge } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage() {
  const check = await checkPermission("payments:view");
  if (!check.ok) return <DeniedState />;
  const { ctx } = check;

  const payments = await prisma.payment.findMany({
    where: { businessId: ctx.business.id },
    orderBy: { paymentDate: "desc" },
    include: {
      customer: { select: { name: true, companyName: true } },
      allocations: { include: { invoice: { select: { id: true, number: true, currency: true } } } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Full and partial payments received, with methods, references and receipts."
      />

      {payments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-muted">
            <CreditCard className="size-5 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm font-medium">No payments recorded yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Record a payment from an invoice&apos;s page once it&apos;s sent to a customer.
          </p>
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-border">
            {payments.map((p) => {
              const invoice = p.allocations[0]?.invoice;
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {p.customer.name}
                      {invoice ? (
                        <>
                          {" · "}
                          <Link href={`/invoices/${invoice.id}`} className="text-primary hover:underline">
                            {invoice.number}
                          </Link>
                        </>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDate(p.paymentDate)} · {PAYMENT_METHOD_LABELS[p.method]}
                      {p.referenceId ? ` · ${p.referenceId}` : ""}
                    </p>
                  </div>
                  <span className="text-sm tabular-nums">
                    {invoice?.currency ?? ""} {p.amount.toString()}
                  </span>
                  <Badge tone={p.status === "REVERSED" ? "danger" : "success"}>
                    {p.status === "REVERSED" ? "Reversed" : "Active"}
                  </Badge>
                  <a
                    href={`/payments/${p.id}/receipt`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Download receipt"
                  >
                    <Download className="size-4" />
                  </a>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
