import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { requireBusinessContext } from "@/lib/context";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { ensureDefaultReminderRules } from "@/lib/billing/reminder-rules";
import { REMINDER_RULE_ORDER } from "@/lib/billing/reminders";
import { DeniedState } from "@/components/app/denied";
import { PageHeader } from "@/components/app/page-header";
import { ReminderRuleForm } from "./rule-form";

export const metadata: Metadata = { title: "Reminder settings" };

export default async function ReminderSettingsPage() {
  const ctx = await requireBusinessContext();
  if (!can(ctx.role, "reminders:manage")) return <DeniedState />;

  await ensureDefaultReminderRules(ctx.business.id);
  const rules = await prisma.reminderRule.findMany({ where: { businessId: ctx.business.id } });
  const byKind = new Map(rules.map((r) => [r.kind, r]));

  return (
    <div>
      <Link href="/settings" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Settings
      </Link>
      <PageHeader
        title="Payment reminders"
        description="Rule-based email/WhatsApp/SMS reminders. No AI — every message uses your template."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {REMINDER_RULE_ORDER.map((kind) => {
          const rule = byKind.get(kind);
          return rule ? <ReminderRuleForm key={kind} rule={rule} /> : null;
        })}
      </div>
    </div>
  );
}
