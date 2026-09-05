import { Prisma } from "@prisma/client";

/**
 * Centralized, tested GST calculation service (spec §7 "Centralize tax
 * calculation in a tested service.", §15 "Centralized tested calculation
 * service."). Every quotation/invoice total — on screen and in the PDF —
 * must flow through this module so the two can never disagree (spec §10
 * "Web preview and PDF must use the same calculation/data layer.").
 *
 * Uses Prisma.Decimal (decimal.js) throughout instead of floating point:
 * money math with `number` silently loses cents (0.1 + 0.2 !== 0.3), which
 * is exactly the kind of bug spec §33's "PDFs match on-screen totals" and
 * §27's automated GST tests are meant to catch.
 */

export type Decimal = Prisma.Decimal;
const D = Prisma.Decimal;

function round2(value: Prisma.Decimal.Value): Prisma.Decimal {
  return new D(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export type LineItemInput = {
  quantity: Prisma.Decimal.Value;
  rate: Prisma.Decimal.Value;
  discountPercent: Prisma.Decimal.Value;
  taxRatePercent: Prisma.Decimal.Value;
};

export type LineItemComputed = {
  quantity: Decimal;
  rate: Decimal;
  discountPercent: Decimal;
  taxRatePercent: Decimal;
  /** quantity * rate, before discount. */
  grossAmount: Decimal;
  discountAmount: Decimal;
  /** Taxable value for this line (gross − discount), rounded to the cent. */
  amount: Decimal;
  taxAmount: Decimal;
  lineTotal: Decimal;
};

/** Compute one quotation/invoice line item's amounts. Rounds per line
 * (standard invoicing practice) rather than rounding only the document
 * total, so line amounts always sum to the printed totals. */
export function computeLineItem(input: LineItemInput): LineItemComputed {
  const quantity = new D(input.quantity);
  const rate = new D(input.rate);
  const discountPercent = new D(input.discountPercent);
  const taxRatePercent = new D(input.taxRatePercent);

  const grossAmount = round2(quantity.mul(rate));
  const discountAmount = round2(grossAmount.mul(discountPercent).div(100));
  const amount = round2(grossAmount.sub(discountAmount));
  const taxAmount = round2(amount.mul(taxRatePercent).div(100));
  const lineTotal = amount.add(taxAmount);

  return {
    quantity,
    rate,
    discountPercent,
    taxRatePercent,
    grossAmount,
    discountAmount,
    amount,
    taxAmount,
    lineTotal,
  };
}

export type SupplyType = "INTRA_STATE" | "INTER_STATE";

/**
 * GST is CGST+SGST for intra-state supply, IGST for inter-state (spec §15).
 * When either state is unknown we can't safely charge IGST as a customer
 * default, so we fall back to intra-state — callers should encourage
 * filling in both business and customer state during onboarding (spec §4).
 */
export function determineSupplyType(
  businessState: string | null | undefined,
  placeOfSupplyState: string | null | undefined,
): SupplyType {
  if (!businessState || !placeOfSupplyState) return "INTRA_STATE";
  return businessState.trim().toLowerCase() === placeOfSupplyState.trim().toLowerCase()
    ? "INTRA_STATE"
    : "INTER_STATE";
}

export type DocumentTotals = {
  subtotal: Decimal;
  discountTotal: Decimal;
  taxableValue: Decimal;
  cgstTotal: Decimal;
  sgstTotal: Decimal;
  igstTotal: Decimal;
  taxTotal: Decimal;
  grandTotal: Decimal;
};

/** Roll a set of computed line items up into document-level totals. */
export function computeDocumentTotals(
  items: LineItemComputed[],
  supplyType: SupplyType,
): DocumentTotals {
  let subtotal = new D(0);
  let discountTotal = new D(0);
  let taxableValue = new D(0);
  let taxTotal = new D(0);

  for (const item of items) {
    subtotal = subtotal.add(item.grossAmount);
    discountTotal = discountTotal.add(item.discountAmount);
    taxableValue = taxableValue.add(item.amount);
    taxTotal = taxTotal.add(item.taxAmount);
  }

  let cgstTotal = new D(0);
  let sgstTotal = new D(0);
  let igstTotal = new D(0);

  if (supplyType === "INTRA_STATE") {
    cgstTotal = round2(taxTotal.div(2));
    // Any odd cent from the split goes to SGST so cgst+sgst == taxTotal
    // exactly — arbitrary but consistent, so totals always reconcile.
    sgstTotal = round2(taxTotal.sub(cgstTotal));
  } else {
    igstTotal = taxTotal;
  }

  const grandTotal = taxableValue.add(cgstTotal).add(sgstTotal).add(igstTotal);

  return {
    subtotal,
    discountTotal,
    taxableValue,
    cgstTotal,
    sgstTotal,
    igstTotal,
    taxTotal,
    grandTotal,
  };
}
