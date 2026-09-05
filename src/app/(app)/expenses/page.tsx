import Link from "next/link";
import type { Metadata } from "next";
import { Prisma } from "@prisma/client";
import { Plus, Wallet, Paperclip } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS } from "@/lib/billing/payments";
import { ensureDefaultExpenseCategories } from "@/lib/finance/expense-categories";
import { DeniedState } from "@/components/app/denied";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/primitives";
import { Input, Select } from "@/components/ui/input";
import { Button, buttonClassName } from "@/components/ui/button";

export const metadata: Metadata = { title: "Expenses" };

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string; from?: string; to?: string }>;
}) {
  const check = await checkPermission("expenses:view");
  if (!check.ok) return <DeniedState />;
  const { ctx } = check;

  await ensureDefaultExpenseCategories(ctx.business.id);
  const sp = await searchParams;

  const where: Prisma.ExpenseWhereInput = { businessId: ctx.business.id };
  if (sp.categoryId) where.categoryId = sp.categoryId;
  if (sp.from || sp.to) {
    where.expenseDate = {
      ...(sp.from ? { gte: new Date(sp.from) } : {}),
      ...(sp.to ? { lte: new Date(sp.to) } : {}),
    };
  }

  const [expenses, categories] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { expenseDate: "desc" },
      select: {
        id: true,
        vendorName: true,
        amount: true,
        taxAmount: true,
        expenseDate: true,
        method: true,
        receiptFileName: true,
        category: { select: { name: true } },
      },
    }),
    prisma.expenseCategory.findMany({
      where: { businessId: ctx.business.id, isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const total = expenses.reduce((sum, e) => sum.add(e.amount).add(e.taxAmount), new Prisma.Decimal(0));

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Manual expense entries with categories and receipts."
        actions={
          can(ctx.role, "expenses:create") ? (
            <Link href="/expenses/new" className={buttonClassName({ size: "sm" })}>
              <Plus className="size-4" /> Add expense
            </Link>
          ) : undefined
        }
      />

      <form method="get" className="mb-4 grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Category</label>
          <Select name="categoryId" defaultValue={sp.categoryId ?? ""}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">From</label>
          <Input type="date" name="from" defaultValue={sp.from ?? ""} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">To</label>
          <Input type="date" name="to" defaultValue={sp.to ?? ""} />
        </div>
        <div className="flex items-end gap-2">
          <Button type="submit" size="sm">Apply</Button>
          <Link href="/expenses" className="text-xs text-muted-foreground hover:text-foreground">Clear</Link>
          <Link href="/settings/expense-categories" className="ml-auto text-xs text-muted-foreground hover:text-foreground">
            Manage categories
          </Link>
        </div>
      </form>

      {expenses.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-muted">
            <Wallet className="size-5 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm font-medium">No expenses recorded yet</p>
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-border">
            {expenses.map((e) => (
              <li key={e.id}>
                <Link href={`/expenses/${e.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {e.vendorName}
                      {e.receiptFileName && <Paperclip className="ml-1.5 inline size-3 text-muted-foreground" />}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDate(e.expenseDate)} · {e.category?.name ?? "Uncategorized"} · {PAYMENT_METHOD_LABELS[e.method]}
                    </p>
                  </div>
                  <span className="text-sm tabular-nums">{ctx.business.currency} {e.amount.add(e.taxAmount).toString()}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex justify-end border-t border-border px-5 py-3 text-sm font-semibold">
            Total: {ctx.business.currency} {total.toString()}
          </div>
        </Card>
      )}
    </div>
  );
}
