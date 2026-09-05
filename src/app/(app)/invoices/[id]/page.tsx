import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download, ExternalLink } from "lucide-react";

import { requireBusinessContext } from "@/lib/context";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import {
  paidAmount,
  computeEffectiveInvoiceStatus,
  EFFECTIVE_STATUS_LABELS,
  EFFECTIVE_STATUS_TONE,
} from "@/lib/billing/invoice-status";
import { REMINDER_RULE_ORDER, isReminderDue } from "@/lib/billing/reminders";
import { ensureDefaultReminderRules } from "@/lib/billing/reminder-rules";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/primitives";
import { buttonClassName } from "@/components/ui/button";
import { InvoiceForm } from "../invoice-form";
import { SendButton } from "./send-button";
import { CancelButton } from "./cancel-button";
import { RecordPaymentForm } from "./record-payment-form";
import { PaymentsList } from "./payments-list";
import { RemindersCard } from "./reminders-card";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireBusinessContext();

  const invoice = await prisma.invoice.findFirst({
    where: { id, businessId: ctx.business.id },
    include: {
      customer: true,
      items: { orderBy: { sortOrder: "asc" } },
      quotation: { select: { id: true, number: true } },
      allocations: {
        include: {
          payment: {
            select: { id: true, amount: true, paymentDate: true, method: true, referenceId: true, status: true },
          },
        },
      },
      reminderEvents: { include: { sentBy: { select: { name: true } } } },
    },
  });
  if (!invoice) notFound();

  const paid = paidAmount(invoice.allocations);
  const balance = invoice.grandTotal.sub(paid);
  const effective = computeEffectiveInvoiceStatus({
    status: invoice.status,
    grandTotal: invoice.grandTotal,
    dueDate: invoice.dueDate,
    paid,
  });

  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/i/${invoice.publicToken}`;
  const isDraft = invoice.status === "DRAFT";
  const canEdit = can(ctx.role, "invoices:edit") && isDraft;
  const canSend = can(ctx.role, "invoices:send") && isDraft;
  const canCancel = can(ctx.role, "invoices:cancel") && invoice.status !== "CANCELLED";
  const canRecordPayment =
    can(ctx.role, "payments:record") &&
    !isDraft &&
    invoice.status !== "CANCELLED" &&
    balance.greaterThan(0);
  const canReverse = can(ctx.role, "payments:record");
  const canManageReminders = can(ctx.role, "reminders:manage");

  const activeRemindersEligible =
    invoice.dueDate !== null && ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"].includes(effective);
  const sentKinds = new Set(invoice.reminderEvents.map((e) => e.kind));
  if (activeRemindersEligible) await ensureDefaultReminderRules(ctx.business.id);
  const businessRules = activeRemindersEligible
    ? await prisma.reminderRule.findMany({ where: { businessId: ctx.business.id, enabled: true } })
    : [];
  const enabledKinds = new Set(businessRules.map((r) => r.kind));
  const dueRules =
    activeRemindersEligible && invoice.dueDate
      ? REMINDER_RULE_ORDER.filter(
          (kind) => enabledKinds.has(kind) && !sentKinds.has(kind) && isReminderDue(kind, invoice.dueDate!),
        )
      : [];

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
        <Link href="/invoices" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" /> Invoices
        </Link>
        <PageHeader
          title={invoice.number}
          description="Draft — editable until sent."
          actions={<Badge tone={EFFECTIVE_STATUS_TONE[effective]}>{EFFECTIVE_STATUS_LABELS[effective]}</Badge>}
        />
        <Card className="mb-6">
          <CardContent className="pt-5">
            <InvoiceForm
              customers={customers}
              products={products.map((p) => ({
                id: p.id,
                name: p.name,
                unit: p.unit,
                defaultPrice: p.defaultPrice.toString(),
                taxRatePercent: p.taxRatePercent.toString(),
              }))}
              currency={invoice.currency}
              invoice={{
                id: invoice.id,
                customerId: invoice.customerId,
                invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
                dueDate: invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : null,
                paymentTerms: invoice.paymentTerms,
                notes: invoice.notes,
                termsAndConditions: invoice.termsAndConditions,
                items: invoice.items.map((it) => ({
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
          </CardContent>
        </Card>
        {canSend && <SendButton invoiceId={invoice.id} />}
      </div>
    );
  }

  return (
    <div>
      <Link href="/invoices" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Invoices
      </Link>
      <PageHeader
        title={invoice.number}
        description={`${invoice.customer.name}${invoice.customer.companyName ? ` · ${invoice.customer.companyName}` : ""}`}
        actions={
          <>
            <Badge tone={EFFECTIVE_STATUS_TONE[effective]}>{EFFECTIVE_STATUS_LABELS[effective]}</Badge>
            <a href={`/invoices/${invoice.id}/pdf`} className={buttonClassName({ variant: "outline", size: "sm" })} target="_blank" rel="noreferrer">
              <Download className="size-4" /> PDF
            </a>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
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
                  {invoice.items.map((item) => (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-2">{item.description}</td>
                      <td className="px-3 py-2">{item.quantity.toString()} {item.unit}</td>
                      <td className="px-3 py-2">{invoice.currency} {item.rate.toString()}</td>
                      <td className="px-5 py-2 text-right tabular-nums">{invoice.currency} {item.amount.toString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end p-5">
                <dl className="w-56 space-y-1 text-sm">
                  <div className="flex justify-between"><dt className="text-muted-foreground">Taxable value</dt><dd>{invoice.currency} {invoice.taxableValue.toString()}</dd></div>
                  {Number(invoice.cgstTotal) > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">CGST</dt><dd>{invoice.currency} {invoice.cgstTotal.toString()}</dd></div>}
                  {Number(invoice.sgstTotal) > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">SGST</dt><dd>{invoice.currency} {invoice.sgstTotal.toString()}</dd></div>}
                  {Number(invoice.igstTotal) > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">IGST</dt><dd>{invoice.currency} {invoice.igstTotal.toString()}</dd></div>}
                  <div className="flex justify-between border-t border-border pt-1 font-semibold"><dt>Grand total</dt><dd>{invoice.currency} {invoice.grandTotal.toString()}</dd></div>
                  {paid.greaterThan(0) && (
                    <>
                      <div className="flex justify-between text-emerald-700 dark:text-emerald-400"><dt>Paid</dt><dd>{invoice.currency} {paid.toString()}</dd></div>
                      <div className="flex justify-between font-semibold"><dt>Balance due</dt><dd>{invoice.currency} {balance.toString()}</dd></div>
                    </>
                  )}
                </dl>
              </div>
            </CardContent>
          </Card>

          <PaymentsList
            payments={invoice.allocations.map((a) => ({
              id: a.payment.id,
              amount: a.payment.amount.toString(),
              paymentDate: a.payment.paymentDate.toISOString(),
              method: a.payment.method,
              referenceId: a.payment.referenceId,
              status: a.payment.status,
            }))}
            currency={invoice.currency}
            canReverse={canReverse}
          />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div><dt className="text-xs text-muted-foreground">Invoice date</dt><dd>{formatDate(invoice.invoiceDate)}</dd></div>
                {invoice.dueDate && <div><dt className="text-xs text-muted-foreground">Due date</dt><dd>{formatDate(invoice.dueDate)}</dd></div>}
                {invoice.paymentTerms && <div><dt className="text-xs text-muted-foreground">Payment terms</dt><dd>{invoice.paymentTerms}</dd></div>}
                {invoice.sentAt && <div><dt className="text-xs text-muted-foreground">Sent</dt><dd>{formatDate(invoice.sentAt)}</dd></div>}
                {invoice.viewedAt && <div><dt className="text-xs text-muted-foreground">Viewed</dt><dd>{formatDate(invoice.viewedAt)}</dd></div>}
                {invoice.quotation && (
                  <div>
                    <dt className="text-xs text-muted-foreground">From quotation</dt>
                    <dd><Link href={`/quotations/${invoice.quotation.id}`} className="text-primary hover:underline">{invoice.quotation.number}</Link></dd>
                  </div>
                )}
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

          {canSend && <SendButton invoiceId={invoice.id} />}
          {canRecordPayment && (
            <RecordPaymentForm invoiceId={invoice.id} balance={balance.toString()} currency={invoice.currency} />
          )}
          <RemindersCard
            invoiceId={invoice.id}
            dueRules={dueRules}
            sent={invoice.reminderEvents.map((e) => ({
              kind: e.kind,
              sentAt: e.sentAt.toISOString(),
              sentByName: e.sentBy?.name ?? null,
            }))}
            canSend={canManageReminders}
          />
          {canCancel && <CancelButton invoiceId={invoice.id} />}
        </div>
      </div>
    </div>
  );
}
