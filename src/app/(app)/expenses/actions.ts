"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { PermissionError } from "@/lib/rbac";
import { ensureDefaultExpenseCategories } from "@/lib/finance/expense-categories";
import { suspensionGuard, planLimitGuard } from "@/lib/billing/guard";
import { expenseSchema, expenseCategorySchema } from "@/lib/validation";
import { fieldErrors, formValue, type ActionState } from "@/lib/form";

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_RECEIPT_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

export async function saveExpenseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const expenseId = formValue(formData, "expenseId");
  let ctx;
  try {
    ctx = await requirePermission(expenseId ? "expenses:edit" : "expenses:create");
  } catch (e) {
    if (e instanceof PermissionError) {
      return { error: "You don't have permission to do that." };
    }
    throw e;
  }

  const suspended = await suspensionGuard(ctx.business.id);
  if (suspended) return suspended;

  const parsed = expenseSchema.safeParse({
    vendorName: formValue(formData, "vendorName"),
    amount: formValue(formData, "amount"),
    taxAmount: formValue(formData, "taxAmount") || "0",
    expenseDate: formValue(formData, "expenseDate"),
    method: formValue(formData, "method"),
    categoryId: formValue(formData, "categoryId"),
    notes: formValue(formData, "notes"),
  });
  if (!parsed.success) {
    return { error: "Check the fields below.", fieldErrors: fieldErrors(parsed.error) };
  }
  const data = parsed.data;

  if (data.categoryId) {
    const category = await prisma.expenseCategory.findFirst({
      where: { id: data.categoryId, businessId: ctx.business.id },
    });
    if (!category) return { fieldErrors: { categoryId: "Select a valid category." } };
  }

  const values = {
    vendorName: data.vendorName,
    amount: data.amount,
    taxAmount: data.taxAmount,
    expenseDate: new Date(data.expenseDate),
    method: data.method,
    categoryId: data.categoryId || null,
    notes: data.notes || null,
  };

  const receipt = formData.get("receipt");
  let receiptData: { receiptFileName: string; receiptMimeType: string; receiptData: Uint8Array<ArrayBuffer> } | undefined;
  if (receipt instanceof File && receipt.size > 0) {
    if (receipt.size > MAX_RECEIPT_BYTES) {
      return { fieldErrors: { receipt: "Receipt must be 5MB or smaller." } };
    }
    if (!ALLOWED_RECEIPT_TYPES.includes(receipt.type)) {
      return { fieldErrors: { receipt: "Receipt must be an image (PNG/JPEG/WebP) or PDF." } };
    }
    const limited = await planLimitGuard(ctx.business.id, "maxStorageMB");
    if (limited) return limited;
    receiptData = {
      receiptFileName: receipt.name,
      receiptMimeType: receipt.type,
      receiptData: new Uint8Array(await receipt.arrayBuffer()),
    };
  }

  let id = expenseId;
  if (expenseId) {
    const existing = await prisma.expense.findFirst({
      where: { id: expenseId, businessId: ctx.business.id },
    });
    if (!existing) return { error: "That expense no longer exists." };

    await prisma.expense.update({
      where: { id: expenseId },
      data: { ...values, ...receiptData },
    });
    await recordAudit({
      action: "expense.update",
      businessId: ctx.business.id,
      actorId: ctx.user.id,
      targetType: "Expense",
      targetId: expenseId,
    });
  } else {
    const created = await prisma.expense.create({
      data: { ...values, ...receiptData, businessId: ctx.business.id, createdById: ctx.user.id },
    });
    id = created.id;
    await recordAudit({
      action: "expense.create",
      businessId: ctx.business.id,
      actorId: ctx.user.id,
      targetType: "Expense",
      targetId: created.id,
      metadata: { vendorName: created.vendorName, amount: created.amount.toString() },
    });
  }

  revalidatePath("/expenses");
  revalidatePath("/reports");
  redirect(`/expenses/${id}`);
}

export async function deleteExpenseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requirePermission("expenses:edit");
  } catch (e) {
    if (e instanceof PermissionError) {
      return { error: "You don't have permission to delete expenses." };
    }
    throw e;
  }

  const expenseId = formValue(formData, "expenseId");
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, businessId: ctx.business.id },
  });
  if (!expense) return { error: "That expense no longer exists." };

  await prisma.expense.delete({ where: { id: expenseId } });
  await recordAudit({
    action: "expense.delete",
    businessId: ctx.business.id,
    actorId: ctx.user.id,
    targetType: "Expense",
    targetId: expenseId,
    metadata: { vendorName: expense.vendorName, amount: expense.amount.toString() },
  });

  revalidatePath("/expenses");
  revalidatePath("/reports");
  redirect("/expenses");
}

export async function addExpenseCategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requirePermission("expenses:create");
  } catch (e) {
    if (e instanceof PermissionError) {
      return { error: "You don't have permission to manage categories." };
    }
    throw e;
  }

  await ensureDefaultExpenseCategories(ctx.business.id);

  const parsed = expenseCategorySchema.safeParse({ name: formValue(formData, "name") });
  if (!parsed.success) {
    return { error: "Enter a category name.", fieldErrors: fieldErrors(parsed.error) };
  }

  const existing = await prisma.expenseCategory.findUnique({
    where: { businessId_name: { businessId: ctx.business.id, name: parsed.data.name } },
  });
  if (existing) {
    if (!existing.isActive) {
      await prisma.expenseCategory.update({ where: { id: existing.id }, data: { isActive: true } });
    }
    revalidatePath("/settings/expense-categories");
    return { ok: true, message: "Category ready." };
  }

  await prisma.expenseCategory.create({ data: { businessId: ctx.business.id, name: parsed.data.name } });
  revalidatePath("/settings/expense-categories");
  return { ok: true, message: "Category added." };
}

export async function toggleExpenseCategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requirePermission("expenses:create");
  } catch (e) {
    if (e instanceof PermissionError) {
      return { error: "You don't have permission to manage categories." };
    }
    throw e;
  }

  const categoryId = formValue(formData, "categoryId");
  const category = await prisma.expenseCategory.findFirst({
    where: { id: categoryId, businessId: ctx.business.id },
  });
  if (!category) return { error: "That category no longer exists." };

  await prisma.expenseCategory.update({
    where: { id: categoryId },
    data: { isActive: !category.isActive },
  });
  revalidatePath("/settings/expense-categories");
  return { ok: true };
}
