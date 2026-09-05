import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { agingBucketFor, computeReceivablesAging } from "@/lib/reports/aging";
import {
  computeSalesByCustomer,
  computeSalesByProduct,
  computeQuotationConversion,
  computePaymentsByMethod,
  computeTotalsByLabel,
  computeGstSummary,
  computeProfitAndLoss,
} from "@/lib/reports/metrics";

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

describe("agingBucketFor", () => {
  it("buckets a future or missing due date as current", () => {
    expect(agingBucketFor(null)).toBe("current");
    expect(agingBucketFor(new Date(Date.now() + 86_400_000))).toBe("current");
  });

  it("buckets by days overdue", () => {
    expect(agingBucketFor(daysAgo(10))).toBe("d1_30");
    expect(agingBucketFor(daysAgo(45))).toBe("d31_60");
    expect(agingBucketFor(daysAgo(75))).toBe("d61_90");
    expect(agingBucketFor(daysAgo(120))).toBe("d90plus");
  });
});

describe("computeReceivablesAging", () => {
  it("skips invoices with no outstanding balance and sums the rest by bucket", () => {
    const result = computeReceivablesAging([
      { dueDate: daysAgo(10), balance: D(100) },
      { dueDate: daysAgo(10), balance: D(50) },
      { dueDate: daysAgo(200), balance: D(0) }, // fully paid — skipped
      { dueDate: null, balance: D(200) },
    ]);
    expect(result.d1_30.count).toBe(2);
    expect(result.d1_30.amount.toString()).toBe("150");
    expect(result.current.amount.toString()).toBe("200");
    expect(result.d90plus.count).toBe(0);
  });
});

describe("computeSalesByCustomer", () => {
  it("aggregates invoiced and collected per customer", () => {
    const rows = computeSalesByCustomer([
      { customerId: "c1", customerName: "Acme", grandTotal: D(1000), paid: D(400) },
      { customerId: "c1", customerName: "Acme", grandTotal: D(500), paid: D(500) },
      { customerId: "c2", customerName: "Beta", grandTotal: D(2000), paid: D(0) },
    ]);
    expect(rows[0].customerId).toBe("c2"); // sorted by invoiced desc
    expect(rows[1].invoiced.toString()).toBe("1500");
    expect(rows[1].collected.toString()).toBe("900");
  });
});

describe("computeSalesByProduct", () => {
  it("aggregates quantity and revenue by description, sorted by revenue", () => {
    const rows = computeSalesByProduct([
      { description: "Widget", quantity: D(2), amount: D(200) },
      { description: "Widget", quantity: D(1), amount: D(100) },
      { description: "Gadget", quantity: D(5), amount: D(500) },
    ]);
    expect(rows[0].name).toBe("Gadget");
    expect(rows[1].quantity.toString()).toBe("3");
    expect(rows[1].revenue.toString()).toBe("300");
  });
});

describe("computeQuotationConversion", () => {
  it("computes conversion rate over everything actually sent, excluding drafts", () => {
    const result = computeQuotationConversion({ DRAFT: 5, SENT: 1, VIEWED: 1, ACCEPTED: 2, REJECTED: 1 });
    // responded = 1+1+2+1+0 = 5, accepted = 2 -> 0.4
    expect(result.conversionRate).toBeCloseTo(0.4);
  });

  it("returns zero conversion when nothing has been sent", () => {
    expect(computeQuotationConversion({}).conversionRate).toBe(0);
  });
});

describe("computePaymentsByMethod", () => {
  it("groups and totals by method", () => {
    const rows = computePaymentsByMethod([
      { method: "CASH", amount: D(100) },
      { method: "UPI", amount: D(500) },
      { method: "CASH", amount: D(50) },
    ]);
    expect(rows[0].method).toBe("UPI");
    expect(rows[1].count).toBe(2);
    expect(rows[1].total.toString()).toBe("150");
  });
});

describe("computeTotalsByLabel", () => {
  it("groups arbitrary labeled totals (used for expense category/vendor)", () => {
    const rows = computeTotalsByLabel([
      { label: "Travel", total: D(300) },
      { label: "Travel", total: D(200) },
      { label: "Rent", total: D(1000) },
    ]);
    expect(rows[0].label).toBe("Rent");
    expect(rows[1].total.toString()).toBe("500");
  });
});

describe("computeGstSummary", () => {
  it("sums taxable value and each tax column across invoices", () => {
    const summary = computeGstSummary([
      { taxableValue: D(1000), cgstTotal: D(90), sgstTotal: D(90), igstTotal: D(0) },
      { taxableValue: D(500), cgstTotal: D(0), sgstTotal: D(0), igstTotal: D(90) },
    ]);
    expect(summary.taxableValue.toString()).toBe("1500");
    expect(summary.totalTax.toString()).toBe("270");
  });
});

describe("computeProfitAndLoss", () => {
  it("net is revenue minus expenses, can go negative", () => {
    expect(computeProfitAndLoss(D(1000), D(1500)).net.toString()).toBe("-500");
  });
});
