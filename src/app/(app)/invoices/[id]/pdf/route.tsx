import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";

import { requireBusinessContext } from "@/lib/context";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { toPdfItems, toPdfBusinessParty, toPdfCustomerParty } from "@/lib/billing/present";
import { BillingDocumentPdf } from "@/lib/pdf/billing-document";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await requireBusinessContext();

  const invoice = await prisma.invoice.findFirst({
    where: { id, businessId: ctx.business.id },
    include: { business: true, customer: true, items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.number}.pdf"`,
    },
  });
}
