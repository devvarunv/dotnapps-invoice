"use client";

import { useActionState } from "react";
import type { SubscriptionPlan } from "@prisma/client";
import { savePlanAction } from "../actions";
import { getPlanLimits, PLAN_LIMIT_LABELS, type PlanLimits } from "@/lib/billing/plans";
import { IDLE } from "@/lib/form";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/primitives";
import { SubmitButton, FormError, FormSuccess } from "@/components/form";

const METRICS = Object.keys(PLAN_LIMIT_LABELS) as (keyof PlanLimits)[];

export function PlanForm({ plan }: { plan?: SubscriptionPlan }) {
  const [state, action] = useActionState(savePlanAction, IDLE);
  const limits = plan ? getPlanLimits(plan) : {};

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="planId" value={plan?.id ?? ""} />
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Name" htmlFor="name" error={state.fieldErrors?.name}>
          <Input id="name" name="name" defaultValue={plan?.name} required />
        </Field>
        <Field label="Slug" htmlFor="slug" error={state.fieldErrors?.slug}>
          <Input id="slug" name="slug" defaultValue={plan?.slug} required />
        </Field>
        <Field label="Price/month (INR)" htmlFor="priceMonthly">
          <Input id="priceMonthly" name="priceMonthly" type="number" min="0" step="any" defaultValue={plan?.priceMonthly.toString() ?? "0"} required />
        </Field>
        <Field label="Sort order" htmlFor="sortOrder">
          <Input id="sortOrder" name="sortOrder" type="number" min="0" defaultValue={plan?.sortOrder ?? 0} />
        </Field>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Limits (blank = unlimited)</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {METRICS.map((m) => (
            <Field key={m} label={PLAN_LIMIT_LABELS[m]} htmlFor={m}>
              <Input id={m} name={m} type="number" min="0" defaultValue={limits[m] ?? ""} placeholder="Unlimited" />
            </Field>
          ))}
        </div>
      </div>
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? state.message : undefined} />
      <SubmitButton size="sm" pendingText="Saving…">{plan ? "Save changes" : "Create plan"}</SubmitButton>
    </form>
  );
}
