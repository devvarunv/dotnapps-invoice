"use client";

import { useActionState } from "react";
import { addExpenseCategoryAction } from "@/app/(app)/expenses/actions";
import { IDLE } from "@/lib/form";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/primitives";
import { SubmitButton, FormError, FormSuccess } from "@/components/form";

export function AddCategoryForm() {
  const [state, action] = useActionState(addExpenseCategoryAction, IDLE);
  return (
    <form action={action} className="flex items-end gap-3">
      <Field label="New category" htmlFor="name" error={state.fieldErrors?.name} className="flex-1">
        <Input id="name" name="name" placeholder="e.g. Equipment" required />
      </Field>
      <SubmitButton pendingText="Adding…">Add</SubmitButton>
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? state.message : undefined} />
    </form>
  );
}
