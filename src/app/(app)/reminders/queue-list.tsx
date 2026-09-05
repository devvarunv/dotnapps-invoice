"use client";

import { useState } from "react";
import { BellRing } from "lucide-react";
import Link from "next/link";
import type { ReminderRuleKind } from "@prisma/client";
import { REMINDER_RULE_LABELS } from "@/lib/billing/reminders";
import { Card } from "@/components/ui/primitives";
import { QueueRow } from "./queue-row";

export type QueueItem = {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  currency: string;
  balance: string;
  kind: ReminderRuleKind;
};

export function QueueList({ initialQueue, canSend }: { initialQueue: QueueItem[]; canSend: boolean }) {
  // Snapshot on mount — see the comment on RemindersCard for why: sending
  // one reminder revalidates this page, which would otherwise hand us a
  // shorter queue mid-confirmation and unmount the row before its
  // "here's what to copy" message can be read.
  const [queue] = useState(initialQueue);

  if (queue.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
        <div className="mx-auto grid size-11 place-items-center rounded-full bg-muted">
          <BellRing className="size-5 text-muted-foreground" />
        </div>
        <p className="mt-4 text-sm font-medium">Nothing due right now</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Invoices approaching or past their due date will show up here based on your{" "}
          <Link href="/settings/reminders" className="text-primary hover:underline">reminder rules</Link>.
        </p>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <ul className="divide-y divide-border">
        {queue.map((q) => (
          <QueueRow
            key={`${q.invoiceId}-${q.kind}`}
            invoiceId={q.invoiceId}
            invoiceNumber={q.invoiceNumber}
            customerName={q.customerName}
            ruleLabel={REMINDER_RULE_LABELS[q.kind]}
            kind={q.kind}
            amount={`${q.currency} ${q.balance}`}
            canSend={canSend}
          />
        ))}
      </ul>
    </Card>
  );
}
