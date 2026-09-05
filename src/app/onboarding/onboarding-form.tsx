"use client";

import { useActionState } from "react";
import { createBusinessAction } from "./actions";
import { IDLE } from "@/lib/form";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/primitives";
import { SubmitButton, FormError } from "@/components/form";

export function OnboardingForm() {
  const [state, action] = useActionState(createBusinessAction, IDLE);

  return (
    <form action={action} className="space-y-4">
      <Field
        label="Business name"
        htmlFor="name"
        hint="You can add GST, branding and bank details later in Settings."
        error={state.fieldErrors?.name}
      >
        <Input
          id="name"
          name="name"
          placeholder="Acme Design Studio"
          required
          autoFocus
          aria-invalid={!!state.fieldErrors?.name}
        />
      </Field>

      <FormError message={state.error} />

      <SubmitButton className="w-full" pendingText="Creating business…">
        Create business
      </SubmitButton>
    </form>
  );
}
