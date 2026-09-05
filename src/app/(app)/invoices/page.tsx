import Link from "next/link";
import type { Metadata } from "next";
import { Prisma } from "@prisma/client";
import { Plus, History } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { paidAmount, computeEffectiveInvoiceStatus, type EffectiveInvoiceStatus } from "@/lib/billing/invoice-status";
import { DeniedState } from "@/components/app/denied";
import { PageHeader } from "@/components/app/page-header";
import { buttonClassName } from "@/components/ui/button";
import { InvoiceFiltersForm, type InvoiceFilters } from "./filters";
import { BulkInvoiceTable, type InvoiceListRow } from "./bulk-invoice-table";

export const metadata: Metadata = { title: "Invoices" };

const PAGE_SIZE = 20;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<InvoiceFilters & { page?: string }>;
}) {
  const check = await checkPermission("invoices:view");
  if (!check.ok) return <DeniedState />;
  const { ctx } = check;

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.InvoiceWhereInput = { businessId: ctx.business.id };
  if (sp.customerId) where.customerId = sp.customerId;
  if (sp.q) where.number = { contains: sp.q, mode: "insensitive" };
  if (sp.from || sp.to) {
    where.invoiceDate = {
      ...(sp.from ? { gte: new Date(sp.from) } : {}),
      ...(sp.to ? { lte: new Date(sp.to) } : {}),
    };
  }
  if (sp.dueFrom || sp.dueTo) {
    where.dueDate = {
      ...(sp.dueFrom ? { gte: new Date(sp.dueFrom) } : {}),
      ...(sp.dueTo ? { lte: new Date(sp.dueTo) } : {}),
    };
  }
  if (sp.minAmount || sp.maxAmount) {
    where.grandTotal = {
      ...(sp.minAmount ? { gte: new Prisma.Decimal(sp.minAmount) } : {}),
      ...(sp.maxAmount ? { lte: new Prisma.Decimal(sp.maxAmount) } : {}),
    };
  }

  const [invoices, customers] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true, companyName: true, email: true, phone: true } },
        allocations: { include: { payment: { select: { status: true } } } },
      },
    }),
    prisma.customer.findMany({
      where: { businessId: ctx.business.id, isArchived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // Effective status is derived (payments + due date), not a SQL column,
  // so the status filter is applied here rather than in `where`.
  let filtered = invoices.map((inv) => {
    const paid = paidAmount(inv.allocations);
    const effectiveStatus: EffectiveInvoiceStatus = computeEffectiveInvoiceStatus({
      status: inv.status,
      grandTotal: inv.grandTotal,
      dueDate: inv.dueDate,
      paid,
    });
    const row: InvoiceListRow = {
      id: inv.id,
      number: inv.number,
      customerName: inv.customer.name,
      customerCompany: inv.customer.companyName,
      customerEmail: inv.customer.email,
      customerPhone: inv.customer.phone,
      date: formatDate(inv.invoiceDate),
      currency: inv.currency,
      grandTotal: inv.grandTotal.toString(),
      balance: inv.grandTotal.sub(paid).toString(),
      effectiveStatus,
    };
    return row;
  });

  if (sp.status) {
    filtered = filtered.filter((r) => r.effectiveStatus === sp.status);
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v && k !== "page") params.set(k, v);
  const pageHref = (p: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(p));
    return `/invoices?${next.toString()}`;
  };

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Create, send and track invoices. Select rows for bulk actions."
        actions={
          <>
            <Link href="/invoices/bulk" className={buttonClassName({ variant: "outline", size: "sm" })}>
              <History className="size-4" /> Bulk activity
            </Link>
            {can(ctx.role, "invoices:create") ? (
              <Link href="/invoices/new" className={buttonClassName({ size: "sm" })}>
                <Plus className="size-4" /> New invoice
              </Link>
            ) : undefined}
          </>
        }
      />

      <InvoiceFiltersForm filters={sp} customers={customers} />

      <BulkInvoiceTable
        rows={pageRows}
        canBulkSend={can(ctx.role, "bulk:send")}
        canMarkPaid={can(ctx.role, "payments:record")}
        canExport={can(ctx.role, "export:data")}
      />

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page} of {totalPages} · {total} invoice{total === 1 ? "" : "s"}</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={pageHref(page - 1)} className={buttonClassName({ variant: "outline", size: "sm" })}>Previous</Link>}
            {page < totalPages && <Link href={pageHref(page + 1)} className={buttonClassName({ variant: "outline", size: "sm" })}>Next</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
