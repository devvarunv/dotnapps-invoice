import Link from "next/link";
import { redirect } from "next/navigation";
import {
  FileText,
  ReceiptText,
  Send,
  CreditCard,
  BarChart3,
  Users,
  ShieldCheck,
  ArrowRight,
  Check,
} from "lucide-react";

import { getAuthContext } from "@/lib/context";
import { prisma } from "@/lib/db";
import { ensureDefaultPlans, getPlanLimits } from "@/lib/billing/plans";
import { Logo } from "@/components/brand";
import { buttonClassName } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/primitives";

const FEATURES = [
  {
    icon: FileText,
    title: "Quotations that convert",
    description:
      "Create, send and track quotations with a secure customer link. Accepted quotations convert straight to an invoice — no re-typing line items.",
  },
  {
    icon: ReceiptText,
    title: "GST-aware invoicing",
    description:
      "CGST/SGST/IGST calculated automatically from business and customer state, with HSN/SAC, place of supply and both tax-inclusive and exclusive pricing.",
  },
  {
    icon: Send,
    title: "Bulk bill sharing",
    description:
      "Filter, select and send invoices or reminders in bulk with a live preview before you confirm — one failed recipient never stops the batch, and every failure can be retried.",
  },
  {
    icon: CreditCard,
    title: "Payments & reminders",
    description:
      "Record full or partial payments across UPI, bank transfer, card, cash or cheque. Rule-based reminders fire before and after the due date automatically.",
  },
  {
    icon: BarChart3,
    title: "Reports that reconcile",
    description:
      "Receivables aging, GST summaries, sales by customer or product, and profit & loss — computed live from your actual transactions, never a stale snapshot.",
  },
  {
    icon: Users,
    title: "Built for a team",
    description:
      "Five roles — Owner, Admin, Accountant, Sales, Staff — each with server-enforced permissions, so the right people see the right things.",
  },
];

const STEPS = [
  { title: "Create", description: "Add customers, products and services, then build a quotation or invoice in minutes." },
  { title: "Send", description: "Share a secure, branded link — the customer can view, download the PDF, and accept or pay." },
  { title: "Get paid", description: "Track payments as they come in, chase overdue balances automatically, and see it all reconcile in Reports." },
];

export default async function LandingPage() {
  const ctx = await getAuthContext();
  if (ctx) redirect(ctx.membership ? "/dashboard" : "/onboarding");

  await ensureDefaultPlans();
  const plans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <Logo href={null} />
          <nav className="flex items-center gap-5">
            <Link href="#features" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
              Features
            </Link>
            <Link href="/pricing" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
              Pricing
            </Link>
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
              Log in
            </Link>
            <Link href="/signup" className={buttonClassName({ size: "sm" })}>
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Create. Quote. Invoice.
              <br />
              Share. Get Paid.
            </h1>
            <p className="mt-5 max-w-lg text-balance text-muted-foreground">
              GST-aware quotations and invoicing, payments, bulk bill sharing and
              reminders — built for freelancers, agencies, consultants and SMEs
              who bill in India.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/signup" className={buttonClassName({ size: "lg" })}>
                Start your 14-day trial
                <ArrowRight className="size-4" />
              </Link>
              <Link href="/pricing" className={buttonClassName({ variant: "outline", size: "lg" })}>
                See pricing
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              No credit card required. Every plan starts on a free trial.
            </p>
          </div>

          {/* Illustrative product preview */}
          <Card className="overflow-hidden p-0 shadow-lg">
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Preview
              </p>
              <span className="rounded-full bg-black px-2 py-0.5 text-[10px] font-medium text-white">
                Sent
              </span>
            </div>
            <div className="space-y-5 p-5 text-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-bold tracking-tight">INVOICE</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">#INV-0182</p>
                </div>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  AD
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 border-y border-border py-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Billed to</p>
                  <p className="mt-0.5 font-medium">Mehta Textiles Pvt Ltd</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Due date</p>
                  <p className="mt-0.5 font-medium">30 Sep 2026</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span>Website design × 1</span>
                  <span className="tabular-nums">INR 45,000.00</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>Brand guidelines × 1</span>
                  <span className="tabular-nums">INR 15,000.00</span>
                </div>
              </div>
              <div className="space-y-1 border-t border-border pt-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxable value</span>
                  <span className="tabular-nums">INR 60,000.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CGST + SGST</span>
                  <span className="tabular-nums">INR 10,800.00</span>
                </div>
                <div className="flex justify-between text-sm font-semibold">
                  <span>Grand total</span>
                  <span className="tabular-nums">INR 70,800.00</span>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* Feature grid */}
        <section id="features" className="border-t border-border bg-muted/20 py-16 sm:py-24">
          <div className="mx-auto w-full max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">Everything billing needs, in one place</h2>
              <p className="mt-3 text-muted-foreground">
                No AI, no gimmicks — just a reliable, tenant-isolated billing workflow with an audit trail on every mutation.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <Card key={f.title} className="h-full">
                  <CardContent className="pt-5">
                    <span className="grid size-10 place-items-center rounded-full bg-black text-white">
                      <f.icon className="size-5" />
                    </span>
                    <h3 className="mt-4 font-semibold">{f.title}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">{f.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto w-full max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">From first quote to paid invoice</h2>
            </div>
            <div className="mt-12 grid gap-8 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <div key={step.title} className="text-center sm:text-left">
                  <span className="grid size-9 place-items-center rounded-full bg-black text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing teaser */}
        <section className="border-t border-border bg-muted/20 py-16 sm:py-24">
          <div className="mx-auto w-full max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">Simple, transparent pricing</h2>
              <p className="mt-3 text-muted-foreground">
                Start on a 14-day trial. Upgrade or downgrade anytime — your data is never deleted, ever.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              {plans.map((plan) => {
                const limits = getPlanLimits(plan);
                const isMiddle = plan.sortOrder === 1;
                return (
                  <Card key={plan.id} className={isMiddle ? "border-black shadow-md" : undefined}>
                    <CardContent className="pt-5">
                      <p className="text-sm font-semibold">{plan.name}</p>
                      <p className="mt-1 text-2xl font-bold">
                        {plan.currency} {plan.priceMonthly.toString()}
                        <span className="text-sm font-normal text-muted-foreground">/mo</span>
                      </p>
                      <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                        <li className="flex items-center gap-1.5">
                          <Check className="size-3.5 shrink-0 text-black" />
                          {limits.maxUsers ?? "Unlimited"} team members
                        </li>
                        <li className="flex items-center gap-1.5">
                          <Check className="size-3.5 shrink-0 text-black" />
                          {limits.maxInvoicesPerMonth ?? "Unlimited"} invoices / month
                        </li>
                        <li className="flex items-center gap-1.5">
                          <Check className="size-3.5 shrink-0 text-black" />
                          {limits.maxCustomers ?? "Unlimited"} customers
                        </li>
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <div className="mt-8 text-center">
              <Link href="/pricing" className="inline-flex items-center gap-1 text-sm font-medium hover:underline">
                Compare all plan details <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 text-center">
            <ShieldCheck className="size-8 text-muted-foreground" />
            <h2 className="text-3xl font-bold tracking-tight">Ready to send your first invoice?</h2>
            <p className="text-muted-foreground">
              Set up your business profile and create your first quotation in minutes.
            </p>
            <Link href="/signup" className={buttonClassName({ size: "lg" })}>
              Create your business
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <Logo href="/" className="text-sm" />
          <nav className="flex items-center gap-5">
            <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
            <Link href="/login" className="hover:text-foreground">Log in</Link>
            <Link href="/signup" className="hover:text-foreground">Sign up</Link>
          </nav>
          <p className="text-xs">© {new Date().getFullYear()} Dotnapps Invoice — V1</p>
        </div>
      </footer>
    </div>
  );
}
