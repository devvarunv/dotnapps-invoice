"use client";

import { useActionState } from "react";
import { Download } from "lucide-react";
import { reversePaymentAction } from "@/app/(app)/payments/actions";
import { IDLE } from "@/lib/form";
import { formatDate } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS } from "@/lib/billing/payments";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/form";

export type InvoicePayment = {
  id: string;
  amount: string;
  paymentDate: string;
  method: keyof typeof PAYMENT_METHOD_LABELS;
  referenceId: string | null;
  status: "ACTIVE" | "REVERSED";
};

export function PaymentsList({
  payments,
  currency,
  canReverse,
}: {
  payments: InvoicePayment[];
  currency: string;
  canReverse: boolean;
}) {
  if (payments.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payments received</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {payments.map((p) => (
            <PaymentRow key={p.id} payment={p} currency={currency} canReverse={canReverse} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function PaymentRow({
  payment,
  currency,
  canReverse,
}: {
  payment: InvoicePayment;
  currency: string;
  canReverse: boolean;
}) {
  const [state, action] = useActionState(reversePaymentAction, IDLE);

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {currency} {payment.amount}
          {payment.status === "REVERSED" && (
            <Badge tone="danger" className="ml-2">Reversed</Badge>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDate(payment.paymentDate)} · {PAYMENT_METHOD_LABELS[payment.method]}
          {payment.referenceId ? ` · ${payment.referenceId}` : ""}
        </p>
        {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      </div>
      <a
        href={`/payments/${payment.id}/receipt`}
        target="_blank"
        rel="noreferrer"
        className="text-muted-foreground hover:text-foreground"
        aria-label="Download receipt"
      >
        <Download className="size-4" />
      </a>
      {canReverse && payment.status === "ACTIVE" && (
        <form
          action={action}
          onSubmit={(e) => {
            if (!confirm("Reverse this payment? It stays visible for audit purposes.")) e.preventDefault();
          }}
        >
          <input type="hidden" name="paymentId" value={payment.id} />
          <SubmitButton variant="ghost" size="sm" pendingText="…">
            Reverse
          </SubmitButton>
        </form>
      )}
    </li>
  );
}
