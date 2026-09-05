import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { DeniedState } from "@/components/app/denied";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/primitives";
import { QuotationForm } from "../quotation-form";

export const metadata: Metadata = { title: "New quotation" };

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const check = await checkPermission("quotations:create");
  if (!check.ok) return <DeniedState />;
  const { ctx } = check;
  const { customerId } = await searchParams;

  const [customers, products] = await Promise.all([
    prisma.customer.findMany({
      where: { businessId: ctx.business.id, isArchived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, companyName: true },
    }),
    prisma.productService.findMany({
      where: { businessId: ctx.business.id, isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <Link
        href="/quotations"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Quotations
      </Link>
      <PageHeader title="New quotation" />

      {customers.length === 0 ? (
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">
            You need at least one customer before creating a quotation.{" "}
            <Link href="/customers/new" className="text-primary hover:underline">
              Add a customer
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-5">
            <QuotationForm
              customers={customers}
              products={products.map((p) => ({
                id: p.id,
                name: p.name,
                unit: p.unit,
                defaultPrice: p.defaultPrice.toString(),
                taxRatePercent: p.taxRatePercent.toString(),
              }))}
              currency={ctx.business.currency}
              defaultCustomerId={customerId}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
