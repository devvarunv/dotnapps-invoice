import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download } from "lucide-react";

import { requireBusinessContext } from "@/lib/context";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/primitives";
import { buttonClassName } from "@/components/ui/button";
import { ExpenseForm } from "../expense-form";
import { DeleteExpenseButton } from "./delete-button";

export const metadata: Metadata = { title: "Expense" };

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireBusinessContext();

  const expense = await prisma.expense.findFirst({
    where: { id, businessId: ctx.business.id },
    select: {
      id: true,
      vendorName: true,
      amount: true,
      taxAmount: true,
      expenseDate: true,
      method: true,
      notes: true,
      categoryId: true,
      receiptFileName: true,
    },
  });
  if (!expense) notFound();

  const canEdit = can(ctx.role, "expenses:edit");
  const categories = await prisma.expenseCategory.findMany({
    where: { businessId: ctx.business.id, isActive: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <Link href="/expenses" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Expenses
      </Link>
      <PageHeader
        title={expense.vendorName}
        actions={
          expense.receiptFileName ? (
            <a href={`/expenses/${expense.id}/receipt`} target="_blank" rel="noreferrer" className={buttonClassName({ variant: "outline", size: "sm" })}>
              <Download className="size-4" /> Receipt
            </a>
          ) : undefined
        }
      />

      <Card className="mb-6">
        <CardContent className="pt-5">
          {canEdit ? (
            <ExpenseForm
              categories={categories}
              expense={expense}
              hasReceipt={Boolean(expense.receiptFileName)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">You don&apos;t have permission to edit expenses.</p>
          )}
        </CardContent>
      </Card>

      {canEdit && <DeleteExpenseButton expenseId={expense.id} />}
    </div>
  );
}
