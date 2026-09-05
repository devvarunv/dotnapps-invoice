import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileText, ReceiptText } from "lucide-react";
import { Prisma } from "@prisma/client";

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
import { PAYMENT_METHOD_LABELS } from "@/lib/billing/payments";
import { PageHeader } from "@/components/app/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
} from "@/components/ui/primitives";
import { buttonClassName } from "@/components/ui/button";
import { CustomerForm } from "../customer-form";
import { ArchiveButton } from "./archive-button";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireBusinessContext();

  const customer = await prisma.customer.findFirst({
    where: { id, businessId: ctx.business.id },
  });
  if (!customer) notFound();

  const [quotations, invoices, payments] = await Promise.all([
    prisma.quotation.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.invoice.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { allocations: { include: { payment: { select: { status: true } } } } },
    }),
    prisma.payment.findMany({
      where: { customerId: id },
      orderBy: { paymentDate: "desc" },
      take: 10,
    }),
  ]);

  const canEdit = can(ctx.role, "customers:edit");
  const canDelete = can(ctx.role, "customers:delete");
  const canQuote = can(ctx.role, "quotations:create");
  const canInvoice = can(ctx.role, "invoices:create");
  const canViewPayments = can(ctx.role, "payments:view");

  let outstanding = new Prisma.Decimal(0);
  const invoicesWithStatus = invoices.map((inv) => {
    const paid = paidAmount(inv.allocations);
    const effective = computeEffectiveInvoiceStatus({
      status: inv.status,
      grandTotal: inv.grandTotal,
      dueDate: inv.dueDate,
      paid,
    });
    if (effective !== "PAID" && effective !== "CANCELLED" && effective !== "DRAFT") {
      outstanding = outstanding.add(inv.grandTotal.sub(paid));
    }
    return { ...inv, effective };
  });

  return (
    <div>
      <Link
        href="/customers"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Customers
      </Link>
      <PageHeader
        title={customer.name}
        description={customer.companyName ?? undefined}
        actions={
          <>
            {customer.isArchived && <Badge tone="warning">Archived</Badge>}
            {canQuote && (
              <Link href={`/quotations/new?customerId=${customer.id}`} className={buttonClassName({ variant: "outline", size: "sm" })}>
                <FileText className="size-4" /> New quotation
              </Link>
            )}
            {canInvoice && (
              <Link href={`/invoices/new?customerId=${customer.id}`} className={buttonClassName({ size: "sm" })}>
                <ReceiptText className="size-4" /> New invoice
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quotations</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {quotations.length === 0 ? (
                <p className="p-5 text-sm text-muted-foreground">No quotations yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {quotations.map((q) => (
                    <li key={q.id}>
                      <Link href={`/quotations/${q.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/50">
                        <div>
                          <p className="text-sm font-medium">{q.number}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(q.quotationDate)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm tabular-nums">{q.currency} {q.grandTotal.toString()}</span>
                          <Badge tone={q.status === "ACCEPTED" ? "success" : q.status === "REJECTED" ? "danger" : "neutral"}>
                            {q.status}
                          </Badge>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {invoicesWithStatus.length === 0 ? (
                <p className="p-5 text-sm text-muted-foreground">No invoices yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {invoicesWithStatus.map((inv) => (
                    <li key={inv.id}>
                      <Link href={`/invoices/${inv.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/50">
                        <div>
                          <p className="text-sm font-medium">{inv.number}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(inv.invoiceDate)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm tabular-nums">{inv.currency} {inv.grandTotal.toString()}</span>
                          <Badge tone={EFFECTIVE_STATUS_TONE[inv.effective]}>{EFFECTIVE_STATUS_LABELS[inv.effective]}</Badge>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {canViewPayments && (
            <Card>
              <CardHeader>
                <CardTitle>Payments</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {payments.length === 0 ? (
                  <p className="p-5 text-sm text-muted-foreground">No payments yet.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {payments.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                        <div>
                          <p className="text-sm font-medium">
                            {p.amount.toString()}
                            {p.status === "REVERSED" && <Badge tone="danger" className="ml-2">Reversed</Badge>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(p.paymentDate)} · {PAYMENT_METHOD_LABELS[p.method]}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Edit customer</CardTitle>
            </CardHeader>
            <CardContent>
              {canEdit ? (
                <CustomerForm customer={customer} />
              ) : (
                <p className="text-sm text-muted-foreground">You don&apos;t have permission to edit customers.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {canViewPayments && (
            <Card>
              <CardHeader>
                <CardTitle>Outstanding balance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={outstanding.greaterThan(0) ? "text-2xl font-semibold text-amber-700 dark:text-amber-400" : "text-2xl font-semibold"}>
                  {invoices[0]?.currency ?? "INR"} {outstanding.toString()}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Across sent, viewed and overdue invoices.</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Email</dt>
                  <dd>{customer.email || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Phone</dt>
                  <dd>{customer.phone || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">GSTIN</dt>
                  <dd>{customer.gstin || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Billing address</dt>
                  <dd>
                    {[
                      customer.billingAddressLine1,
                      customer.billingAddressLine2,
                      customer.billingCity,
                      customer.billingState,
                      customer.billingPostalCode,
                    ]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {canDelete && <ArchiveButton customerId={customer.id} isArchived={customer.isArchived} />}
        </div>
      </div>
    </div>
  );
}
