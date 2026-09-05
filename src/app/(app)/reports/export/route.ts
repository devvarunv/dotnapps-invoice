import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { paidAmount } from "@/lib/billing/invoice-status";
import { computeReceivablesAging, AGING_BUCKET_ORDER, AGING_BUCKET_LABELS } from "@/lib/reports/aging";
import { computeSalesByCustomer, computePaymentsByMethod, computeTotalsByLabel, computeGstSummary } from "@/lib/reports/metrics";

function csvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
function toCsv(header: string[], rows: string[][]): string {
  return [header, ...rows].map((row) => row.map(csvField).join(",")).join("\n");
}
function csvResponse(csv: string, filename: string): NextResponse {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/** CSV export per report section (spec §16 "Date filters and CSV/XLSX export"). */
export async function GET(req: Request) {
  const ctx = await requirePermission("export:data");
  const url = new URL(req.url);
  const section = url.searchParams.get("section") ?? "";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const fromDate = from ? new Date(from) : new Date(0);
  const toDate = to ? new Date(`${to}T23:59:59.999`) : new Date();

  if (section === "receivables-aging") {
    const invoices = await prisma.invoice.findMany({
      where: { businessId: ctx.business.id, status: { notIn: ["DRAFT", "CANCELLED"] } },
      select: { dueDate: true, grandTotal: true, allocations: { include: { payment: { select: { status: true } } } } },
    });
    const aging = computeReceivablesAging(
      invoices.map((inv) => ({ dueDate: inv.dueDate, balance: inv.grandTotal.sub(paidAmount(inv.allocations)) })),
    );
    const rows = AGING_BUCKET_ORDER.map((b) => [AGING_BUCKET_LABELS[b], String(aging[b].count), aging[b].amount.toString()]);
    return csvResponse(toCsv(["Bucket", "Count", `Amount (${ctx.business.currency})`], rows), "receivables-aging.csv");
  }

  if (section === "gst-summary") {
    const invoices = await prisma.invoice.findMany({
      where: { businessId: ctx.business.id, status: { not: "CANCELLED" }, invoiceDate: { gte: fromDate, lte: toDate } },
      select: { taxableValue: true, cgstTotal: true, sgstTotal: true, igstTotal: true },
    });
    const summary = computeGstSummary(invoices);
    const rows = [
      ["Taxable value", summary.taxableValue.toString()],
      ["CGST", summary.cgst.toString()],
      ["SGST", summary.sgst.toString()],
      ["IGST", summary.igst.toString()],
      ["Total tax", summary.totalTax.toString()],
    ];
    return csvResponse(toCsv(["Line", `Amount (${ctx.business.currency})`], rows), "gst-summary.csv");
  }

  if (section === "payments-by-method") {
    const payments = await prisma.payment.findMany({
      where: { businessId: ctx.business.id, status: "ACTIVE", paymentDate: { gte: fromDate, lte: toDate } },
      select: { method: true, amount: true },
    });
    const rows = computePaymentsByMethod(payments).map((r) => [r.method, String(r.count), r.total.toString()]);
    return csvResponse(toCsv(["Method", "Count", `Total (${ctx.business.currency})`], rows), "payments-by-method.csv");
  }

  if (section === "expenses-by-category") {
    const expenses = await prisma.expense.findMany({
      where: { businessId: ctx.business.id, expenseDate: { gte: fromDate, lte: toDate } },
      select: { amount: true, taxAmount: true, category: { select: { name: true } } },
    });
    const rows = computeTotalsByLabel(
      expenses.map((e) => ({ label: e.category?.name ?? "Uncategorized", total: e.amount.add(e.taxAmount) })),
    ).map((r) => [r.label, r.total.toString()]);
    return csvResponse(toCsv(["Category", `Total (${ctx.business.currency})`], rows), "expenses-by-category.csv");
  }

  if (section === "sales-by-customer") {
    const invoices = await prisma.invoice.findMany({
      where: { businessId: ctx.business.id, status: { not: "CANCELLED" }, invoiceDate: { gte: fromDate, lte: toDate } },
      include: { customer: { select: { id: true, name: true } }, allocations: { include: { payment: { select: { status: true } } } } },
    });
    const rows = computeSalesByCustomer(
      invoices.map((inv) => ({
        customerId: inv.customer.id,
        customerName: inv.customer.name,
        grandTotal: inv.grandTotal,
        paid: paidAmount(inv.allocations),
      })),
    ).map((r) => [r.customerName, r.invoiced.toString(), r.collected.toString()]);
    return csvResponse(
      toCsv(["Customer", `Invoiced (${ctx.business.currency})`, `Collected (${ctx.business.currency})`], rows),
      "sales-by-customer.csv",
    );
  }

  return NextResponse.json({ error: "Unknown report section" }, { status: 400 });
}
