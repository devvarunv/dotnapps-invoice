import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { requireBusinessContext } from "@/lib/context";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/primitives";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Edit item" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireBusinessContext();

  const product = await prisma.productService.findFirst({
    where: { id, businessId: ctx.business.id },
  });
  if (!product) notFound();

  return (
    <div>
      <Link
        href="/products-services"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Products & Services
      </Link>
      <PageHeader title={product.name} />
      <Card>
        <CardContent className="pt-5">
          <ProductForm product={product} />
        </CardContent>
      </Card>
    </div>
  );
}
