import { prisma } from "@/lib/db";

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Office Supplies",
  "Travel",
  "Software & Subscriptions",
  "Rent",
  "Utilities",
  "Marketing",
  "Professional Services",
  "Meals & Entertainment",
  "Other",
];

/** Seed the default category list for a business that has none yet —
 * called at business creation and lazily wherever expenses are managed,
 * same pattern as `ensureDefaultReminderRules` (Phase 3). */
export async function ensureDefaultExpenseCategories(businessId: string): Promise<void> {
  const existing = await prisma.expenseCategory.count({ where: { businessId } });
  if (existing > 0) return;

  await prisma.expenseCategory.createMany({
    data: DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ businessId, name })),
    skipDuplicates: true,
  });
}
