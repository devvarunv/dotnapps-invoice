"use client";

import { useActionState } from "react";
import { bulkMarkPaidAction } from "./bulk/actions";
import { IDLE } from "@/lib/form";
import { SubmitButton, FormError, FormSuccess } from "@/components/form";

export function BulkMarkPaidButton({ invoiceIds }: { invoiceIds: string[] }) {
  const [state, action] = useActionState(bulkMarkPaidAction, IDLE);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Mark ${invoiceIds.length} invoice(s) as fully paid?`)) e.preventDefault();
      }}
      className="inline-flex flex-col items-start gap-1"
    >
      <input type="hidden" name="invoiceIds" value={JSON.stringify(invoiceIds)} />
      <SubmitButton variant="outline" size="sm" pendingText="Marking…">Mark as paid</SubmitButton>
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? state.message : undefined} />
    </form>
  );
}
