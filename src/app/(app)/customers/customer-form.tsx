"use client";

import { useActionState, useState } from "react";
import type { Customer } from "@prisma/client";

import { saveCustomerAction } from "./actions";
import { IDLE } from "@/lib/form";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/primitives";
import { SubmitButton, FormError } from "@/components/form";

export function CustomerForm({ customer }: { customer?: Customer }) {
  const [state, action] = useActionState(saveCustomerAction, IDLE);
  const [sameAsBilling, setSameAsBilling] = useState(
    customer?.shippingSameAsBilling ?? true,
  );

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="customerId" value={customer?.id ?? ""} />

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Profile
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" error={state.fieldErrors?.name}>
            <Input id="name" name="name" defaultValue={customer?.name} required />
          </Field>
          <Field label="Company" htmlFor="companyName">
            <Input id="companyName" name="companyName" defaultValue={customer?.companyName ?? ""} />
          </Field>
          <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
            <Input id="email" name="email" type="email" defaultValue={customer?.email ?? ""} />
          </Field>
          <Field label="Phone" htmlFor="phone">
            <Input id="phone" name="phone" defaultValue={customer?.phone ?? ""} />
          </Field>
          <Field label="GSTIN" htmlFor="gstin">
            <Input id="gstin" name="gstin" defaultValue={customer?.gstin ?? ""} />
          </Field>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Billing address
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Address line 1" htmlFor="billingAddressLine1">
            <Input id="billingAddressLine1" name="billingAddressLine1" defaultValue={customer?.billingAddressLine1 ?? ""} />
          </Field>
          <Field label="Address line 2" htmlFor="billingAddressLine2">
            <Input id="billingAddressLine2" name="billingAddressLine2" defaultValue={customer?.billingAddressLine2 ?? ""} />
          </Field>
          <Field label="City" htmlFor="billingCity">
            <Input id="billingCity" name="billingCity" defaultValue={customer?.billingCity ?? ""} />
          </Field>
          <Field label="State" htmlFor="billingState" hint="Used to determine CGST/SGST vs IGST.">
            <Input id="billingState" name="billingState" defaultValue={customer?.billingState ?? ""} />
          </Field>
          <Field label="Postal code" htmlFor="billingPostalCode">
            <Input id="billingPostalCode" name="billingPostalCode" defaultValue={customer?.billingPostalCode ?? ""} />
          </Field>
          <Field label="Country" htmlFor="billingCountry">
            <Input id="billingCountry" name="billingCountry" defaultValue={customer?.billingCountry ?? "IN"} maxLength={2} />
          </Field>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Shipping address
          </h3>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              name="shippingSameAsBilling"
              checked={sameAsBilling}
              onChange={(e) => setSameAsBilling(e.target.checked)}
              className="size-3.5 rounded border-input"
            />
            Same as billing
          </label>
        </div>
        {!sameAsBilling && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Address line 1" htmlFor="shippingAddressLine1">
              <Input id="shippingAddressLine1" name="shippingAddressLine1" defaultValue={customer?.shippingAddressLine1 ?? ""} />
            </Field>
            <Field label="Address line 2" htmlFor="shippingAddressLine2">
              <Input id="shippingAddressLine2" name="shippingAddressLine2" defaultValue={customer?.shippingAddressLine2 ?? ""} />
            </Field>
            <Field label="City" htmlFor="shippingCity">
              <Input id="shippingCity" name="shippingCity" defaultValue={customer?.shippingCity ?? ""} />
            </Field>
            <Field label="State" htmlFor="shippingState">
              <Input id="shippingState" name="shippingState" defaultValue={customer?.shippingState ?? ""} />
            </Field>
            <Field label="Postal code" htmlFor="shippingPostalCode">
              <Input id="shippingPostalCode" name="shippingPostalCode" defaultValue={customer?.shippingPostalCode ?? ""} />
            </Field>
            <Field label="Country" htmlFor="shippingCountry">
              <Input id="shippingCountry" name="shippingCountry" defaultValue={customer?.shippingCountry ?? "IN"} maxLength={2} />
            </Field>
          </div>
        )}
      </div>

      <Field label="Notes" htmlFor="notes">
        <Textarea id="notes" name="notes" defaultValue={customer?.notes ?? ""} rows={3} />
      </Field>

      <FormError message={state.error} />
      <SubmitButton pendingText="Saving…">{customer ? "Save changes" : "Create customer"}</SubmitButton>
    </form>
  );
}
