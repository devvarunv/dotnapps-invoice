import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { requireBusinessContext } from "@/lib/context";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { BusinessForm } from "./business-form";

export const metadata: Metadata = { title: "Business" };

export default async function BusinessSettingsPage() {
  const ctx = await requireBusinessContext();
  const editable = can(ctx.role, "business:manage");

  return (
    <div>
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Settings
      </Link>
      <PageHeader
        title="Business"
        description="Profile, GST, document numbering and payment details shown on quotations and invoices."
      />

      <Card>
        <CardHeader>
          <CardTitle>Business profile</CardTitle>
        </CardHeader>
        <CardContent>
          <BusinessForm business={ctx.business} editable={editable} />
        </CardContent>
      </Card>
    </div>
  );
}
