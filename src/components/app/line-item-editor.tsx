"use client";

import { useId, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EditableProduct = {
  id: string;
  name: string;
  unit: string;
  defaultPrice: string;
  taxRatePercent: string;
};

export type EditableLineItem = {
  key: string;
  productServiceId: string;
  description: string;
  quantity: string;
  unit: string;
  rate: string;
  discountPercent: string;
  taxRatePercent: string;
};

const EMPTY_ROW = (): EditableLineItem => ({
  key: crypto.randomUUID(),
  productServiceId: "",
  description: "",
  quantity: "1",
  unit: "unit",
  rate: "0",
  discountPercent: "0",
  taxRatePercent: "0",
});

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function money(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Client-side line item editor. Computes a live preview with plain
 * floating point (rounded for display only) — the authoritative totals
 * always come from `src/lib/billing/tax.ts` (Decimal-exact) when the
 * server action recomputes on submit, per spec §10 "Web preview and PDF
 * must use the same calculation/data layer" for the *stored* document.
 */
export function LineItemEditor({
  name,
  products,
  initialItems,
  currency,
  fieldError,
}: {
  name: string;
  products: EditableProduct[];
  initialItems?: EditableLineItem[];
  currency: string;
  fieldError?: string;
}) {
  const [rows, setRows] = useState<EditableLineItem[]>(
    initialItems && initialItems.length > 0 ? initialItems : [EMPTY_ROW()],
  );
  const inputId = useId();

  const json = useMemo(() => JSON.stringify(rows), [rows]);

  const totals = useMemo(() => {
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
  }, [rows]);

  function updateRow(key: string, patch: Partial<EditableLineItem>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function applyProduct(key: string, productId: string) {
    const product = products.find((p) => p.id === productId);
    updateRow(key, {
      productServiceId: productId,
      ...(product && {
        description: product.name,
        unit: product.unit,
        rate: product.defaultPrice,
        taxRatePercent: product.taxRatePercent,
      }),
    });
  }

  function addRow() {
    setRows((prev) => [...prev, EMPTY_ROW()]);
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }

  return (
    <div className="space-y-3">
      <input type="hidden" id={inputId} name={name} value={json} />

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
              <th className="w-56 px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="w-20 px-3 py-2 font-medium">Qty</th>
              <th className="w-20 px-3 py-2 font-medium">Unit</th>
              <th className="w-28 px-3 py-2 font-medium">Rate</th>
              <th className="w-20 px-3 py-2 font-medium">Disc %</th>
              <th className="w-20 px-3 py-2 font-medium">Tax %</th>
              <th className="w-28 px-3 py-2 text-right font-medium">Amount</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const gross = num(row.quantity) * num(row.rate);
              const amount = gross - gross * (num(row.discountPercent) / 100);
              return (
                <tr key={row.key} className="border-b border-border last:border-0">
                  <td className="p-2">
                    <Select
                      value={row.productServiceId}
                      onChange={(e) => applyProduct(row.key, e.target.value)}
                      className="h-8"
                    >
                      <option value="">Custom line…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="p-2">
                    <Input
                      value={row.description}
                      onChange={(e) => updateRow(row.key, { description: e.target.value })}
                      placeholder="Description"
                      className="h-8"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={row.quantity}
                      onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                      className="h-8"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      value={row.unit}
                      onChange={(e) => updateRow(row.key, { unit: e.target.value })}
                      className="h-8"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={row.rate}
                      onChange={(e) => updateRow(row.key, { rate: e.target.value })}
                      className="h-8"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      value={row.discountPercent}
                      onChange={(e) => updateRow(row.key, { discountPercent: e.target.value })}
                      className="h-8"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      value={row.taxRatePercent}
                      onChange={(e) => updateRow(row.key, { taxRatePercent: e.target.value })}
                      className="h-8"
                    />
                  </td>
                  <td className="whitespace-nowrap p-2 text-right tabular-nums">
                    {money(amount)}
                  </td>
                  <td className="p-2">
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                      aria-label="Remove line"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="size-4" /> Add line
        </Button>

        <dl className="space-y-1 text-right text-sm">
          <div className="flex justify-end gap-4">
            <dt className="text-muted-foreground">Taxable value</dt>
            <dd className="w-28 tabular-nums">{currency} {money(totals.taxable)}</dd>
          </div>
          <div className="flex justify-end gap-4">
            <dt className="text-muted-foreground">Tax</dt>
            <dd className="w-28 tabular-nums">{currency} {money(totals.tax)}</dd>
          </div>
          <div className="flex justify-end gap-4 font-semibold">
            <dt>Grand total</dt>
            <dd className="w-28 tabular-nums">{currency} {money(totals.grand)}</dd>
          </div>
        </dl>
      </div>

      {fieldError ? <p className={cn("text-xs text-destructive")}>{fieldError}</p> : null}
    </div>
  );
}
