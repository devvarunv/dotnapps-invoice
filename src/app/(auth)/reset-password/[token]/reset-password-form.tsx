"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetPasswordAction } from "../../actions";
import { IDLE } from "@/lib/form";
import { PasswordInput } from "@/components/ui/password-input";
import { Field } from "@/components/ui/primitives";
import { SubmitButton, FormError, FormSuccess } from "@/components/form";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, IDLE);

  if (state.ok) {
    return (
      <div className="space-y-4">
        <FormSuccess message={state.message} />
        <Link
          href="/login"
          className="block text-center text-sm font-medium text-primary hover:underline"
        >
          Go to log in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <Field
        label="New password"
        htmlFor="newPassword"
        hint="At least 10 characters."
        error={state.fieldErrors?.newPassword}
      >
        <PasswordInput
          id="newPassword"
          name="newPassword"
          autoComplete="new-password"
          required
          aria-invalid={!!state.fieldErrors?.newPassword}
        />
      </Field>

      <Field
        label="Confirm new password"
        htmlFor="confirmPassword"
        error={state.fieldErrors?.confirmPassword}
      >
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
          aria-invalid={!!state.fieldErrors?.confirmPassword}
        />
      </Field>

      <FormError message={state.error} />

      <SubmitButton className="w-full" pendingText="Updating…">
        Update password
      </SubmitButton>
    </form>
  );
}
