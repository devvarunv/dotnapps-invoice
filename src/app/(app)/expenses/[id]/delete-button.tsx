"use client";

import { useActionState } from "react";
import { deleteExpenseAction } from "../actions";
import { IDLE } from "@/lib/form";
import { SubmitButton, FormError } from "@/components/form";

export function DeleteExpenseButton({ expenseId }: { expenseId: string }) {
  const [state, action] = useActionState(deleteExpenseAction, IDLE);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Delete this expense? This can't be undone.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="expenseId" value={expenseId} />
      <SubmitButton variant="destructive" size="sm" pendingText="Deleting…">Delete expense</SubmitButton>
      <FormError message={state.error} />
    </form>
  );
}
