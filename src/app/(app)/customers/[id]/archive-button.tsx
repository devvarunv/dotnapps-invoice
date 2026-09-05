"use client";

import { useActionState } from "react";
import { archiveCustomerAction } from "../actions";
import { IDLE } from "@/lib/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { SubmitButton, FormError, FormSuccess } from "@/components/form";

export function ArchiveButton({
  customerId,
  isArchived,
}: {
  customerId: string;
  isArchived: boolean;
}) {
  const [state, action] = useActionState(archiveCustomerAction, IDLE);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isArchived ? "Restore" : "Archive"}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          {isArchived
            ? "Restore this customer to the active list."
            : "Archiving keeps quotation/invoice history but hides this customer from the active list — no data is deleted."}
        </p>
        <form action={action}>
          <input type="hidden" name="customerId" value={customerId} />
          <SubmitButton variant={isArchived ? "outline" : "destructive"} pendingText="Saving…">
            {isArchived ? "Restore customer" : "Archive customer"}
          </SubmitButton>
        </form>
        <FormError message={state.error} />
        <FormSuccess message={state.ok ? state.message : undefined} />
      </CardContent>
    </Card>
  );
}
