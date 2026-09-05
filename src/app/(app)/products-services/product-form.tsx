"use client";

import { useActionState } from "react";
import type { ProductService } from "@prisma/client";

import { saveProductAction } from "./actions";
import { IDLE } from "@/lib/form";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/primitives";
import { SubmitButton, FormError } from "@/components/form";

export function ProductForm({ product }: { product?: ProductService }) {
  const [state, action] = useActionState(saveProductAction, IDLE);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="productId" value={product?.id ?? ""} />

      <Field label="Name" htmlFor="name" error={state.fieldErrors?.name}>
        <Input id="name" name="name" defaultValue={product?.name} required />
      </Field>

      <Field label="Description" htmlFor="description">
        <Textarea id="description" name="description" defaultValue={product?.description ?? ""} rows={2} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="SKU" htmlFor="sku">
          <Input id="sku" name="sku" defaultValue={product?.sku ?? ""} />
        </Field>
        <Field label="HSN/SAC" htmlFor="hsnSac">
          <Input id="hsnSac" name="hsnSac" defaultValue={product?.hsnSac ?? ""} />
        </Field>
        <Field label="Unit" htmlFor="unit">
          <Input id="unit" name="unit" defaultValue={product?.unit ?? "unit"} />
        </Field>
        <Field label="Default price" htmlFor="defaultPrice" error={state.fieldErrors?.defaultPrice}>
          <Input
            id="defaultPrice"
            name="defaultPrice"
            type="number"
            min="0"
            step="any"
            defaultValue={product?.defaultPrice.toString() ?? "0"}
            required
          />
        </Field>
        <Field label="Tax rate %" htmlFor="taxRatePercent">
          <Input
            id="taxRatePercent"
            name="taxRatePercent"
            type="number"
            min="0"
            max="100"
            step="any"
            defaultValue={product?.taxRatePercent.toString() ?? "0"}
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={product?.isActive ?? true}
          className="size-3.5 rounded border-input"
        />
        Active — selectable in new quotations/invoices
      </label>

      <FormError message={state.error} />
      <SubmitButton pendingText="Saving…">{product ? "Save changes" : "Add item"}</SubmitButton>
    </form>
  );
}
