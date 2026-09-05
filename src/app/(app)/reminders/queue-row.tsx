"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { ReminderRuleKind } from "@prisma/client";
import { sendReminderAction } from "./actions";
import { IDLE } from "@/lib/form";
import { SubmitButton } from "@/components/form";
import { Alert } from "@/components/ui/primitives";

export function QueueRow({
  invoiceId,
  invoiceNumber,
  customerName,
  ruleLabel,
  kind,
  amount,
  canSend,
}: {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  ruleLabel: string;
  kind: ReminderRuleKind;
  amount: string;
  canSend: boolean;
}) {
  const [state, action] = useActionState(sendReminderAction, IDLE);
  const text = state.ok ? (state.data?.text as string | undefined) : undefined;

  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            <Link href={`/invoices/${invoiceId}`} className="hover:underline">{invoiceNumber}</Link>
            {" · "}{customerName}
          </p>
          <p className="text-xs text-muted-foreground">{ruleLabel} · {amount} outstanding</p>
        </div>
        {canSend && !state.ok && (
          <form action={action}>
            <input type="hidden" name="invoiceId" value={invoiceId} />
            <input type="hidden" name="kind" value={kind} />
            <SubmitButton size="sm" pendingText="Sending…">Send now</SubmitButton>
          </form>
        )}
      </div>
      {state.error && <p className="mt-1 text-xs text-destructive">{state.error}</p>}
      {state.ok && (
        <Alert tone="success" className="mt-2 space-y-2">
          <p>{state.message}</p>
          {text && (
            <textarea
              readOnly
              value={text}
              rows={3}
              className="w-full rounded border border-border bg-background p-2 text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
          )}
        </Alert>
      )}
    </li>
  );
}
