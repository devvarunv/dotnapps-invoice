"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, FileSpreadsheet, ReceiptText, BellRing, CheckCircle2 } from "lucide-react";
import type { EffectiveInvoiceStatus } from "@/lib/billing/invoice-status";
import { EFFECTIVE_STATUS_LABELS, EFFECTIVE_STATUS_TONE } from "@/lib/billing/invoice-status";
import { Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { BulkSendPanel, type BulkSendRow } from "./bulk-send-panel";
import { BulkMarkPaidButton } from "./bulk-mark-paid-button";

export type InvoiceListRow = {
  id: string;
  number: string;
  customerName: string;
  customerCompany: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  date: string;
  currency: string;
  grandTotal: string;
  balance: string;
  effectiveStatus: EffectiveInvoiceStatus;
};

export function BulkInvoiceTable({
  rows,
  canBulkSend,
  canMarkPaid,
  canExport,
}: {
  rows: InvoiceListRow[];
  canBulkSend: boolean;
  canMarkPaid: boolean;
  canExport: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<"SEND_INVOICE" | "SEND_REMINDER" | null>(null);

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);
  const selectedIds = useMemo(() => selectedRows.map((r) => r.id), [selectedRows]);

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const bulkSendRows: BulkSendRow[] = selectedRows.map((r) => ({
    id: r.id,
    currency: r.currency,
    balance: r.balance,
    customerEmail: r.customerEmail,
    customerPhone: r.customerPhone,
  }));

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 p-3">
          <span className="text-sm font-medium">{selected.size} selected</span>
          {canBulkSend && (
            <>
              <Button size="sm" variant="outline" onClick={() => setPanel("SEND_INVOICE")}>
                <ReceiptText className="size-4" /> Send Invoice
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPanel("SEND_REMINDER")}>
                <BellRing className="size-4" /> Send Reminder
              </Button>
            </>
          )}
          {canMarkPaid && <BulkMarkPaidButton invoiceIds={selectedIds} />}
          <form action="/invoices/bulk-pdf" method="POST">
            <input type="hidden" name="invoiceIds" value={JSON.stringify(selectedIds)} />
            <Button type="submit" size="sm" variant="outline">
              <Download className="size-4" /> Download PDFs
            </Button>
          </form>
          {canExport && (
            <form action="/invoices/export" method="POST">
              <input type="hidden" name="invoiceIds" value={JSON.stringify(selectedIds)} />
              <Button type="submit" size="sm" variant="outline">
                <FileSpreadsheet className="size-4" /> Export CSV
              </Button>
            </form>
          )}
        </div>
      )}

      {panel && (
        <BulkSendPanel action={panel} rows={bulkSendRows} onClose={() => setPanel(null)} />
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
              <th className="w-10 px-4 py-2">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="size-3.5 rounded border-input" />
              </th>
              <th className="px-3 py-2 font-medium">Invoice</th>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggleOne(row.id)}
                    className="size-3.5 rounded border-input"
                  />
                </td>
                <td className="px-3 py-2">
                  <Link href={`/invoices/${row.id}`} className="font-medium hover:underline">{row.number}</Link>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {row.customerName}{row.customerCompany ? ` · ${row.customerCompany}` : ""}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{row.date}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.currency} {row.grandTotal}</td>
                <td className="px-3 py-2">
                  <Badge tone={EFFECTIVE_STATUS_TONE[row.effectiveStatus]}>
                    {EFFECTIVE_STATUS_LABELS[row.effectiveStatus]}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-muted">
            <CheckCircle2 className="size-5 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm font-medium">No invoices match these filters</p>
        </div>
      )}
    </div>
  );
}
