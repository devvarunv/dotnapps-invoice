"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronsUpDown, LogOut, Shield, Check } from "lucide-react";
import type { Role } from "@prisma/client";

import { cn, initials } from "@/lib/utils";
import { NAV, CURRENT_PHASE } from "@/lib/nav";
import { can, ROLE_LABELS } from "@/lib/rbac";
import { Logo } from "@/components/brand";
import { switchBusinessAction, signOutAction } from "@/app/(app)/actions";

export type SidebarBusiness = { id: string; name: string; role: Role };
export type SidebarUser = { name: string; email: string };

export function Sidebar({
  role,
  activeBusinessId,
  businesses,
  user,
  isSuperAdmin,
}: {
  role: Role;
  activeBusinessId: string;
  businesses: SidebarBusiness[];
  user: SidebarUser;
  isSuperAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const activeBusiness = businesses.find((b) => b.id === activeBusinessId);

  const nav = (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4 dni-scroll">
      {NAV.map((group, gi) => {
        const items = group.items.filter((i) => can(role, i.permission));
        if (items.length === 0) return null;
        return (
          <div key={gi} className="space-y-1">
            {group.label && (
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
            )}
            {items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-primary/12 font-medium text-primary"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.phase > CURRENT_PHASE && (
                    <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                      Soon
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}

      {isSuperAdmin && (
        <div className="space-y-1">
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Platform
          </p>
          <Link
            href="/admin"
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
              pathname.startsWith("/admin")
                ? "bg-primary/12 font-medium text-primary"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            )}
          >
            <Shield className="size-4 shrink-0" />
            Super Admin
          </Link>
        </div>
      )}
    </nav>
  );

  const businessSwitcher = (
    <div className="border-b border-border/60 p-3">
      <details className="group relative">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-border/60 bg-background/60 px-2.5 py-2 text-sm hover:bg-muted">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
            {initials(activeBusiness?.name ?? "?")}
          </span>
          <span className="flex-1 truncate text-left font-medium">
            {activeBusiness?.name ?? "Select business"}
          </span>
          <ChevronsUpDown className="size-4 text-muted-foreground" />
        </summary>
        <div className="absolute left-0 right-0 z-20 mt-1.5 overflow-hidden rounded-xl border border-border/60 bg-popover shadow-lg">
          {businesses.map((b) => (
            <form key={b.id} action={switchBusinessAction}>
              <input type="hidden" name="businessId" value={b.id} />
              <button
                type="submit"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted"
              >
                <span className="flex-1 truncate">{b.name}</span>
                <span className="text-xs text-muted-foreground">
                  {ROLE_LABELS[b.role]}
                </span>
                {b.id === activeBusinessId && <Check className="size-4 text-primary" />}
              </button>
            </form>
          ))}
          <Link
            href="/onboarding"
            className="block border-t border-border/60 px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            + Create business
          </Link>
        </div>
      </details>
    </div>
  );

  const userBox = (
    <div className="border-t border-border/60 p-3">
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
        <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
          <LogOut className="size-4" />
          Sign out
        </button>
      </form>
    </div>
  );

  const panel = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-4">
        <Logo href="/dashboard" className="text-sm" />
      </div>
      {businessSwitcher}
      {nav}
      {userBox}
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="dni-glass sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 px-4 lg:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="rounded-full p-1.5 hover:bg-muted"
        >
          <Menu className="size-5" />
        </button>
        <Logo href="/dashboard" className="text-sm" />
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="dni-glass absolute left-0 top-0 h-full w-72 border-r border-border/60">
            <button
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
              className="absolute right-3 top-4 rounded-full p-1 hover:bg-muted"
            >
              <X className="size-5" />
            </button>
            {panel}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="dni-glass hidden w-64 shrink-0 border-r border-border/60 lg:block">
        <div className="sticky top-0 h-dvh">{panel}</div>
      </aside>
    </>
  );
}
