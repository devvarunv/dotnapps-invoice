"use client";

import { useActionState, useState } from "react";
import type { ReminderRuleKind } from "@prisma/client";
import { sendReminderAction } from "@/app/(app)/reminders/actions";
import { IDLE } from "@/lib/form";
import { REMINDER_RULE_LABELS } from "@/lib/billing/reminders";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Alert } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/form";

export type SentReminder = { kind: ReminderRuleKind; sentAt: string; sentByName: string | null };

export function RemindersCard({
  invoiceId,
  dueRules,
  sent,
  canSend,
}: {
  invoiceId: string;
  dueRules: ReminderRuleKind[];
  sent: SentReminder[];
  canSend: boolean;
}) {
  // Snapshot once on mount. `sendReminderAction` calls `revalidatePath` on
  // success, which re-renders this page and would otherwise hand us a
  // shorter `dueRules` prop mid-confirmation — unmounting the very row
  // that's showing the "here's what to copy" message before anyone can
  // read it. Freezing the list locally keeps a just-sent row visible.
  const [rows] = useState(dueRules);

  if (rows.length === 0 && sent.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reminders</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {canSend && rows.map((kind) => <ReminderRow key={kind} invoiceId={invoiceId} kind={kind} />)}
        {sent.length > 0 && (
          <div className="space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
            {sent.map((s) => (
              <p key={s.kind}>
                {REMINDER_RULE_LABELS[s.kind]} sent {formatDate(s.sentAt)}
                {s.sentByName ? ` by ${s.sentByName}` : ""}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReminderRow({ invoiceId, kind }: { invoiceId: string; kind: ReminderRuleKind }) {
  const [state, action] = useActionState(sendReminderAction, IDLE);
  const text = state.ok ? (state.data?.text as string | undefined) : undefined;

  if (state.ok) {
    return (
      <Alert tone="success" className="space-y-2">
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
    );
  }

  return (
    <form action={action} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="kind" value={kind} />
      <span className="text-sm">{REMINDER_RULE_LABELS[kind]} is due</span>
      <SubmitButton size="sm" pendingText="Sending…">Send now</SubmitButton>
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
