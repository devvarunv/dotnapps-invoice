import type { Metadata } from "next";
import Link from "next/link";
import { FileText, ReceiptText, UserPlus, Wallet } from "lucide-react";
import { Prisma } from "@prisma/client";

import { requireBusinessContext } from "@/lib/context";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import {
  paidAmount,
  computeEffectiveInvoiceStatus,
  EFFECTIVE_STATUS_LABELS,
  type EffectiveInvoiceStatus,
} from "@/lib/billing/invoice-status";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/primitives";
import { buttonClassName } from "@/components/ui/button";

export const metadata: Metadata = { title: "Dashboard" };

const QUICK_ACTIONS = [
  { label: "Create Invoice", href: "/invoices/new", icon: ReceiptText },
  { label: "Create Quotation", href: "/quotations/new", icon: FileText },
  { label: "Add Customer", href: "/customers/new", icon: UserPlus },
  { label: "Add Expense", href: "/expenses/new", icon: Wallet },
] as const;

const INVOICE_METRIC_ORDER: EffectiveInvoiceStatus[] = [
  "DRAFT",
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
];

export default async function DashboardPage() {
  const ctx = await requireBusinessContext();

  const [quotationCounts, revenueAgg, expenseAgg, invoices, recentQuotations, recentInvoices] = await Promise.all([
    prisma.quotation.groupBy({
      by: ["status"],
      where: { businessId: ctx.business.id },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: { businessId: ctx.business.id, status: "ACTIVE" },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { businessId: ctx.business.id },
      _sum: { amount: true, taxAmount: true },
    }),
    prisma.invoice.findMany({
      where: { businessId: ctx.business.id, status: { not: "CANCELLED" } },
      include: { allocations: { include: { payment: { select: { status: true } } } } },
    }),
    prisma.quotation.findMany({
      where: { businessId: ctx.business.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { customer: { select: { name: true } } },
    }),
    prisma.invoice.findMany({
      where: { businessId: ctx.business.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { customer: { select: { name: true } } },
    }),
  ]);

  const qCount = (status: string) => quotationCounts.find((c) => c.status === status)?._count ?? 0;

  const revenue = revenueAgg._sum.amount ?? new Prisma.Decimal(0);
  let outstanding = new Prisma.Decimal(0);
  let overdue = new Prisma.Decimal(0);
  const invoiceStatusCounts: Record<EffectiveInvoiceStatus, number> = {
    DRAFT: 0, SENT: 0, VIEWED: 0, PARTIALLY_PAID: 0, PAID: 0, OVERDUE: 0, CANCELLED: 0,
  };
  for (const inv of invoices) {
    const paid = paidAmount(inv.allocations);
    const effective = computeEffectiveInvoiceStatus({
      status: inv.status,
      grandTotal: inv.grandTotal,
      dueDate: inv.dueDate,
      paid,
    });
    invoiceStatusCounts[effective] += 1;
    if (effective === "SENT" || effective === "VIEWED" || effective === "PARTIALLY_PAID" || effective === "OVERDUE") {
      const balance = inv.grandTotal.sub(paid);
      outstanding = outstanding.add(balance);
      if (effective === "OVERDUE") overdue = overdue.add(balance);
    }
  }

  const expenses = (expenseAgg._sum.amount ?? new Prisma.Decimal(0)).add(expenseAgg._sum.taxAmount ?? new Prisma.Decimal(0));
  const netIncome = revenue.sub(expenses);

  const currency = ctx.business.currency;
  const MONEY_KPIS = [
    { label: "Revenue", value: `${currency} ${revenue.toString()}` },
    { label: "Outstanding", value: `${currency} ${outstanding.toString()}` },
    { label: "Overdue", value: `${currency} ${overdue.toString()}` },
    { label: "Expenses", value: `${currency} ${expenses.toString()}` },
    { label: "Net income", value: `${currency} ${netIncome.toString()}` },
  ];

  return (
    <div>
      <PageHeader
        title={`Welcome, ${ctx.user.name.split(" ")[0]}`}
        description={`${ctx.business.name} · billing dashboard.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {MONEY_KPIS.map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{k.label}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-2xl font-semibold tracking-tight">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quotations</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-4 gap-2 text-center">
            {(["SENT", "VIEWED", "ACCEPTED", "REJECTED"] as const).map((s) => (
              <div key={s}>
                <p className="text-lg font-semibold">{qCount(s)}</p>
                <p className="text-xs text-muted-foreground">{s.toLowerCase()}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-5 gap-2 text-center">
            {INVOICE_METRIC_ORDER.map((s) => (
              <div key={s}>
                <p className="text-lg font-semibold">{invoiceStatusCounts[s]}</p>
                <p className="text-xs text-muted-foreground">{EFFECTIVE_STATUS_LABELS[s].toLowerCase()}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Quick actions
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className={buttonClassName({ variant: "outline", className: "justify-start" })}
          >
            <a.icon className="size-4" />
            {a.label}
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent quotations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentQuotations.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">Nothing yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {recentQuotations.map((q) => (
                  <li key={q.id}>
                    <Link href={`/quotations/${q.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-muted/50">
                      <span>{q.number} · {q.customer.name}</span>
                      <Badge tone={q.status === "ACCEPTED" ? "success" : q.status === "REJECTED" ? "danger" : "neutral"}>{q.status}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent invoices</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentInvoices.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">Nothing yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {recentInvoices.map((inv) => (
                  <li key={inv.id}>
                    <Link href={`/invoices/${inv.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-muted/50">
                      <span>{inv.number} · {inv.customer.name}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(inv.invoiceDate)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
