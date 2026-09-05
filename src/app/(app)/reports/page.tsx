import type { Metadata } from "next";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { Download } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { paidAmount, computeEffectiveInvoiceStatus, EFFECTIVE_STATUS_LABELS, type EffectiveInvoiceStatus } from "@/lib/billing/invoice-status";
import { PAYMENT_METHOD_LABELS } from "@/lib/billing/payments";
import { computeReceivablesAging, AGING_BUCKET_ORDER, AGING_BUCKET_LABELS } from "@/lib/reports/aging";
import {
  computeSalesByCustomer,
  computeSalesByProduct,
  computeQuotationConversion,
  computePaymentsByMethod,
  computeTotalsByLabel,
  computeGstSummary,
  computeProfitAndLoss,
} from "@/lib/reports/metrics";
import { DeniedState } from "@/components/app/denied";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { Input } from "@/components/ui/input";
import { Button, buttonClassName } from "@/components/ui/button";
import { toLocalDateInput, todayDateInputValue } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };

function firstOfMonth(): string {
  const d = new Date();
  return toLocalDateInput(new Date(d.getFullYear(), d.getMonth(), 1));
}

function ExportLink({ section, from, to }: { section: string; from: string; to: string }) {
  return (
    <a
      href={`/reports/export?section=${section}&from=${from}&to=${to}`}
      className={buttonClassName({ variant: "outline", size: "sm" })}
    >
      <Download className="size-4" /> CSV
    </a>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const check = await checkPermission("reports:view");
  if (!check.ok) return <DeniedState />;
  const { ctx } = check;

  const sp = await searchParams;
  const from = sp.from || firstOfMonth();
  const to = sp.to || todayDateInputValue();
  const fromDate = new Date(from);
  const toDate = new Date(`${to}T23:59:59.999`);
  const currency = ctx.business.currency;

  const [invoicesInPeriod, quotationCounts, paymentsInPeriod, expensesInPeriod, receivablesInvoices] = await Promise.all([
    prisma.invoice.findMany({
      where: { businessId: ctx.business.id, invoiceDate: { gte: fromDate, lte: toDate } },
      include: {
        customer: { select: { id: true, name: true } },
        items: { select: { description: true, quantity: true, amount: true } },
        allocations: { include: { payment: { select: { status: true } } } },
      },
    }),
    prisma.quotation.groupBy({
      by: ["status"],
      where: { businessId: ctx.business.id, quotationDate: { gte: fromDate, lte: toDate } },
      _count: true,
    }),
    prisma.payment.findMany({
      where: { businessId: ctx.business.id, status: "ACTIVE", paymentDate: { gte: fromDate, lte: toDate } },
      select: { method: true, amount: true },
    }),
    prisma.expense.findMany({
      where: { businessId: ctx.business.id, expenseDate: { gte: fromDate, lte: toDate } },
      select: { vendorName: true, amount: true, taxAmount: true, category: { select: { name: true } } },
    }),
    prisma.invoice.findMany({
      where: { businessId: ctx.business.id, status: { notIn: ["DRAFT", "CANCELLED"] } },
      select: { dueDate: true, grandTotal: true, allocations: { include: { payment: { select: { status: true } } } } },
    }),
  ]);

  // Invoice status breakdown (effective status) — within the period.
  const statusCounts: Record<EffectiveInvoiceStatus, { count: number; amount: Prisma.Decimal }> = {
    DRAFT: { count: 0, amount: new Prisma.Decimal(0) },
    SENT: { count: 0, amount: new Prisma.Decimal(0) },
    VIEWED: { count: 0, amount: new Prisma.Decimal(0) },
    PARTIALLY_PAID: { count: 0, amount: new Prisma.Decimal(0) },
    PAID: { count: 0, amount: new Prisma.Decimal(0) },
    OVERDUE: { count: 0, amount: new Prisma.Decimal(0) },
    CANCELLED: { count: 0, amount: new Prisma.Decimal(0) },
  };
  const salesByCustomerInput: { customerId: string; customerName: string; grandTotal: Prisma.Decimal; paid: Prisma.Decimal }[] = [];
  const salesByProductInput: { description: string; quantity: Prisma.Decimal; amount: Prisma.Decimal }[] = [];
  const gstInput: { taxableValue: Prisma.Decimal; cgstTotal: Prisma.Decimal; sgstTotal: Prisma.Decimal; igstTotal: Prisma.Decimal }[] = [];
  let totalInvoiced = new Prisma.Decimal(0);

  for (const inv of invoicesInPeriod) {
    const paid = paidAmount(inv.allocations);
    const effective = computeEffectiveInvoiceStatus({ status: inv.status, grandTotal: inv.grandTotal, dueDate: inv.dueDate, paid });
    statusCounts[effective].count += 1;
    statusCounts[effective].amount = statusCounts[effective].amount.add(inv.grandTotal);
    if (inv.status !== "CANCELLED") {
      salesByCustomerInput.push({ customerId: inv.customer.id, customerName: inv.customer.name, grandTotal: inv.grandTotal, paid });
      totalInvoiced = totalInvoiced.add(inv.grandTotal);
      for (const item of inv.items) salesByProductInput.push(item);
      gstInput.push(inv);
    }
  }

  const salesByCustomer = computeSalesByCustomer(salesByCustomerInput).slice(0, 10);
  const salesByProduct = computeSalesByProduct(salesByProductInput).slice(0, 10);
  const quotationConversion = computeQuotationConversion(
    Object.fromEntries(quotationCounts.map((c) => [c.status, c._count])),
  );
  const paymentsByMethod = computePaymentsByMethod(paymentsInPeriod);
  const totalCollected = paymentsByMethod.reduce((sum, r) => sum.add(r.total), new Prisma.Decimal(0));
  const expensesByCategory = computeTotalsByLabel(
    expensesInPeriod.map((e) => ({ label: e.category?.name ?? "Uncategorized", total: e.amount.add(e.taxAmount) })),
  );
  const expensesByVendor = computeTotalsByLabel(
    expensesInPeriod.map((e) => ({ label: e.vendorName, total: e.amount.add(e.taxAmount) })),
  ).slice(0, 10);
  const totalExpenses = expensesByCategory.reduce((sum, r) => sum.add(r.total), new Prisma.Decimal(0));
  const gstSummary = computeGstSummary(gstInput);
  const profitAndLoss = computeProfitAndLoss(totalCollected, totalExpenses);

  const aging = computeReceivablesAging(
    receivablesInvoices.map((inv) => ({ dueDate: inv.dueDate, balance: inv.grandTotal.sub(paidAmount(inv.allocations)) })),
  );

  return (
    <div>
      <PageHeader title="Reports" description="Sales, receivables, GST and profit & loss — computed live, never cached." />

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">From</label>
          <Input type="date" name="from" defaultValue={from} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">To</label>
          <Input type="date" name="to" defaultValue={to} />
        </div>
        <Button type="submit" size="sm">Apply</Button>
        <Link href="/reports" className="text-xs text-muted-foreground hover:text-foreground">This month</Link>
      </form>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Collected (period)</CardTitle></CardHeader>
          <CardContent className="pt-0"><p className="text-2xl font-semibold">{currency} {totalCollected.toString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Expenses (period)</CardTitle></CardHeader>
          <CardContent className="pt-0"><p className="text-2xl font-semibold">{currency} {totalExpenses.toString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Net (P&amp;L)</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <p className={`text-2xl font-semibold ${profitAndLoss.net.isNegative() ? "text-destructive" : ""}`}>
              {currency} {profitAndLoss.net.toString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Invoices by status ({currency} {totalInvoiced.toString()} invoiced)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-3 text-center sm:grid-cols-4">
            {(Object.keys(statusCounts) as EffectiveInvoiceStatus[]).filter((s) => statusCounts[s].count > 0).map((s) => (
              <div key={s}>
                <p className="text-lg font-semibold">{statusCounts[s].count}</p>
                <p className="text-xs text-muted-foreground">{EFFECTIVE_STATUS_LABELS[s]}</p>
              </div>
            ))}
            {invoicesInPeriod.length === 0 && <p className="col-span-full text-sm text-muted-foreground">No invoices in this period.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Quotation conversion</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div><p className="text-lg font-semibold">{quotationConversion.accepted}</p><p className="text-xs text-muted-foreground">accepted</p></div>
              <div><p className="text-lg font-semibold">{quotationConversion.rejected}</p><p className="text-xs text-muted-foreground">rejected</p></div>
              <div><p className="text-lg font-semibold">{quotationConversion.expired}</p><p className="text-xs text-muted-foreground">expired</p></div>
              <div><p className="text-lg font-semibold">{(quotationConversion.conversionRate * 100).toFixed(0)}%</p><p className="text-xs text-muted-foreground">conversion</p></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Payments by method (period)</CardTitle>
            <ExportLink section="payments-by-method" from={from} to={to} />
          </CardHeader>
          <CardContent className="p-0">
            {paymentsByMethod.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No payments in this period.</p> : (
              <ul className="divide-y divide-border">
                {paymentsByMethod.map((r) => (
                  <li key={r.method} className="flex justify-between px-5 py-2.5 text-sm">
                    <span>{PAYMENT_METHOD_LABELS[r.method as keyof typeof PAYMENT_METHOD_LABELS] ?? r.method} ({r.count})</span>
                    <span className="tabular-nums">{currency} {r.total.toString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Receivables aging (as of today)</CardTitle>
            <ExportLink section="receivables-aging" from={from} to={to} />
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {AGING_BUCKET_ORDER.map((b) => (
                <li key={b} className="flex justify-between px-5 py-2.5 text-sm">
                  <span>{AGING_BUCKET_LABELS[b]} ({aging[b].count})</span>
                  <span className="tabular-nums">{currency} {aging[b].amount.toString()}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Sales by customer (top 10)</CardTitle>
            <ExportLink section="sales-by-customer" from={from} to={to} />
          </CardHeader>
          <CardContent className="p-0">
            {salesByCustomer.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No sales in this period.</p> : (
              <ul className="divide-y divide-border">
                {salesByCustomer.map((r) => (
                  <li key={r.customerId} className="flex justify-between px-5 py-2.5 text-sm">
                    <span>{r.customerName}</span>
                    <span className="tabular-nums">{currency} {r.invoiced.toString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Sales by product (top 10)</CardTitle></CardHeader>
          <CardContent className="p-0">
            {salesByProduct.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No sales in this period.</p> : (
              <ul className="divide-y divide-border">
                {salesByProduct.map((r) => (
                  <li key={r.name} className="flex justify-between px-5 py-2.5 text-sm">
                    <span>{r.name} × {r.quantity.toString()}</span>
                    <span className="tabular-nums">{currency} {r.revenue.toString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Expenses by category (period)</CardTitle>
            <ExportLink section="expenses-by-category" from={from} to={to} />
          </CardHeader>
          <CardContent className="p-0">
            {expensesByCategory.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No expenses in this period.</p> : (
              <ul className="divide-y divide-border">
                {expensesByCategory.map((r) => (
                  <li key={r.label} className="flex justify-between px-5 py-2.5 text-sm">
                    <span>{r.label}</span>
                    <span className="tabular-nums">{currency} {r.total.toString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Expenses by vendor (top 10)</CardTitle></CardHeader>
          <CardContent className="p-0">
            {expensesByVendor.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No expenses in this period.</p> : (
              <ul className="divide-y divide-border">
                {expensesByVendor.map((r) => (
                  <li key={r.label} className="flex justify-between px-5 py-2.5 text-sm">
                    <span>{r.label}</span>
                    <span className="tabular-nums">{currency} {r.total.toString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>GST summary (period)</CardTitle>
            <ExportLink section="gst-summary" from={from} to={to} />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
              <div><p className="text-lg font-semibold">{currency} {gstSummary.taxableValue.toString()}</p><p className="text-xs text-muted-foreground">taxable value</p></div>
              <div><p className="text-lg font-semibold">{currency} {gstSummary.cgst.toString()}</p><p className="text-xs text-muted-foreground">CGST</p></div>
              <div><p className="text-lg font-semibold">{currency} {gstSummary.sgst.toString()}</p><p className="text-xs text-muted-foreground">SGST</p></div>
              <div><p className="text-lg font-semibold">{currency} {gstSummary.igst.toString()}</p><p className="text-xs text-muted-foreground">IGST</p></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
