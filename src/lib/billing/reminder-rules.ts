import { prisma } from "@/lib/db";
import { REMINDER_RULE_ORDER, defaultReminderTemplate } from "./reminders";

/**
 * Create any of the six reminder rules a business doesn't have yet, with
 * sensible enabled defaults and templates. Called both at business
 * creation and lazily from the reminders settings page, so a business
 * created before this model existed still gets its rules the first time
 * it visits Settings → Reminders.
 */
export async function ensureDefaultReminderRules(businessId: string): Promise<void> {
  const existing = await prisma.reminderRule.findMany({
    where: { businessId },
    select: { kind: true },
  });
  const existingKinds = new Set(existing.map((r) => r.kind));
  const missing = REMINDER_RULE_ORDER.filter((kind) => !existingKinds.has(kind));
  if (missing.length === 0) return;

  await prisma.reminderRule.createMany({
    data: missing.map((kind) => ({
      businessId,
      kind,
      enabled: true,
      channel: "EMAIL" as const,
      template: defaultReminderTemplate(kind),
    })),
    skipDuplicates: true,
  });
}
