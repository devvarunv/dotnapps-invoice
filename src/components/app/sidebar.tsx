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
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
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
                    "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-white font-medium text-black"
                      : "text-white/70 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.phase > CURRENT_PHASE && (
                    <span className="rounded bg-white/15 px-1 text-[10px] font-medium text-white/60">
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
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
            Platform
          </p>
          <Link
            href="/admin"
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
              pathname.startsWith("/admin")
                ? "bg-white font-medium text-black"
                : "text-white/70 hover:bg-white/10 hover:text-white",
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
    <div className="border-b border-white/10 p-3">
      <details className="group relative">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-white/15 bg-white/5 px-2.5 py-2 text-sm text-white hover:bg-white/10">
          <span className="grid size-6 shrink-0 place-items-center rounded bg-white text-[11px] font-bold text-black">
            {initials(activeBusiness?.name ?? "?")}
          </span>
          <span className="flex-1 truncate text-left font-medium">
            {activeBusiness?.name ?? "Select business"}
          </span>
          <ChevronsUpDown className="size-4 text-white/50" />
        </summary>
        <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
          {businesses.map((b) => (
            <form key={b.id} action={switchBusinessAction}>
              <input type="hidden" name="businessId" value={b.id} />
              <button
                type="submit"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
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
            className="block border-t border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            + Create business
          </Link>
        </div>
      </details>
    </div>
  );

  const userBox = (
    <div className="border-t border-white/10 p-3">
      <div className="flex items-center gap-2 px-1 py-1">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-semibold text-white">
          {initials(user.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{user.name}</p>
          <p className="truncate text-xs text-white/50">{user.email}</p>
        </div>
      </div>
      <form action={signOutAction} className="mt-1">
        <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-white/70 hover:bg-white/10 hover:text-white">
          <LogOut className="size-4" />
          Sign out
        </button>
      </form>
    </div>
  );

  const panel = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-4">
        <Logo href="/dashboard" className="text-sm" tone="inverted" />
      </div>
      {businessSwitcher}
      {nav}
      {userBox}
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex h-14 items-center gap-3 border-b border-white/10 bg-black px-4 lg:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="rounded-md p-1.5 text-white hover:bg-white/10"
        >
          <Menu className="size-5" />
        </button>
        <Logo href="/dashboard" className="text-sm" tone="inverted" />
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 border-r border-white/10 bg-black">
            <button
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
              className="absolute right-3 top-4 rounded-md p-1 text-white hover:bg-white/10"
            >
              <X className="size-5" />
            </button>
            {panel}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-black lg:block">
        <div className="sticky top-0 h-dvh">{panel}</div>
      </aside>
    </>
  );
}
