import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { requireBusinessContext } from "@/lib/context";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { ensureDefaultExpenseCategories } from "@/lib/finance/expense-categories";
import { DeniedState } from "@/components/app/denied";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { AddCategoryForm } from "./add-form";
import { ToggleCategoryButton } from "./toggle-button";

export const metadata: Metadata = { title: "Expense categories" };

export default async function ExpenseCategoriesPage() {
  const ctx = await requireBusinessContext();
  if (!can(ctx.role, "expenses:create")) return <DeniedState />;

  await ensureDefaultExpenseCategories(ctx.business.id);
  const categories = await prisma.expenseCategory.findMany({
    where: { businessId: ctx.business.id },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <Link href="/settings" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Settings
      </Link>
      <PageHeader title="Expense categories" description="Configurable categories for expense entries." />

      <Card className="mb-6">
        <CardContent className="pt-5">
          <AddCategoryForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm">{c.name}</span>
                <ToggleCategoryButton categoryId={c.id} isActive={c.isActive} />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
