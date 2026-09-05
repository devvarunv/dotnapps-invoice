import Link from "next/link";
import type { Metadata } from "next";
import { Package, Plus } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { DeniedState } from "@/components/app/denied";
import { PageHeader } from "@/components/app/page-header";
import { Card, Badge } from "@/components/ui/primitives";
import { buttonClassName } from "@/components/ui/button";
import { ToggleActiveButton } from "./toggle-active-button";

export const metadata: Metadata = { title: "Products & Services" };

export default async function ProductsServicesPage() {
  const check = await checkPermission("products:view");
  if (!check.ok) return <DeniedState />;
  const { ctx } = check;

  const products = await prisma.productService.findMany({
    where: { businessId: ctx.business.id },
    orderBy: { name: "asc" },
  });

  const canEdit = can(ctx.role, "products:edit");

  return (
    <div>
      <PageHeader
        title="Products & Services"
        description="Catalog with SKU, HSN/SAC, price and tax rate."
        actions={
          can(ctx.role, "products:create") ? (
            <Link href="/products-services/new" className={buttonClassName({ size: "sm" })}>
              <Plus className="size-4" /> Add item
            </Link>
          ) : undefined
        }
      />

      {products.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-muted">
            <Package className="size-5 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm font-medium">No products or services yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Add items to your catalog to speed up quotation and invoice creation.
          </p>
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-border">
            {products.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/products-services/${p.id}`} className="text-sm font-medium hover:underline">
                    {p.name}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {[p.sku, p.hsnSac, p.unit].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <span className="text-sm tabular-nums">₹{p.defaultPrice.toString()}</span>
                <span className="text-xs text-muted-foreground">{p.taxRatePercent.toString()}% tax</span>
                {canEdit ? (
                  <ToggleActiveButton productId={p.id} isActive={p.isActive} />
                ) : (
                  <Badge tone={p.isActive ? "success" : "neutral"}>{p.isActive ? "Active" : "Inactive"}</Badge>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
