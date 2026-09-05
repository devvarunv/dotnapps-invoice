"use client";

import { useActionState } from "react";
import { saveQuotationAction } from "./actions";
import { IDLE } from "@/lib/form";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/primitives";
import { SubmitButton, FormError } from "@/components/form";
import { LineItemEditor, type EditableProduct, type EditableLineItem } from "@/components/app/line-item-editor";
import { todayDateInputValue } from "@/lib/utils";

export type QuotationFormValues = {
  id: string;
  customerId: string;
  quotationDate: string;
  validUntil: string | null;
  notes: string | null;
  termsAndConditions: string | null;
  items: EditableLineItem[];
};

export function QuotationForm({
  customers,
  products,
  currency,
  defaultCustomerId,
  quotation,
}: {
  customers: { id: string; name: string; companyName: string | null }[];
  products: EditableProduct[];
  currency: string;
  defaultCustomerId?: string;
  quotation?: QuotationFormValues;
}) {
  const [state, action] = useActionState(saveQuotationAction, IDLE);
  const today = todayDateInputValue();

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="quotationId" value={quotation?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Customer" htmlFor="customerId" error={state.fieldErrors?.customerId}>
          <Select id="customerId" name="customerId" defaultValue={quotation?.customerId ?? defaultCustomerId ?? ""} required>
            <option value="" disabled>
              Select a customer
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.companyName ? ` (${c.companyName})` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Quotation date" htmlFor="quotationDate" error={state.fieldErrors?.quotationDate}>
          <Input id="quotationDate" name="quotationDate" type="date" defaultValue={quotation?.quotationDate ?? today} required />
        </Field>
        <Field label="Valid until" htmlFor="validUntil">
          <Input id="validUntil" name="validUntil" type="date" defaultValue={quotation?.validUntil ?? ""} />
        </Field>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Line items
        </h3>
        <LineItemEditor
          name="items"
          products={products}
          currency={currency}
          fieldError={state.fieldErrors?.items}
          initialItems={quotation?.items}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Notes" htmlFor="notes">
          <Textarea id="notes" name="notes" rows={3} placeholder="Visible to the customer" defaultValue={quotation?.notes ?? ""} />
        </Field>
        <Field label="Terms & conditions" htmlFor="termsAndConditions">
          <Textarea id="termsAndConditions" name="termsAndConditions" rows={3} defaultValue={quotation?.termsAndConditions ?? ""} />
        </Field>
      </div>

      <FormError message={state.error} />
      <SubmitButton pendingText="Saving…">{quotation ? "Save changes" : "Save as draft"}</SubmitButton>
    </form>
  );
}
