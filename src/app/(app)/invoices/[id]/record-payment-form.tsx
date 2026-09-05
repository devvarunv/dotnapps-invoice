"use client";

import { useActionState } from "react";
import { recordPaymentAction } from "@/app/(app)/payments/actions";
import { IDLE } from "@/lib/form";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/primitives";
import { SubmitButton, FormError, FormSuccess } from "@/components/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { todayDateInputValue } from "@/lib/utils";

export function RecordPaymentForm({
  invoiceId,
  balance,
  currency,
}: {
  invoiceId: string;
  balance: string;
  currency: string;
}) {
  const [state, action] = useActionState(recordPaymentAction, IDLE);
  const today = todayDateInputValue();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record payment</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          Outstanding balance: <span className="font-medium text-foreground">{currency} {balance}</span>
        </p>
        <form action={action} className="space-y-4">
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <Field label="Amount" htmlFor="amount" error={state.fieldErrors?.amount}>
            <Input id="amount" name="amount" type="number" min="0" step="any" defaultValue={balance} required />
          </Field>
          <Field label="Payment date" htmlFor="paymentDate" error={state.fieldErrors?.paymentDate}>
            <Input id="paymentDate" name="paymentDate" type="date" defaultValue={today} required />
          </Field>
          <Field label="Method" htmlFor="method">
            <Select id="method" name="method" defaultValue="BANK_TRANSFER">
              <option value="UPI">UPI</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="CARD">Card</option>
              <option value="CASH">Cash</option>
              <option value="CHEQUE">Cheque</option>
              <option value="OTHER">Other</option>
            </Select>
          </Field>
          <Field label="Reference / transaction ID" htmlFor="referenceId">
            <Input id="referenceId" name="referenceId" />
          </Field>
          <FormError message={state.error} />
          <FormSuccess message={state.ok ? state.message : undefined} />
          <SubmitButton pendingText="Recording…">Record payment</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
