"use client";

import { useActionState } from "react";
import { cancelInvoiceAction } from "../actions";
import { IDLE } from "@/lib/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { SubmitButton, FormError, FormSuccess } from "@/components/form";

export function CancelButton({ invoiceId }: { invoiceId: string }) {
  const [state, action] = useActionState(cancelInvoiceAction, IDLE);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cancel invoice</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          Cancelled invoices stay visible for audit purposes — nothing is deleted.
        </p>
        <form
          action={action}
          onSubmit={(e) => {
            if (!confirm("Cancel this invoice?")) e.preventDefault();
          }}
        >
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <SubmitButton variant="destructive" pendingText="Cancelling…">Cancel invoice</SubmitButton>
        </form>
        <FormError message={state.error} />
        <FormSuccess message={state.ok ? state.message : undefined} />
      </CardContent>
    </Card>
  );
}
