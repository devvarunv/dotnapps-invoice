"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { PermissionError } from "@/lib/rbac";
import { productServiceSchema } from "@/lib/validation";
import { fieldErrors, formValue, type ActionState } from "@/lib/form";

export async function saveProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const productId = formValue(formData, "productId");
  const permission = productId ? "products:edit" : "products:create";

  let ctx;
  try {
    ctx = await requirePermission(permission);
  } catch (e) {
    if (e instanceof PermissionError) {
      return { error: "You don't have permission to do that." };
    }
    throw e;
  }

  const parsed = productServiceSchema.safeParse({
    name: formValue(formData, "name"),
    description: formValue(formData, "description"),
    sku: formValue(formData, "sku"),
    hsnSac: formValue(formData, "hsnSac"),
    unit: formValue(formData, "unit") || "unit",
    defaultPrice: formValue(formData, "defaultPrice"),
    taxRatePercent: formValue(formData, "taxRatePercent") || "0",
    isActive: formValue(formData, "isActive") === "on",
  });
  if (!parsed.success) {
    return { error: "Check the fields below.", fieldErrors: fieldErrors(parsed.error) };
  }

  const data = parsed.data;
  const values = {
    name: data.name,
    description: data.description || null,
    sku: data.sku || null,
    hsnSac: data.hsnSac || null,
    unit: data.unit,
    defaultPrice: data.defaultPrice,
    taxRatePercent: data.taxRatePercent,
    isActive: data.isActive,
  };

  if (productId) {
    const existing = await prisma.productService.findFirst({
      where: { id: productId, businessId: ctx.business.id },
    });
    if (!existing) return { error: "That item no longer exists." };

    await prisma.productService.update({ where: { id: productId }, data: values });
    await recordAudit({
      action: "product.update",
      businessId: ctx.business.id,
      actorId: ctx.user.id,
      targetType: "ProductService",
      targetId: productId,
    });
  } else {
    const created = await prisma.productService.create({
      data: { ...values, businessId: ctx.business.id },
    });
    await recordAudit({
      action: "product.create",
      businessId: ctx.business.id,
      actorId: ctx.user.id,
      targetType: "ProductService",
      targetId: created.id,
      metadata: { name: created.name },
    });
  }

  revalidatePath("/products-services");
  redirect("/products-services");
}

export async function toggleProductActiveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requirePermission("products:edit");
  } catch (e) {
    if (e instanceof PermissionError) {
      return { error: "You don't have permission to do that." };
    }
    throw e;
  }

  const productId = formValue(formData, "productId");
  const product = await prisma.productService.findFirst({
    where: { id: productId, businessId: ctx.business.id },
  });
  if (!product) return { error: "That item no longer exists." };

  await prisma.productService.update({
    where: { id: productId },
    data: { isActive: !product.isActive },
  });
  await recordAudit({
    action: product.isActive ? "product.deactivate" : "product.activate",
    businessId: ctx.business.id,
    actorId: ctx.user.id,
    targetType: "ProductService",
    targetId: productId,
  });

  revalidatePath("/products-services");
  return { ok: true };
}
