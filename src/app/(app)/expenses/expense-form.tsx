"use client";

import { useActionState } from "react";
import type { Expense } from "@prisma/client";
import { saveExpenseAction } from "./actions";
import { IDLE } from "@/lib/form";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/primitives";
import { SubmitButton, FormError } from "@/components/form";
import { todayDateInputValue } from "@/lib/utils";

export type ExpenseFormValues = Pick<
  Expense,
  "id" | "vendorName" | "amount" | "taxAmount" | "expenseDate" | "method" | "categoryId" | "notes"
>;

export function ExpenseForm({
  categories,
  expense,
  hasReceipt,
}: {
  categories: { id: string; name: string }[];
  expense?: ExpenseFormValues;
  hasReceipt?: boolean;
}) {
  const [state, action] = useActionState(saveExpenseAction, IDLE);
  const today = todayDateInputValue();

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="expenseId" value={expense?.id ?? ""} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vendor" htmlFor="vendorName" error={state.fieldErrors?.vendorName}>
          <Input id="vendorName" name="vendorName" defaultValue={expense?.vendorName} required />
        </Field>
        <Field label="Category" htmlFor="categoryId">
          <Select id="categoryId" name="categoryId" defaultValue={expense?.categoryId ?? ""}>
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Amount" htmlFor="amount" error={state.fieldErrors?.amount}>
          <Input id="amount" name="amount" type="number" min="0" step="any" defaultValue={expense?.amount.toString() ?? ""} required />
        </Field>
        <Field label="Tax" htmlFor="taxAmount" hint="Tax component, if any">
          <Input id="taxAmount" name="taxAmount" type="number" min="0" step="any" defaultValue={expense?.taxAmount.toString() ?? "0"} />
        </Field>
        <Field label="Date" htmlFor="expenseDate" error={state.fieldErrors?.expenseDate}>
          <Input id="expenseDate" name="expenseDate" type="date" defaultValue={expense?.expenseDate.toISOString().slice(0, 10) ?? today} required />
        </Field>
        <Field label="Payment method" htmlFor="method">
          <Select id="method" name="method" defaultValue={expense?.method ?? "CARD"}>
            <option value="UPI">UPI</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="CARD">Card</option>
            <option value="CASH">Cash</option>
            <option value="CHEQUE">Cheque</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
      </div>

      <Field label="Notes" htmlFor="notes">
        <Textarea id="notes" name="notes" rows={2} defaultValue={expense?.notes ?? ""} />
      </Field>

      <Field
        label="Receipt"
        htmlFor="receipt"
        hint={hasReceipt ? "Uploading a new file replaces the current receipt." : "Image or PDF, up to 5MB."}
        error={state.fieldErrors?.receipt}
      >
        <input
          id="receipt"
          name="receipt"
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted"
        />
      </Field>

      <FormError message={state.error} />
      <SubmitButton pendingText="Saving…">{expense ? "Save changes" : "Add expense"}</SubmitButton>
    </form>
  );
}
