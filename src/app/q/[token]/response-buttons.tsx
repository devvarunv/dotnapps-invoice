"use client";

import { useActionState } from "react";
import { respondToQuotationAction } from "./actions";
import { IDLE } from "@/lib/form";
import { SubmitButton, FormError, FormSuccess } from "@/components/form";

export function ResponseButtons({ token }: { token: string }) {
  const [state, action] = useActionState(respondToQuotationAction, IDLE);

  if (state.ok) {
    return <FormSuccess message={state.message} />;
  }

  return (
    <form action={action} className="flex items-center justify-end gap-3">
      <input type="hidden" name="token" value={token} />
      <SubmitButton name="decision" value="REJECTED" variant="outline" pendingText="Submitting…">
        Reject
      </SubmitButton>
      <SubmitButton name="decision" value="ACCEPTED" pendingText="Submitting…">
        Accept quotation
      </SubmitButton>
      <FormError message={state.error} />
    </form>
  );
}
