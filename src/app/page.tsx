import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthContext } from "@/lib/context";
import { Logo } from "@/components/brand";
import { buttonClassName } from "@/components/ui/button";

export default async function LandingPage() {
  const ctx = await getAuthContext();
  if (ctx) redirect(ctx.membership ? "/dashboard" : "/onboarding");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
        <Logo href={null} />
        <nav className="flex items-center gap-4">
          <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground">
            Pricing
          </Link>
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
            Log in
          </Link>
          <Link href="/signup" className={buttonClassName({ size: "sm" })}>
            Get started
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Create. Quote. Invoice.
          <br />
          Share. Get Paid.
        </h1>
        <p className="mt-4 max-w-xl text-balance text-muted-foreground">
          GST-aware quotations and invoicing, payments, bulk bill sharing and
          reminders for freelancers, agencies, consultants and SMEs.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Link href="/signup" className={buttonClassName({ size: "lg" })}>
            Create your business
          </Link>
          <Link href="/login" className={buttonClassName({ variant: "outline", size: "lg" })}>
            Log in
          </Link>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-6 py-8 text-center text-xs text-muted-foreground">
        Dotnapps Invoice — V1
      </footer>
    </div>
  );
}
