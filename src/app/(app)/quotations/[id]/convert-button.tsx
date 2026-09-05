"use client";

import { useActionState } from "react";
import { convertQuotationToInvoiceAction } from "../actions";
import { IDLE } from "@/lib/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { SubmitButton, FormError } from "@/components/form";

export function ConvertButton({ quotationId }: { quotationId: string }) {
  const [state, action] = useActionState(convertQuotationToInvoiceAction, IDLE);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Convert to invoice</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          Creates an invoice with the same items and totals, linked back to this quotation.
        </p>
        <form action={action}>
          <input type="hidden" name="quotationId" value={quotationId} />
          <SubmitButton pendingText="Converting…">Convert to invoice</SubmitButton>
        </form>
        <FormError message={state.error} />
      </CardContent>
    </Card>
  );
}
