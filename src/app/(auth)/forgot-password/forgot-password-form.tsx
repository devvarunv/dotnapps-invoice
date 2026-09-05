"use client";

import { useActionState } from "react";
import { requestPasswordResetAction } from "../actions";
import { IDLE } from "@/lib/form";
import { Input } from "@/components/ui/input";
import { Field, Alert } from "@/components/ui/primitives";
import { SubmitButton, FormError } from "@/components/form";
import { CopyableUrl } from "@/components/copyable-url";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordResetAction, IDLE);
  const resetUrl = state.ok ? (state.data?.resetUrl as string | undefined) : undefined;

  return (
    <form action={action} className="space-y-4">
      <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={!!state.fieldErrors?.email}
        />
      </Field>

      <FormError message={state.error} />

      <SubmitButton className="w-full" pendingText="Sending…">
        Send reset link
      </SubmitButton>

      {state.ok && (
        <Alert tone="success">
          <p>{state.message}</p>
          {resetUrl && (
            <>
              <p className="mt-2 text-xs text-muted-foreground">
                No email provider is configured yet, so here&apos;s the link that would
                normally be emailed to you:
              </p>
              <div className="mt-2">
                <CopyableUrl url={resetUrl} />
              </div>
            </>
          )}
        </Alert>
      )}
    </form>
  );
}
