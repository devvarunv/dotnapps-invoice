"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { PermissionError } from "@/lib/rbac";
import { reminderRuleUpdateSchema } from "@/lib/validation";
import { fieldErrors, formValue, type ActionState } from "@/lib/form";

export async function updateReminderRuleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requirePermission("reminders:manage");
  } catch (e) {
    if (e instanceof PermissionError) {
      return { error: "You don't have permission to manage reminders." };
    }
    throw e;
  }

  const parsed = reminderRuleUpdateSchema.safeParse({
    ruleId: formValue(formData, "ruleId"),
    enabled: formValue(formData, "enabled") === "on",
    channel: formValue(formData, "channel"),
    template: formValue(formData, "template"),
  });
  if (!parsed.success) {
    return { error: "Check the fields below.", fieldErrors: fieldErrors(parsed.error) };
  }

  const rule = await prisma.reminderRule.findFirst({
    where: { id: parsed.data.ruleId, businessId: ctx.business.id },
  });
  if (!rule) return { error: "That rule no longer exists." };

  await prisma.reminderRule.update({
    where: { id: rule.id },
    data: { enabled: parsed.data.enabled, channel: parsed.data.channel, template: parsed.data.template },
  });

  await recordAudit({
    action: "reminder_rule.update",
    businessId: ctx.business.id,
    actorId: ctx.user.id,
    targetType: "ReminderRule",
    targetId: rule.id,
    metadata: { kind: rule.kind, enabled: parsed.data.enabled },
  });

  revalidatePath("/settings/reminders");
  return { ok: true, message: "Reminder rule saved." };
}
