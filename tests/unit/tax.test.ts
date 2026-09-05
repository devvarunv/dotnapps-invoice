import { describe, expect, it } from "vitest";
import {
  computeLineItem,
  computeDocumentTotals,
  determineSupplyType,
} from "@/lib/billing/tax";

describe("computeLineItem", () => {
  it("computes gross, discount, taxable amount and tax for a simple line", () => {
    const line = computeLineItem({
      quantity: 2,
      rate: 500,
      discountPercent: 10,
      taxRatePercent: 18,
    });
    expect(line.grossAmount.toString()).toBe("1000");
    expect(line.discountAmount.toString()).toBe("100");
    expect(line.amount.toString()).toBe("900");
    expect(line.taxAmount.toString()).toBe("162");
    expect(line.lineTotal.toString()).toBe("1062");
  });

  it("rounds to the cent and handles zero discount/tax", () => {
    const line = computeLineItem({
      quantity: 3,
      rate: 33.33,
      discountPercent: 0,
      taxRatePercent: 0,
    });
    expect(line.amount.toString()).toBe("99.99");
    expect(line.taxAmount.toString()).toBe("0");
    expect(line.lineTotal.toString()).toBe("99.99");
  });
});

describe("determineSupplyType", () => {
  it("is intra-state when business and customer share a state", () => {
    expect(determineSupplyType("Karnataka", "Karnataka")).toBe("INTRA_STATE");
    expect(determineSupplyType("karnataka", "KARNATAKA")).toBe("INTRA_STATE");
  });

  it("is inter-state when states differ", () => {
    expect(determineSupplyType("Karnataka", "Maharashtra")).toBe("INTER_STATE");
  });

  it("defaults to intra-state when either state is unknown", () => {
    expect(determineSupplyType(null, "Maharashtra")).toBe("INTRA_STATE");
    expect(determineSupplyType("Karnataka", undefined)).toBe("INTRA_STATE");
  });
});

describe("computeDocumentTotals", () => {
  const items = [
    computeLineItem({ quantity: 1, rate: 1000, discountPercent: 0, taxRatePercent: 18 }),
    computeLineItem({ quantity: 2, rate: 250, discountPercent: 0, taxRatePercent: 18 }),
  ];

  it("splits tax into CGST+SGST for intra-state supply", () => {
    const totals = computeDocumentTotals(items, "INTRA_STATE");
    expect(totals.taxableValue.toString()).toBe("1500");
    expect(totals.taxTotal.toString()).toBe("270");
    expect(totals.cgstTotal.toString()).toBe("135");
    expect(totals.sgstTotal.toString()).toBe("135");
    expect(totals.igstTotal.toString()).toBe("0");
    expect(totals.grandTotal.toString()).toBe("1770");
  });

  it("puts the full tax into IGST for inter-state supply", () => {
    const totals = computeDocumentTotals(items, "INTER_STATE");
    expect(totals.igstTotal.toString()).toBe("270");
    expect(totals.cgstTotal.toString()).toBe("0");
    expect(totals.sgstTotal.toString()).toBe("0");
    expect(totals.grandTotal.toString()).toBe("1770");
  });

  it("keeps cgst + sgst exactly equal to the tax total on an odd cent", () => {
    // 33.33 taxable * 18% = 5.9994 -> rounds to 6.00 tax for the single line.
    const oddItem = computeLineItem({
      quantity: 1,
      rate: 33.33,
      discountPercent: 0,
      taxRatePercent: 5, // 33.33 * 0.05 = 1.6665 -> rounds to 1.67 (odd cent)
    });
    const totals = computeDocumentTotals([oddItem], "INTRA_STATE");
    expect(totals.cgstTotal.add(totals.sgstTotal).toString()).toBe(totals.taxTotal.toString());
  });

  it("returns zero totals for an empty document", () => {
    const totals = computeDocumentTotals([], "INTRA_STATE");
    expect(totals.grandTotal.toString()).toBe("0");
  });
});
