import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { ensureDefaultExpenseCategories } from "@/lib/finance/expense-categories";
import { DeniedState } from "@/components/app/denied";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/primitives";
import { ExpenseForm } from "../expense-form";

export const metadata: Metadata = { title: "Add expense" };

export default async function NewExpensePage() {
  const check = await checkPermission("expenses:create");
  if (!check.ok) return <DeniedState />;
  const { ctx } = check;

  await ensureDefaultExpenseCategories(ctx.business.id);
  const categories = await prisma.expenseCategory.findMany({
    where: { businessId: ctx.business.id, isActive: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <Link href="/expenses" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Expenses
      </Link>
      <PageHeader title="Add expense" />
      <Card>
        <CardContent className="pt-5">
          <ExpenseForm categories={categories} />
        </CardContent>
      </Card>
    </div>
  );
}
