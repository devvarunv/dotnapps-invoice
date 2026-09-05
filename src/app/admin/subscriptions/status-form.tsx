"use client";

import { useActionState } from "react";
import type { SubscriptionStatus } from "@prisma/client";
import { setSubscriptionStatusAction } from "../actions";
import { IDLE } from "@/lib/form";
import { Select } from "@/components/ui/input";

const STATUSES: SubscriptionStatus[] = ["TRIALING", "ACTIVE", "PAST_DUE", "GRACE", "SUSPENDED", "CANCELED"];

export function StatusForm({ businessId, currentStatus }: { businessId: string; currentStatus: SubscriptionStatus }) {
  const [state, action, pending] = useActionState(setSubscriptionStatusAction, IDLE);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="businessId" value={businessId} />
      <Select
        name="status"
        defaultValue={currentStatus}
        disabled={pending}
        className="h-8 w-36"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </Select>
      {state.error && <span className="text-xs text-destructive">{state.error}</span>}
    </form>
  );
}
