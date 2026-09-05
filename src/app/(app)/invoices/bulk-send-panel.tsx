"use client";

import { useActionState, useMemo, useState } from "react";
import { createBulkBatchAction } from "./bulk/actions";
import { IDLE } from "@/lib/form";
import { Select } from "@/components/ui/input";
import { Field, Card, CardContent, CardHeader, CardTitle, Alert } from "@/components/ui/primitives";
import { SubmitButton, FormError } from "@/components/form";

export type BulkSendRow = {
  id: string;
  currency: string;
  balance: string;
  customerEmail: string | null;
  customerPhone: string | null;
};

export function BulkSendPanel({
  action,
  rows,
  onClose,
}: {
  action: "SEND_INVOICE" | "SEND_REMINDER";
  rows: BulkSendRow[];
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(createBulkBatchAction, IDLE);
  const [channel, setChannel] = useState<"EMAIL" | "WHATSAPP" | "SMS">("EMAIL");

  const { totalAmount, currency, validCount, missingCount } = useMemo(() => {
    let total = 0;
    let valid = 0;
    let missing = 0;
    for (const r of rows) {
      total += Number(r.balance);
      const contact = channel === "EMAIL" ? r.customerEmail : r.customerPhone;
      if (contact) valid += 1;
      else missing += 1;
    }
    return { totalAmount: total, currency: rows[0]?.currency ?? "INR", validCount: valid, missingCount: missing };
  }, [rows, channel]);

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle>{action === "SEND_INVOICE" ? "Send invoices" : "Send reminders"} — {rows.length} selected</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="invoiceIds" value={JSON.stringify(rows.map((r) => r.id))} />
          <input type="hidden" name="action" value={action} />
          <input type="hidden" name="channel" value={channel} />

          <Field label="Channel" htmlFor="bulk-channel">
            <Select
              id="bulk-channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value as typeof channel)}
            >
              <option value="EMAIL">Email</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="SMS">SMS</option>
            </Select>
          </Field>

          <dl className="grid grid-cols-2 gap-3 rounded-md border border-border bg-muted/30 p-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Invoices</dt>
              <dd className="font-medium">{rows.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Total amount</dt>
              <dd className="font-medium">{currency} {totalAmount.toLocaleString("en-IN")}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Valid recipients</dt>
              <dd className="font-medium text-emerald-700 dark:text-emerald-400">{validCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Missing contact</dt>
              <dd className={missingCount > 0 ? "font-medium text-amber-700 dark:text-amber-400" : "font-medium"}>
                {missingCount}
              </dd>
            </div>
          </dl>

          {missingCount > 0 && (
            <Alert tone="info">
              {missingCount} invoice(s) will be skipped — their customer has no {channel === "EMAIL" ? "email" : "phone number"} on file.
            </Alert>
          )}

          <FormError message={state.error} />

          <div className="flex gap-2">
            <SubmitButton pendingText="Processing…">Confirm & process</SubmitButton>
            <button type="button" onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
