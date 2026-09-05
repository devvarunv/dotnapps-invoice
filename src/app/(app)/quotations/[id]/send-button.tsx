"use client";

import { useActionState } from "react";
import { sendQuotationAction } from "../actions";
import { IDLE } from "@/lib/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { SubmitButton, FormError, FormSuccess } from "@/components/form";

export function SendButton({ quotationId }: { quotationId: string }) {
  const [state, action] = useActionState(sendQuotationAction, IDLE);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Send to customer</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          Generates a secure customer link. Email/WhatsApp/SMS delivery ships in a later phase — share the link yourself for now.
        </p>
        <form action={action}>
          <input type="hidden" name="quotationId" value={quotationId} />
          <SubmitButton pendingText="Sending…">Send quotation</SubmitButton>
        </form>
        <FormError message={state.error} />
        <FormSuccess message={state.ok ? state.message : undefined} />
      </CardContent>
    </Card>
  );
}
