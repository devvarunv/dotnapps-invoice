import type { ReminderRuleKind } from "@prisma/client";

/** Days relative to the invoice due date each rule fires on (spec §13). */
export const REMINDER_RULE_OFFSETS: Record<ReminderRuleKind, number> = {
  BEFORE_DUE_7: -7,
  BEFORE_DUE_2: -2,
  ON_DUE_DATE: 0,
  OVERDUE_3: 3,
  OVERDUE_7: 7,
  OVERDUE_30: 30,
};

export const REMINDER_RULE_LABELS: Record<ReminderRuleKind, string> = {
  BEFORE_DUE_7: "7 days before due",
  BEFORE_DUE_2: "2 days before due",
  ON_DUE_DATE: "On due date",
  OVERDUE_3: "3 days overdue",
  OVERDUE_7: "7 days overdue",
  OVERDUE_30: "30 days overdue",
};

/** Order rules are always displayed/evaluated in (chronological by offset). */
export const REMINDER_RULE_ORDER: ReminderRuleKind[] = [
  "BEFORE_DUE_7",
  "BEFORE_DUE_2",
  "ON_DUE_DATE",
  "OVERDUE_3",
  "OVERDUE_7",
  "OVERDUE_30",
];

export function defaultReminderTemplate(kind: ReminderRuleKind): string {
  const before = kind === "BEFORE_DUE_7" || kind === "BEFORE_DUE_2";
  if (before) {
    return "Hi {{customerName}}, a friendly reminder that invoice {{invoiceNumber}} for {{amount}} is due on {{dueDate}}. View and pay: {{link}}";
  }
  if (kind === "ON_DUE_DATE") {
    return "Hi {{customerName}}, invoice {{invoiceNumber}} for {{amount}} is due today. View and pay: {{link}}";
  }
  return "Hi {{customerName}}, invoice {{invoiceNumber}} for {{amount}} was due on {{dueDate}} and is now overdue. Please arrange payment: {{link}}";
}

export type ReminderTemplateVars = {
  customerName: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  link: string;
};

export function renderReminderTemplate(template: string, vars: ReminderTemplateVars): string {
  return template
    .replaceAll("{{customerName}}", vars.customerName)
    .replaceAll("{{invoiceNumber}}", vars.invoiceNumber)
    .replaceAll("{{amount}}", vars.amount)
    .replaceAll("{{dueDate}}", vars.dueDate)
    .replaceAll("{{link}}", vars.link);
}

/**
 * A rule is "due to send" once we've reached its offset from the due date
 * and it hasn't already fired for this invoice (spec: "Record reminder
 * events to prevent duplicate sends."). Callers exclude PAID/CANCELLED
 * invoices before calling this — a reminder about a settled invoice makes
 * no sense regardless of timing.
 */
export function isReminderDue(
  kind: ReminderRuleKind,
  dueDate: Date,
  now: Date = new Date(),
): boolean {
  const trigger = new Date(dueDate);
  trigger.setDate(trigger.getDate() + REMINDER_RULE_OFFSETS[kind]);
  return trigger <= now;
}
