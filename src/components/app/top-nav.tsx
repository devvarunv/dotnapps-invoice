"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown, LogOut, Shield, Check, Settings as SettingsIcon } from "lucide-react";
import type { Role } from "@prisma/client";

import { cn, initials } from "@/lib/utils";
import { NAV } from "@/lib/nav";
import { can, ROLE_LABELS } from "@/lib/rbac";
import { Logo } from "@/components/brand";
import { switchBusinessAction, signOutAction } from "@/app/(app)/actions";

export type NavBusiness = { id: string; name: string; role: Role };
export type NavUser = { name: string; email: string };

/**
 * Horizontal top navigation — pill links for every module, a black pill
 * for whichever one is active (spec §2's primary nav, flattened: a
 * horizontal bar doesn't really support the sidebar's old grouped section
 * headers). Business switching, Settings and sign-out live in the avatar
 * menu instead of a permanent rail.
 */
export function TopNav({
  role,
  activeBusinessId,
  businesses,
  user,
  isSuperAdmin,
}: {
  role: Role;
  activeBusinessId: string;
  businesses: NavBusiness[];
  user: NavUser;
  isSuperAdmin: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const activeBusiness = businesses.find((b) => b.id === activeBusinessId);

  const items = NAV.flatMap((g) => g.items).filter(
    (i) => i.href !== "/settings" && can(role, i.permission),
  );

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const pill = (active: boolean) =>
    cn(
      "shrink-0 rounded-full px-3 py-2 text-sm font-medium transition-colors",
      active ? "bg-black text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  const avatarMenu = (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-border bg-background py-1 pl-1 pr-2 hover:bg-muted">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold">
          {initials(user.name)}
        </span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
        <div className="border-b border-border px-3 py-2.5">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>

        {businesses.length > 1 && (
          <div className="border-b border-border py-1">
            <p className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Switch business
            </p>
            {businesses.map((b) => (
              <form key={b.id} action={switchBusinessAction}>
                <input type="hidden" name="businessId" value={b.id} />
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span className="flex-1 truncate">{b.name}</span>
                  <span className="text-xs text-muted-foreground">{ROLE_LABELS[b.role]}</span>
                  {b.id === activeBusinessId && <Check className="size-4 text-primary" />}
                </button>
              </form>
            ))}
          </div>
        )}

        <div className="py-1">
          <Link href="/settings" className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted">
            <SettingsIcon className="size-4 text-muted-foreground" /> Settings
          </Link>
          <Link href="/onboarding" className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
            + Create business
          </Link>
          {isSuperAdmin && (
            <Link href="/admin" className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted">
              <Shield className="size-4 text-muted-foreground" /> Super Admin
            </Link>
          )}
        </div>

        <form action={signOutAction} className="border-t border-border py-1">
          <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
            <LogOut className="size-4" /> Sign out
          </button>
        </form>
      </div>
    </details>
  );

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Logo href="/dashboard" className="shrink-0 text-sm" />
        <span className="hidden h-6 w-px shrink-0 bg-border lg:block" />

        <nav className="dni-scroll hidden flex-1 items-center gap-1 overflow-x-auto lg:flex">
          {items.map((item) => (
            <Link key={item.href} href={item.href} className={pill(isActive(item.href))}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          {activeBusiness && (
            <span className="max-w-[10rem] truncate rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
              {activeBusiness.name}
            </span>
          )}
          {avatarMenu}
        </div>

        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          className="ml-auto rounded-full p-2 hover:bg-muted lg:hidden"
        >
          <Menu className="size-5" />
        </button>
      </div>
    </header>

      {/* Mobile drawer: full nav list + business switcher + account.
          Rendered as a sibling of <header>, not a child — `header` has
          `backdrop-blur`, and `backdrop-filter` establishes a new
          containing block for `position: fixed` descendants, which would
          otherwise clip this to the header's own 64px height instead of
          the viewport. */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <div className="dni-scroll absolute right-0 top-0 h-full w-72 overflow-y-auto border-l border-border bg-background p-4">
            <div className="mb-4 flex items-center justify-between">
              <Logo href="/dashboard" className="text-sm" />
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="rounded-full p-1.5 hover:bg-muted"
              >
                <X className="size-5" />
              </button>
            </div>

            {activeBusiness && (
              <div className="mb-3 rounded-full bg-muted px-3 py-1.5 text-center text-xs font-medium text-muted-foreground">
                {activeBusiness.name}
              </div>
            )}

            <nav className="space-y-1">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-full px-3 py-2 text-sm font-medium transition-colors",
                    isActive(item.href) ? "bg-black text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  {item.label}
                </Link>
              ))}
              <Link
                href="/settings"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded-full px-3 py-2 text-sm font-medium transition-colors",
                  isActive("/settings") ? "bg-black text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <SettingsIcon className="size-4 shrink-0" /> Settings
              </Link>
              {isSuperAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-full px-3 py-2 text-sm font-medium transition-colors",
                    isActive("/admin") ? "bg-black text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Shield className="size-4 shrink-0" /> Super Admin
                </Link>
              )}
            </nav>

            <div className="mt-4 border-t border-border pt-4">
              <div className="flex items-center gap-2 px-1 py-1">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
                  {initials(user.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <form action={signOutAction} className="mt-1">
                <button className="flex w-full items-center gap-2 rounded-full px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                  <LogOut className="size-4" /> Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
