import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download, ExternalLink } from "lucide-react";

import { requireBusinessContext } from "@/lib/context";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/primitives";
import { buttonClassName } from "@/components/ui/button";
import { QuotationForm } from "../quotation-form";
import { SendButton } from "./send-button";
import { ConvertButton } from "./convert-button";

export const metadata: Metadata = { title: "Quotation" };

const STATUS_TONE = {
  DRAFT: "neutral",
  SENT: "brand",
  VIEWED: "brand",
  ACCEPTED: "success",
  REJECTED: "danger",
  EXPIRED: "warning",
} as const;

export default async function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireBusinessContext();

  const quotation = await prisma.quotation.findFirst({
    where: { id, businessId: ctx.business.id },
    include: {
      customer: true,
      items: { orderBy: { sortOrder: "asc" } },
      convertedInvoice: { select: { id: true, number: true } },
    },
  });
  if (!quotation) notFound();

  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/q/${quotation.publicToken}`;
  const isDraft = quotation.status === "DRAFT";
  const canEdit = can(ctx.role, "quotations:edit") && isDraft;
  const canSend = can(ctx.role, "quotations:send") && isDraft;
  const canConvert =
    can(ctx.role, "invoices:create") && quotation.status === "ACCEPTED" && !quotation.convertedInvoice;

  if (canEdit) {
    const [customers, products] = await Promise.all([
      prisma.customer.findMany({
        where: { businessId: ctx.business.id, isArchived: false },
        orderBy: { name: "asc" },
        select: { id: true, name: true, companyName: true },
      }),
      prisma.productService.findMany({
        where: { businessId: ctx.business.id, isActive: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return (
      <div>
        <QuotationForm
          title={quotation.number}
          backHref="/quotations"
          backLabel="Quotations"
          headerBadge={
            <div className="mt-1 flex items-center gap-2">
              <Badge tone={STATUS_TONE[quotation.status]}>{quotation.status}</Badge>
              <span className="text-sm text-muted-foreground">Draft — editable until sent.</span>
            </div>
          }
          customers={customers}
          products={products.map((p) => ({
            id: p.id,
            name: p.name,
            unit: p.unit,
            defaultPrice: p.defaultPrice.toString(),
            taxRatePercent: p.taxRatePercent.toString(),
          }))}
          currency={quotation.currency}
          businessName={ctx.business.name}
          quotation={{
            id: quotation.id,
            customerId: quotation.customerId,
            quotationDate: quotation.quotationDate.toISOString().slice(0, 10),
            validUntil: quotation.validUntil ? quotation.validUntil.toISOString().slice(0, 10) : null,
            notes: quotation.notes,
            termsAndConditions: quotation.termsAndConditions,
            items: quotation.items.map((it) => ({
              key: it.id,
              productServiceId: it.productServiceId ?? "",
              description: it.description,
              quantity: it.quantity.toString(),
              unit: it.unit,
              rate: it.rate.toString(),
              discountPercent: it.discountPercent.toString(),
              taxRatePercent: it.taxRatePercent.toString(),
            })),
          }}
        />
        {canSend && (
          <div className="mt-6">
            <SendButton quotationId={quotation.id} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <Link href="/quotations" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Quotations
      </Link>
      <PageHeader
        title={quotation.number}
        description={`${quotation.customer.name}${quotation.customer.companyName ? ` · ${quotation.customer.companyName}` : ""}`}
        actions={
          <>
            <Badge tone={STATUS_TONE[quotation.status]}>{quotation.status}</Badge>
            <a href={`/quotations/${quotation.id}/pdf`} className={buttonClassName({ variant: "outline", size: "sm" })} target="_blank" rel="noreferrer">
              <Download className="size-4" /> PDF
            </a>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Line items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-5 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium">Qty</th>
                  <th className="px-3 py-2 font-medium">Rate</th>
                  <th className="px-5 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {quotation.items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-2">{item.description}</td>
                    <td className="px-3 py-2">{item.quantity.toString()} {item.unit}</td>
                    <td className="px-3 py-2">{quotation.currency} {item.rate.toString()}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{quotation.currency} {item.amount.toString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end p-5">
              <dl className="w-56 space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Taxable value</dt><dd>{quotation.currency} {quotation.taxableValue.toString()}</dd></div>
                {Number(quotation.cgstTotal) > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">CGST</dt><dd>{quotation.currency} {quotation.cgstTotal.toString()}</dd></div>}
                {Number(quotation.sgstTotal) > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">SGST</dt><dd>{quotation.currency} {quotation.sgstTotal.toString()}</dd></div>}
                {Number(quotation.igstTotal) > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">IGST</dt><dd>{quotation.currency} {quotation.igstTotal.toString()}</dd></div>}
                <div className="flex justify-between border-t border-border pt-1 font-semibold"><dt>Grand total</dt><dd>{quotation.currency} {quotation.grandTotal.toString()}</dd></div>
              </dl>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div><dt className="text-xs text-muted-foreground">Quotation date</dt><dd>{formatDate(quotation.quotationDate)}</dd></div>
                {quotation.validUntil && <div><dt className="text-xs text-muted-foreground">Valid until</dt><dd>{formatDate(quotation.validUntil)}</dd></div>}
                {quotation.sentAt && <div><dt className="text-xs text-muted-foreground">Sent</dt><dd>{formatDate(quotation.sentAt)}</dd></div>}
                {quotation.viewedAt && <div><dt className="text-xs text-muted-foreground">Viewed</dt><dd>{formatDate(quotation.viewedAt)}</dd></div>}
                {quotation.respondedAt && <div><dt className="text-xs text-muted-foreground">Responded</dt><dd>{formatDate(quotation.respondedAt)}</dd></div>}
              </dl>
            </CardContent>
          </Card>

          {!isDraft && (
            <Card>
              <CardHeader>
                <CardTitle>Customer link</CardTitle>
              </CardHeader>
              <CardContent>
                <a href={publicUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <ExternalLink className="size-3.5" /> Open customer view
                </a>
              </CardContent>
            </Card>
          )}

          {canSend && <SendButton quotationId={quotation.id} />}

          {canConvert && <ConvertButton quotationId={quotation.id} />}

          {quotation.convertedInvoice && (
            <Card>
              <CardHeader>
                <CardTitle>Converted</CardTitle>
              </CardHeader>
              <CardContent>
                <Link href={`/invoices/${quotation.convertedInvoice.id}`} className="text-sm text-primary hover:underline">
                  View invoice {quotation.convertedInvoice.number}
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
