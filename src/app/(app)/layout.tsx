import { requireBusinessContext } from "@/lib/context";
import { getSubscription } from "@/lib/billing/entitlements";
import { Sidebar, type SidebarBusiness } from "@/components/app/sidebar";
import { BillingBanner } from "@/components/app/billing-banner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireBusinessContext();
  const subscription = await getSubscription(ctx.business.id);

  const businesses: SidebarBusiness[] = ctx.memberships.map((m) => ({
    id: m.businessId,
    name: m.business.name,
    role: m.role,
  }));

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Sidebar
        role={ctx.role}
        activeBusinessId={ctx.business.id}
        businesses={businesses}
        user={{ name: ctx.user.name, email: ctx.user.email }}
        isSuperAdmin={ctx.user.isSuperAdmin}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <BillingBanner status={subscription.status} trialEndsAt={subscription.trialEndsAt} graceEndsAt={subscription.graceEndsAt} />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
