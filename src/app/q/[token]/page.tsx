import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";

import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { toPdfItems, toPdfBusinessParty, toPdfCustomerParty } from "@/lib/billing/present";
import { Logo } from "@/components/brand";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { buttonClassName } from "@/components/ui/button";
import { ResponseButtons } from "./response-buttons";

export const metadata: Metadata = { title: "Quotation" };

export default async function PublicQuotationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const quotation = await prisma.quotation.findUnique({
    where: { publicToken: token },
    include: {
      business: true,
      customer: true,
      items: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!quotation) notFound();

  if (quotation.status === "SENT") {
    await prisma.quotation.updateMany({
      where: { id: quotation.id, status: "SENT" },
      data: { status: "VIEWED", viewedAt: new Date() },
    });
    quotation.status = "VIEWED";
  }

  const expired = Boolean(quotation.validUntil && quotation.validUntil < new Date());
  const canRespond = quotation.status === "VIEWED" && !expired;

  const business = toPdfBusinessParty(quotation.business);
  const customer = toPdfCustomerParty(quotation.customer);
  const items = toPdfItems(quotation.items);

  return (
    <div className="min-h-dvh bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <Logo href={null} />
          <a
            href={`/q/${token}/pdf`}
            className={buttonClassName({ variant: "outline", size: "sm" })}
          >
            <Download className="size-4" /> Download PDF
          </a>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">Quotation {quotation.number}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">from {business.name}</p>
              </div>
              <Badge tone={expired ? "warning" : quotation.status === "ACCEPTED" ? "success" : quotation.status === "REJECTED" ? "danger" : "neutral"}>
                {expired ? "EXPIRED" : quotation.status}
              </Badge>
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
                <p className="text-xs uppercase text-muted-foreground">Quotation date</p>
                <p className="font-medium">{formatDate(quotation.quotationDate)}</p>
                {quotation.validUntil && (
                  <>
                    <p className="mt-2 text-xs uppercase text-muted-foreground">Valid until</p>
                    <p className="font-medium">{formatDate(quotation.validUntil)}</p>
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
                      <td className="px-3 py-2 text-right tabular-nums">{quotation.currency} {item.lineTotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <dl className="w-56 space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Taxable value</dt><dd>{quotation.currency} {quotation.taxableValue.toString()}</dd></div>
                {Number(quotation.cgstTotal) > 0 && (
                  <div className="flex justify-between"><dt className="text-muted-foreground">CGST</dt><dd>{quotation.currency} {quotation.cgstTotal.toString()}</dd></div>
                )}
                {Number(quotation.sgstTotal) > 0 && (
                  <div className="flex justify-between"><dt className="text-muted-foreground">SGST</dt><dd>{quotation.currency} {quotation.sgstTotal.toString()}</dd></div>
                )}
                {Number(quotation.igstTotal) > 0 && (
                  <div className="flex justify-between"><dt className="text-muted-foreground">IGST</dt><dd>{quotation.currency} {quotation.igstTotal.toString()}</dd></div>
                )}
                <div className="flex justify-between border-t border-border pt-1 font-semibold"><dt>Grand total</dt><dd>{quotation.currency} {quotation.grandTotal.toString()}</dd></div>
              </dl>
            </div>

            {quotation.notes && (
              <div>
                <p className="text-xs uppercase text-muted-foreground">Notes</p>
                <p className="text-sm">{quotation.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {canRespond && (
          <Card className="mt-4">
            <CardContent className="pt-5">
              <ResponseButtons token={token} />
            </CardContent>
          </Card>
        )}

        {!canRespond && quotation.status === "ACCEPTED" && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Accepted on {quotation.respondedAt ? formatDate(quotation.respondedAt) : "—"}.
          </p>
        )}
        {!canRespond && quotation.status === "REJECTED" && (
          <p className="mt-4 text-center text-sm text-muted-foreground">This quotation was declined.</p>
        )}
        {expired && quotation.status !== "ACCEPTED" && quotation.status !== "REJECTED" && (
          <p className="mt-4 text-center text-sm text-muted-foreground">This quotation has expired.</p>
        )}
      </div>
    </div>
  );
}
