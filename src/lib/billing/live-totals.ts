import type { EditableLineItem } from "@/components/app/line-item-editor";

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export type LiveTotals = { taxable: number; tax: number; grand: number };

/**
 * Client-side, plain-float preview of line-item totals — shared by the
 * line item table and the document preview panel so the two numbers never
 * drift apart. The authoritative totals always come from
 * `src/lib/billing/tax.ts` (Decimal-exact) when the server action
 * recomputes on submit; this is display-only.
 */
export function computeLiveTotals(rows: EditableLineItem[]): LiveTotals {
  let taxable = 0;
  let tax = 0;
  for (const r of rows) {
    const gross = num(r.quantity) * num(r.rate);
    const discount = gross * (num(r.discountPercent) / 100);
    const amount = gross - discount;
    taxable += amount;
    tax += amount * (num(r.taxRatePercent) / 100);
  }
  return { taxable, tax, grand: taxable + tax };
}

export function liveLineAmount(row: EditableLineItem): number {
  const gross = num(row.quantity) * num(row.rate);
  return gross - gross * (num(row.discountPercent) / 100);
}

export function formatLiveMoney(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
