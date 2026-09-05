import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";

import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { toPdfItems, toPdfBusinessParty, toPdfCustomerParty } from "@/lib/billing/present";
import {
  paidAmount,
  computeEffectiveInvoiceStatus,
  EFFECTIVE_STATUS_LABELS,
  EFFECTIVE_STATUS_TONE,
} from "@/lib/billing/invoice-status";
import { Logo } from "@/components/brand";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { buttonClassName } from "@/components/ui/button";

export const metadata: Metadata = { title: "Invoice" };

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { publicToken: token },
    include: {
      business: true,
      customer: true,
      items: { orderBy: { sortOrder: "asc" } },
      allocations: { include: { payment: { select: { status: true } } } },
    },
  });
  if (!invoice) notFound();

  if (invoice.status === "SENT") {
    await prisma.invoice.updateMany({
      where: { id: invoice.id, status: "SENT" },
      data: { status: "VIEWED", viewedAt: new Date() },
    });
    invoice.status = "VIEWED";
  }

  const paid = paidAmount(invoice.allocations);
  const balance = invoice.grandTotal.sub(paid);
  const effective = computeEffectiveInvoiceStatus({
    status: invoice.status,
    grandTotal: invoice.grandTotal,
    dueDate: invoice.dueDate,
    paid,
  });

  const business = toPdfBusinessParty(invoice.business);
  const customer = toPdfCustomerParty(invoice.customer);
  const items = toPdfItems(invoice.items);

  return (
    <div className="min-h-dvh bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <Logo href={null} />
          <a href={`/i/${token}/pdf`} className={buttonClassName({ variant: "outline", size: "sm" })}>
            <Download className="size-4" /> Download PDF
          </a>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">Invoice {invoice.number}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">from {business.name}</p>
              </div>
              <Badge tone={EFFECTIVE_STATUS_TONE[effective]}>{EFFECTIVE_STATUS_LABELS[effective]}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Bill to</p>
                <p className="font-medium">{customer.name}</p>
                {customer.addressLines.map((l, i) => <p key={i} className="text-muted-foreground">{l}</p>)}
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Invoice date</p>
                <p className="font-medium">{formatDate(invoice.invoiceDate)}</p>
                {invoice.dueDate && (
                  <>
                    <p className="mt-2 text-xs uppercase text-muted-foreground">Due date</p>
                    <p className="font-medium">{formatDate(invoice.dueDate)}</p>
                  </>
                )}
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="px-3 py-2 font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">{item.description}</td>
                      <td className="px-3 py-2">{item.quantity} {item.unit}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{invoice.currency} {item.lineTotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <dl className="w-56 space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Taxable value</dt><dd>{invoice.currency} {invoice.taxableValue.toString()}</dd></div>
                {Number(invoice.cgstTotal) > 0 && (
                  <div className="flex justify-between"><dt className="text-muted-foreground">CGST</dt><dd>{invoice.currency} {invoice.cgstTotal.toString()}</dd></div>
                )}
                {Number(invoice.sgstTotal) > 0 && (
                  <div className="flex justify-between"><dt className="text-muted-foreground">SGST</dt><dd>{invoice.currency} {invoice.sgstTotal.toString()}</dd></div>
                )}
                {Number(invoice.igstTotal) > 0 && (
                  <div className="flex justify-between"><dt className="text-muted-foreground">IGST</dt><dd>{invoice.currency} {invoice.igstTotal.toString()}</dd></div>
                )}
                <div className="flex justify-between border-t border-border pt-1 font-semibold"><dt>Grand total</dt><dd>{invoice.currency} {invoice.grandTotal.toString()}</dd></div>
                {paid.greaterThan(0) && (
                  <>
                    <div className="flex justify-between text-emerald-700 dark:text-emerald-400"><dt>Paid</dt><dd>{invoice.currency} {paid.toString()}</dd></div>
                    <div className="flex justify-between font-semibold"><dt>Balance due</dt><dd>{invoice.currency} {balance.toString()}</dd></div>
                  </>
                )}
              </dl>
            </div>

            {invoice.notes && (
              <div>
                <p className="text-xs uppercase text-muted-foreground">Notes</p>
                <p className="text-sm">{invoice.notes}</p>
              </div>
            )}

            {balance.greaterThan(0) && (
              <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                Online payment isn&apos;t set up for this business yet. Please use the bank/UPI details provided separately.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
