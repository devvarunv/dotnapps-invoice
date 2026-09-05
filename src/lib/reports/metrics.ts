import { Prisma } from "@prisma/client";

/**
 * Reports compute everything at read time from Invoice/Payment/Quotation/
 * Expense rows — nothing is denormalized here, so a report can never go
 * stale (spec §16). Each function below takes plain data the caller
 * already fetched, so they're pure and unit-testable without a database.
 */

const D0 = () => new Prisma.Decimal(0);

export type SalesByCustomerRow = {
  customerId: string;
  customerName: string;
  invoiced: Prisma.Decimal;
  collected: Prisma.Decimal;
};

export function computeSalesByCustomer(
  invoices: { customerId: string; customerName: string; grandTotal: Prisma.Decimal; paid: Prisma.Decimal }[],
): SalesByCustomerRow[] {
  const map = new Map<string, SalesByCustomerRow>();
  for (const inv of invoices) {
    const row = map.get(inv.customerId) ?? {
      customerId: inv.customerId,
      customerName: inv.customerName,
      invoiced: D0(),
      collected: D0(),
    };
    row.invoiced = row.invoiced.add(inv.grandTotal);
    row.collected = row.collected.add(inv.paid);
    map.set(inv.customerId, row);
  }
  return [...map.values()].sort((a, b) => b.invoiced.comparedTo(a.invoiced));
}

export type SalesByProductRow = { name: string; quantity: Prisma.Decimal; revenue: Prisma.Decimal };

export function computeSalesByProduct(
  items: { description: string; quantity: Prisma.Decimal; amount: Prisma.Decimal }[],
): SalesByProductRow[] {
  const map = new Map<string, SalesByProductRow>();
  for (const item of items) {
    const row = map.get(item.description) ?? { name: item.description, quantity: D0(), revenue: D0() };
    row.quantity = row.quantity.add(item.quantity);
    row.revenue = row.revenue.add(item.amount);
    map.set(item.description, row);
  }
  return [...map.values()].sort((a, b) => b.revenue.comparedTo(a.revenue));
}

export type QuotationConversion = {
  sent: number;
  viewed: number;
  accepted: number;
  rejected: number;
  expired: number;
  /** accepted / (everything that was actually sent, i.e. excluding drafts) */
  conversionRate: number;
};

export function computeQuotationConversion(counts: Partial<Record<string, number>>): QuotationConversion {
  const sent = counts.SENT ?? 0;
  const viewed = counts.VIEWED ?? 0;
  const accepted = counts.ACCEPTED ?? 0;
  const rejected = counts.REJECTED ?? 0;
  const expired = counts.EXPIRED ?? 0;
  const responded = sent + viewed + accepted + rejected + expired;
  return { sent, viewed, accepted, rejected, expired, conversionRate: responded > 0 ? accepted / responded : 0 };
}

export type PaymentsByMethodRow = { method: string; count: number; total: Prisma.Decimal };

export function computePaymentsByMethod(
  payments: { method: string; amount: Prisma.Decimal }[],
): PaymentsByMethodRow[] {
  const map = new Map<string, PaymentsByMethodRow>();
  for (const p of payments) {
    const row = map.get(p.method) ?? { method: p.method, count: 0, total: D0() };
    row.count += 1;
    row.total = row.total.add(p.amount);
    map.set(p.method, row);
  }
  return [...map.values()].sort((a, b) => b.total.comparedTo(a.total));
}

export type CategoryTotalRow = { label: string; total: Prisma.Decimal };

export function computeTotalsByLabel(
  rows: { label: string; total: Prisma.Decimal }[],
): CategoryTotalRow[] {
  const map = new Map<string, Prisma.Decimal>();
  for (const r of rows) {
    map.set(r.label, (map.get(r.label) ?? D0()).add(r.total));
  }
  return [...map.entries()]
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total.comparedTo(a.total));
}

export type GstSummary = {
  taxableValue: Prisma.Decimal;
  cgst: Prisma.Decimal;
  sgst: Prisma.Decimal;
  igst: Prisma.Decimal;
  totalTax: Prisma.Decimal;
};

export function computeGstSummary(
  invoices: { taxableValue: Prisma.Decimal; cgstTotal: Prisma.Decimal; sgstTotal: Prisma.Decimal; igstTotal: Prisma.Decimal }[],
): GstSummary {
  let taxableValue = D0();
  let cgst = D0();
  let sgst = D0();
  let igst = D0();
  for (const inv of invoices) {
    taxableValue = taxableValue.add(inv.taxableValue);
    cgst = cgst.add(inv.cgstTotal);
    sgst = sgst.add(inv.sgstTotal);
    igst = igst.add(inv.igstTotal);
  }
  return { taxableValue, cgst, sgst, igst, totalTax: cgst.add(sgst).add(igst) };
}

export type ProfitAndLoss = { revenue: Prisma.Decimal; expenses: Prisma.Decimal; net: Prisma.Decimal };

/** "Revenue" here is cash actually collected (Payments), matching the
 * dashboard KPI — not invoiced amount, which may not have been paid yet. */
export function computeProfitAndLoss(revenue: Prisma.Decimal, expenses: Prisma.Decimal): ProfitAndLoss {
  return { revenue, expenses, net: revenue.sub(expenses) };
}
