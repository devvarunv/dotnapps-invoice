import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { computeEffectiveInvoiceStatus, paidAmount } from "@/lib/billing/invoice-status";

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000);

describe("computeEffectiveInvoiceStatus", () => {
  it("returns DRAFT and CANCELLED as-is regardless of payments", () => {
    expect(
      computeEffectiveInvoiceStatus({ status: "DRAFT", grandTotal: D(100), dueDate: daysFromNow(-5), paid: D(100) }),
    ).toBe("DRAFT");
    expect(
      computeEffectiveInvoiceStatus({ status: "CANCELLED", grandTotal: D(100), dueDate: daysFromNow(-5), paid: D(0) }),
    ).toBe("CANCELLED");
  });

  it("is PAID once the balance is zero, even if not yet due", () => {
    expect(
      computeEffectiveInvoiceStatus({ status: "SENT", grandTotal: D(100), dueDate: daysFromNow(10), paid: D(100) }),
    ).toBe("PAID");
  });

  it("is OVERDUE once due date passes with a balance remaining", () => {
    expect(
      computeEffectiveInvoiceStatus({ status: "SENT", grandTotal: D(100), dueDate: daysFromNow(-1), paid: D(0) }),
    ).toBe("OVERDUE");
    // Overdue takes priority over "partially paid" once past due.
    expect(
      computeEffectiveInvoiceStatus({ status: "VIEWED", grandTotal: D(100), dueDate: daysFromNow(-1), paid: D(40) }),
    ).toBe("OVERDUE");
  });

  it("is PARTIALLY_PAID when some has been paid but it isn't overdue yet", () => {
    expect(
      computeEffectiveInvoiceStatus({ status: "VIEWED", grandTotal: D(100), dueDate: daysFromNow(5), paid: D(40) }),
    ).toBe("PARTIALLY_PAID");
  });

  it("falls back to the lifecycle status (SENT/VIEWED) when nothing paid and not overdue", () => {
    expect(
      computeEffectiveInvoiceStatus({ status: "SENT", grandTotal: D(100), dueDate: daysFromNow(5), paid: D(0) }),
    ).toBe("SENT");
    expect(
      computeEffectiveInvoiceStatus({ status: "VIEWED", grandTotal: D(100), dueDate: null, paid: D(0) }),
    ).toBe("VIEWED");
  });
});

describe("paidAmount", () => {
  it("sums only ACTIVE payment allocations, ignoring reversed ones", () => {
    const total = paidAmount([
      { amount: D(40), payment: { status: "ACTIVE" } },
      { amount: D(60), payment: { status: "ACTIVE" } },
      { amount: D(25), payment: { status: "REVERSED" } },
    ]);
    expect(total.toString()).toBe("100");
  });

  it("returns zero for no allocations", () => {
    expect(paidAmount([]).toString()).toBe("0");
  });
});
