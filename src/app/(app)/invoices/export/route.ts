import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { paidAmount, computeEffectiveInvoiceStatus, EFFECTIVE_STATUS_LABELS } from "@/lib/billing/invoice-status";

function csvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** CSV export of selected invoices (spec §11 bulk action "Export"). */
export async function POST(req: Request) {
  const ctx = await requirePermission("export:data");

  const formData = await req.formData();
  let ids: string[] = [];
  try {
    ids = JSON.parse(String(formData.get("invoiceIds") ?? "[]"));
  } catch {
    return NextResponse.json({ error: "Invalid selection" }, { status: 400 });
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "Select at least one invoice" }, { status: 400 });
  }

  const invoices = await prisma.invoice.findMany({
    where: { id: { in: ids }, businessId: ctx.business.id },
    include: {
      customer: { select: { name: true, companyName: true, email: true } },
      allocations: { include: { payment: { select: { status: true } } } },
    },
    orderBy: { invoiceDate: "desc" },
  });

  const header = [
    "Invoice Number",
    "Customer",
    "Email",
    "Invoice Date",
    "Due Date",
    "Status",
    "Currency",
    "Grand Total",
    "Paid",
    "Balance",
  ];

  const rows = invoices.map((inv) => {
    const paid = paidAmount(inv.allocations);
    const effective = computeEffectiveInvoiceStatus({
      status: inv.status,
      grandTotal: inv.grandTotal,
      dueDate: inv.dueDate,
      paid,
    });
    return [
      inv.number,
      inv.customer.companyName ? `${inv.customer.name} (${inv.customer.companyName})` : inv.customer.name,
      inv.customer.email ?? "",
      formatDate(inv.invoiceDate),
      inv.dueDate ? formatDate(inv.dueDate) : "",
      EFFECTIVE_STATUS_LABELS[effective],
      inv.currency,
      inv.grandTotal.toString(),
      paid.toString(),
      inv.grandTotal.sub(paid).toString(),
    ];
  });

  const csv = [header, ...rows].map((row) => row.map(csvField).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="invoices-export-${Date.now()}.csv"`,
    },
  });
}
