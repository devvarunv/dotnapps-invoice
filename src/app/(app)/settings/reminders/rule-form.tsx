"use client";

import { useActionState } from "react";
import type { ReminderRule } from "@prisma/client";
import { updateReminderRuleAction } from "./actions";
import { IDLE } from "@/lib/form";
import { REMINDER_RULE_LABELS } from "@/lib/billing/reminders";
import { Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/primitives";
import { SubmitButton, FormError, FormSuccess } from "@/components/form";

export function ReminderRuleForm({ rule }: { rule: ReminderRule }) {
  const [state, action] = useActionState(updateReminderRuleAction, IDLE);

  return (
    <form action={action} className="space-y-3 rounded-md border border-border p-4">
      <input type="hidden" name="ruleId" value={rule.id} />
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{REMINDER_RULE_LABELS[rule.kind]}</p>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" name="enabled" defaultChecked={rule.enabled} className="size-3.5 rounded border-input" />
          Enabled
        </label>
      </div>
      <Field label="Channel" htmlFor={`channel-${rule.id}`}>
        <Select id={`channel-${rule.id}`} name="channel" defaultValue={rule.channel}>
          <option value="EMAIL">Email</option>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="SMS">SMS</option>
        </Select>
      </Field>
      <Field
        label="Message template"
        htmlFor={`template-${rule.id}`}
        hint="Variables: {{customerName}}, {{invoiceNumber}}, {{amount}}, {{dueDate}}, {{link}}"
        error={state.fieldErrors?.template}
      >
        <Textarea id={`template-${rule.id}`} name="template" defaultValue={rule.template} rows={2} />
      </Field>
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? state.message : undefined} />
      <SubmitButton size="sm" pendingText="Saving…">Save</SubmitButton>
    </form>
  );
}
