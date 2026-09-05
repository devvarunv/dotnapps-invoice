import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";

import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { toPdfItems, toPdfBusinessParty, toPdfCustomerParty } from "@/lib/billing/present";
import { BillingDocumentPdf } from "@/lib/pdf/billing-document";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const quotation = await prisma.quotation.findUnique({
    where: { publicToken: token },
    include: { business: true, customer: true, items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = await renderToBuffer(
    <BillingDocumentPdf
      kind="Quotation"
      number={quotation.number}
      status={quotation.status}
      primaryDate={{ label: "Quotation date", value: formatDate(quotation.quotationDate) }}
      secondaryDate={quotation.validUntil ? { label: "Valid until", value: formatDate(quotation.validUntil) } : undefined}
      business={toPdfBusinessParty(quotation.business)}
      customer={toPdfCustomerParty(quotation.customer)}
      items={toPdfItems(quotation.items)}
      currency={quotation.currency}
      subtotal={quotation.subtotal.toString()}
      discountTotal={quotation.discountTotal.toString()}
      taxableValue={quotation.taxableValue.toString()}
      cgstTotal={quotation.cgstTotal.toString()}
      sgstTotal={quotation.sgstTotal.toString()}
      igstTotal={quotation.igstTotal.toString()}
      grandTotal={quotation.grandTotal.toString()}
      notes={quotation.notes}
      termsAndConditions={quotation.termsAndConditions}
      payment={quotation.business}
    />,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quotation.number}.pdf"`,
    },
  });
}
