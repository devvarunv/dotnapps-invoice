import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { DeniedState } from "@/components/app/denied";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/primitives";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "New item" };

export default async function NewProductPage() {
  const check = await checkPermission("products:create");
  if (!check.ok) return <DeniedState />;

  return (
    <div>
      <Link
        href="/products-services"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Products & Services
      </Link>
      <PageHeader title="Add item" />
      <Card>
        <CardContent className="pt-5">
          <ProductForm />
        </CardContent>
      </Card>
    </div>
  );
}
