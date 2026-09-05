"use client";

import { useActionState } from "react";
import type { Business } from "@prisma/client";

import { updateBusinessAction } from "../actions";
import { IDLE } from "@/lib/form";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/primitives";
import { SubmitButton, FormError, FormSuccess } from "@/components/form";

export function BusinessForm({
  business,
  editable,
}: {
  business: Business;
  editable: boolean;
}) {
  const [state, action] = useActionState(updateBusinessAction, IDLE);
  const hint = editable ? undefined : "Only owners and admins can change this.";

  return (
    <form action={action} className="space-y-8">
      <fieldset disabled={!editable} className="space-y-6">
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Profile
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name" htmlFor="name" error={state.fieldErrors?.name} hint={hint}>
              <Input id="name" name="name" defaultValue={business.name} required />
            </Field>
            <Field label="Contact email" htmlFor="contactEmail" error={state.fieldErrors?.contactEmail}>
              <Input id="contactEmail" name="contactEmail" type="email" defaultValue={business.contactEmail ?? ""} />
            </Field>
            <Field label="Contact phone" htmlFor="contactPhone" error={state.fieldErrors?.contactPhone}>
              <Input id="contactPhone" name="contactPhone" defaultValue={business.contactPhone ?? ""} />
            </Field>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Address
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Address line 1" htmlFor="addressLine1">
              <Input id="addressLine1" name="addressLine1" defaultValue={business.addressLine1 ?? ""} />
            </Field>
            <Field label="Address line 2" htmlFor="addressLine2">
              <Input id="addressLine2" name="addressLine2" defaultValue={business.addressLine2 ?? ""} />
            </Field>
            <Field label="City" htmlFor="city">
              <Input id="city" name="city" defaultValue={business.city ?? ""} />
            </Field>
            <Field label="State" htmlFor="state">
              <Input id="state" name="state" defaultValue={business.state ?? ""} />
            </Field>
            <Field label="Postal code" htmlFor="postalCode">
              <Input id="postalCode" name="postalCode" defaultValue={business.postalCode ?? ""} />
            </Field>
            <Field label="Country" htmlFor="country">
              <Input id="country" name="country" defaultValue={business.country} maxLength={2} />
            </Field>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            GST &amp; tax
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="GSTIN" htmlFor="gstin" error={state.fieldErrors?.gstin}>
              <Input id="gstin" name="gstin" defaultValue={business.gstin ?? ""} />
            </Field>
            <Field label="Registration type" htmlFor="registrationType">
              <Select id="registrationType" name="registrationType" defaultValue={business.registrationType}>
                <option value="UNREGISTERED">Unregistered</option>
                <option value="REGULAR">Regular</option>
                <option value="COMPOSITION">Composition</option>
              </Select>
            </Field>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Document numbering
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Currency" htmlFor="currency">
              <Input id="currency" name="currency" defaultValue={business.currency} maxLength={6} />
            </Field>
            <Field label="Quotation prefix" htmlFor="quotationPrefix" hint={`Next: ${business.quotationPrefix}${business.quotationNextSeq}`}>
              <Input id="quotationPrefix" name="quotationPrefix" defaultValue={business.quotationPrefix} />
            </Field>
            <Field label="Invoice prefix" htmlFor="invoicePrefix" hint={`Next: ${business.invoicePrefix}${business.invoiceNextSeq}`}>
              <Input id="invoicePrefix" name="invoicePrefix" defaultValue={business.invoicePrefix} />
            </Field>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Payment details
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Shown on quotation and invoice PDFs so customers know how to pay you.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bank account name" htmlFor="bankAccountName">
              <Input id="bankAccountName" name="bankAccountName" defaultValue={business.bankAccountName ?? ""} />
            </Field>
            <Field label="Bank name" htmlFor="bankName">
              <Input id="bankName" name="bankName" defaultValue={business.bankName ?? ""} />
            </Field>
            <Field label="Account number" htmlFor="bankAccountNumber">
              <Input id="bankAccountNumber" name="bankAccountNumber" defaultValue={business.bankAccountNumber ?? ""} />
            </Field>
            <Field label="IFSC" htmlFor="bankIfsc">
              <Input id="bankIfsc" name="bankIfsc" defaultValue={business.bankIfsc ?? ""} />
            </Field>
            <Field label="UPI ID" htmlFor="upiId">
              <Input id="upiId" name="upiId" defaultValue={business.upiId ?? ""} />
            </Field>
          </div>
        </div>
      </fieldset>

      <FormError message={state.error} />
      <FormSuccess message={state.ok ? state.message : undefined} />
      {editable && <SubmitButton pendingText="Saving…">Save changes</SubmitButton>}
    </form>
  );
}
