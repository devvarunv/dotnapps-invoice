import { NextResponse } from "next/server";

import { requireBusinessContext } from "@/lib/context";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await requireBusinessContext();

  const expense = await prisma.expense.findFirst({
    where: { id, businessId: ctx.business.id },
    select: { receiptData: true, receiptMimeType: true, receiptFileName: true },
  });
  if (!expense?.receiptData) {
    return NextResponse.json({ error: "No receipt on file" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(expense.receiptData), {
    headers: {
      "Content-Type": expense.receiptMimeType ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${expense.receiptFileName ?? "receipt"}"`,
    },
  });
}
