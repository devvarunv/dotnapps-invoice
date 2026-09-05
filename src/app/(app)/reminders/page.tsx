import type { Metadata } from "next";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { paidAmount, computeEffectiveInvoiceStatus } from "@/lib/billing/invoice-status";
import { ensureDefaultReminderRules } from "@/lib/billing/reminder-rules";
import { REMINDER_RULE_ORDER, isReminderDue } from "@/lib/billing/reminders";
import { DeniedState } from "@/components/app/denied";
import { PageHeader } from "@/components/app/page-header";
import { QueueList } from "./queue-list";

export const metadata: Metadata = { title: "Payment Reminders" };

export default async function RemindersQueuePage() {
  const check = await checkPermission("reminders:view");
  if (!check.ok) return <DeniedState />;
  const { ctx } = check;

  await ensureDefaultReminderRules(ctx.business.id);

  const [rules, invoices] = await Promise.all([
    prisma.reminderRule.findMany({ where: { businessId: ctx.business.id, enabled: true } }),
    prisma.invoice.findMany({
      where: {
        businessId: ctx.business.id,
        status: { in: ["SENT", "VIEWED"] },
        dueDate: { not: null },
      },
      include: {
        customer: { select: { name: true } },
        allocations: { include: { payment: { select: { status: true } } } },
        reminderEvents: { select: { kind: true } },
      },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  const enabledKinds = new Set(rules.map((r) => r.kind));

  const queue = invoices.flatMap((inv) => {
    const paid = paidAmount(inv.allocations);
    const effective = computeEffectiveInvoiceStatus({
      status: inv.status,
      grandTotal: inv.grandTotal,
      dueDate: inv.dueDate,
      paid,
    });
    if (effective === "PAID" || effective === "CANCELLED") return [];

    const sentKinds = new Set(inv.reminderEvents.map((e) => e.kind));
    const due = REMINDER_RULE_ORDER.filter(
      (kind) => enabledKinds.has(kind) && !sentKinds.has(kind) && isReminderDue(kind, inv.dueDate!),
    );
    return due.map((kind) => ({
      invoiceId: inv.id,
      invoiceNumber: inv.number,
      customerName: inv.customer.name,
      currency: inv.currency,
      balance: inv.grandTotal.sub(paid).toString(),
      kind,
    }));
  });

  const canSend = can(ctx.role, "reminders:manage");

  return (
    <div>
      <PageHeader
        title="Payment Reminders"
        description="Invoices with a reminder rule due — send manually, or configure rules in Settings."
      />

      <QueueList initialQueue={queue} canSend={canSend} />
    </div>
  );
}
