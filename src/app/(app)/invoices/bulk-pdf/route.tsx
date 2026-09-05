import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import JSZip from "jszip";

import { requirePermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { toPdfItems, toPdfBusinessParty, toPdfCustomerParty } from "@/lib/billing/present";
import { BillingDocumentPdf } from "@/lib/pdf/billing-document";

/** Bulk "Download PDFs" (spec §11) — zips one PDF per selected invoice. */
export async function POST(req: Request) {
  const ctx = await requirePermission("invoices:view");

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
    include: { business: true, customer: true, items: { orderBy: { sortOrder: "asc" } } },
  });
  if (invoices.length === 0) {
    return NextResponse.json({ error: "None of the selected invoices could be found" }, { status: 404 });
  }

  const zip = new JSZip();
  for (const invoice of invoices) {
    const buffer = await renderToBuffer(
      <BillingDocumentPdf
        kind="Tax Invoice"
        number={invoice.number}
        status={invoice.status}
        primaryDate={{ label: "Invoice date", value: formatDate(invoice.invoiceDate) }}
        secondaryDate={invoice.dueDate ? { label: "Due date", value: formatDate(invoice.dueDate) } : undefined}
        business={toPdfBusinessParty(invoice.business)}
        customer={toPdfCustomerParty(invoice.customer)}
        items={toPdfItems(invoice.items)}
        currency={invoice.currency}
        subtotal={invoice.subtotal.toString()}
        discountTotal={invoice.discountTotal.toString()}
        taxableValue={invoice.taxableValue.toString()}
        cgstTotal={invoice.cgstTotal.toString()}
        sgstTotal={invoice.sgstTotal.toString()}
        igstTotal={invoice.igstTotal.toString()}
        grandTotal={invoice.grandTotal.toString()}
        notes={invoice.notes}
        termsAndConditions={invoice.termsAndConditions}
        payment={invoice.business}
      />,
    );
    zip.file(`${invoice.number}.pdf`, buffer);
  }

  const archive = await zip.generateAsync({ type: "nodebuffer" });

  return new NextResponse(new Uint8Array(archive), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="invoices-${Date.now()}.zip"`,
    },
  });
}
