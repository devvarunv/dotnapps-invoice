"use client";

import { useActionState } from "react";
import { retryBulkBatchAction } from "../actions";
import { IDLE } from "@/lib/form";
import { SubmitButton, FormError, FormSuccess } from "@/components/form";

export function RetryButton({ batchId, count }: { batchId: string; count: number }) {
  const [state, action] = useActionState(retryBulkBatchAction, IDLE);
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="batchId" value={batchId} />
      <SubmitButton variant="outline" size="sm" pendingText="Retrying…">
        Retry {count} failed/skipped
      </SubmitButton>
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? state.message : undefined} />
    </form>
  );
}
