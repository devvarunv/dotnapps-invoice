import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";

import { requireBusinessContext } from "@/lib/context";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { toPdfBusinessParty, toPdfCustomerParty } from "@/lib/billing/present";
import { paidAmount } from "@/lib/billing/invoice-status";
import { PAYMENT_METHOD_LABELS } from "@/lib/billing/payments";
import { ReceiptPdf } from "@/lib/pdf/receipt-document";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await requireBusinessContext();

  const payment = await prisma.payment.findFirst({
    where: { id, businessId: ctx.business.id },
    include: {
      customer: true,
      allocations: {
        include: {
          invoice: {
            include: {
              business: true,
              allocations: { include: { payment: { select: { status: true } } } },
            },
          },
        },
      },
    },
  });
  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allocation = payment.allocations[0];
  if (!allocation) return NextResponse.json({ error: "No invoice linked to this payment" }, { status: 404 });

  const invoice = allocation.invoice;
  const balanceAfter = invoice.grandTotal.sub(paidAmount(invoice.allocations));

  const buffer = await renderToBuffer(
    <ReceiptPdf
      business={toPdfBusinessParty(invoice.business)}
      customer={toPdfCustomerParty(payment.customer)}
      receiptId={payment.id.slice(-8).toUpperCase()}
      paymentDate={formatDate(payment.paymentDate)}
      method={PAYMENT_METHOD_LABELS[payment.method]}
      referenceId={payment.referenceId}
      invoiceNumber={invoice.number}
      amount={payment.amount.toString()}
      currency={invoice.currency}
      balanceAfter={balanceAfter.toString()}
    />,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="receipt-${payment.id.slice(-8)}.pdf"`,
    },
  });
}
