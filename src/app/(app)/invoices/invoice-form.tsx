"use client";

import { useActionState } from "react";
import { saveInvoiceAction } from "./actions";
import { IDLE } from "@/lib/form";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/primitives";
import { SubmitButton, FormError } from "@/components/form";
import { LineItemEditor, type EditableProduct, type EditableLineItem } from "@/components/app/line-item-editor";
import { todayDateInputValue } from "@/lib/utils";

export type InvoiceFormValues = {
  id: string;
  customerId: string;
  invoiceDate: string;
  dueDate: string | null;
  paymentTerms: string | null;
  notes: string | null;
  termsAndConditions: string | null;
  items: EditableLineItem[];
};

export function InvoiceForm({
  customers,
  products,
  currency,
  defaultCustomerId,
  invoice,
}: {
  customers: { id: string; name: string; companyName: string | null }[];
  products: EditableProduct[];
  currency: string;
  defaultCustomerId?: string;
  invoice?: InvoiceFormValues;
}) {
  const [state, action] = useActionState(saveInvoiceAction, IDLE);
  const today = todayDateInputValue();

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="invoiceId" value={invoice?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Customer" htmlFor="customerId" error={state.fieldErrors?.customerId}>
          <Select id="customerId" name="customerId" defaultValue={invoice?.customerId ?? defaultCustomerId ?? ""} required>
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
        <Field label="Invoice date" htmlFor="invoiceDate" error={state.fieldErrors?.invoiceDate}>
          <Input id="invoiceDate" name="invoiceDate" type="date" defaultValue={invoice?.invoiceDate ?? today} required />
        </Field>
        <Field label="Due date" htmlFor="dueDate">
          <Input id="dueDate" name="dueDate" type="date" defaultValue={invoice?.dueDate ?? ""} />
        </Field>
      </div>

      <Field label="Payment terms" htmlFor="paymentTerms">
        <Input id="paymentTerms" name="paymentTerms" placeholder="e.g. Net 15" defaultValue={invoice?.paymentTerms ?? ""} />
      </Field>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Line items
        </h3>
        <LineItemEditor
          name="items"
          products={products}
          currency={currency}
          fieldError={state.fieldErrors?.items}
          initialItems={invoice?.items}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Notes" htmlFor="notes">
          <Textarea id="notes" name="notes" rows={3} placeholder="Visible to the customer" defaultValue={invoice?.notes ?? ""} />
        </Field>
        <Field label="Terms & conditions" htmlFor="termsAndConditions">
          <Textarea id="termsAndConditions" name="termsAndConditions" rows={3} defaultValue={invoice?.termsAndConditions ?? ""} />
        </Field>
      </div>

      <FormError message={state.error} />
      <SubmitButton pendingText="Saving…">{invoice ? "Save changes" : "Save as draft"}</SubmitButton>
    </form>
  );
}
