"use client";

import { useActionState } from "react";
import { changePlanAction, simulatePaymentAction, cancelSubscriptionAction } from "./actions";
import { IDLE } from "@/lib/form";
import { SubmitButton, FormError, FormSuccess } from "@/components/form";

export function ChangePlanButton({ planId, label, disabled }: { planId: string; label: string; disabled?: boolean }) {
  const [state, action] = useActionState(changePlanAction, IDLE);
  return (
    <form action={action}>
      <input type="hidden" name="planId" value={planId} />
      <SubmitButton size="sm" variant={disabled ? "outline" : "default"} disabled={disabled} pendingText="Switching…">
        {label}
      </SubmitButton>
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? state.message : undefined} />
    </form>
  );
}

export function SimulatePaymentButton() {
  const [state, action] = useActionState(simulatePaymentAction, IDLE);
  return (
    <form action={action}>
      <SubmitButton pendingText="Processing…">Simulate payment</SubmitButton>
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? state.message : undefined} />
    </form>
  );
}

export function CancelSubscriptionButton() {
  const [state, action] = useActionState(cancelSubscriptionAction, IDLE);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Cancel your subscription? Your data is never deleted, and you can reactivate anytime.")) e.preventDefault();
      }}
    >
      <SubmitButton variant="destructive" size="sm" pendingText="Cancelling…">Cancel subscription</SubmitButton>
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? state.message : undefined} />
    </form>
  );
}
