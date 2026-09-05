import Link from "next/link";
import type { Metadata } from "next";
import { User, Building2, Users, BellRing, Wallet, CreditCard, ChevronRight, Lock } from "lucide-react";

import { requireBusinessContext } from "@/lib/context";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireBusinessContext();

  const active = [
    {
      href: "/settings/profile",
      icon: User,
      title: "Your profile",
      desc: "Name and password.",
      show: true,
    },
    {
      href: "/settings/business",
      icon: Building2,
      title: "Business",
      desc: "Profile, GST, numbering, branding and payment details.",
      show: can(ctx.role, "business:view"),
    },
    {
      href: "/settings/team",
      icon: Users,
      title: "Team members",
      desc: "Invite people and manage roles.",
      show: can(ctx.role, "members:view"),
    },
    {
      href: "/settings/reminders",
      icon: BellRing,
      title: "Payment reminders",
      desc: "Rule-based email/WhatsApp/SMS reminder templates.",
      show: can(ctx.role, "reminders:manage"),
    },
    {
      href: "/settings/expense-categories",
      icon: Wallet,
      title: "Expense categories",
      desc: "Configurable categories for expense entries.",
      show: can(ctx.role, "expenses:create"),
    },
    {
      href: "/settings/subscription",
      icon: CreditCard,
      title: "Subscription",
      desc: "Plan, usage limits and billing status.",
      show: can(ctx.role, "billing:manage"),
    },
  ].filter((s) => s.show);

  const later = [
    "Invoice & Quotation templates",
    "Taxes",
    "Email / WhatsApp / SMS providers",
    "Notifications",
    "Integrations",
    "Security & Sessions",
  ];

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your profile, business and team."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {active.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/50">
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted">
                <s.icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{s.title}</p>
                <p className="truncate text-xs text-muted-foreground">{s.desc}</p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Card>
          </Link>
        ))}
      </div>

      <h2 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Coming in later phases
      </h2>
      <div className="grid gap-2 sm:grid-cols-3">
        {later.map((l) => (
          <div
            key={l}
            className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground"
          >
            <Lock className="size-3.5" />
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}
