import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FileText,
  ReceiptText,
  Users,
  Package,
  CreditCard,
  Wallet,
  BarChart3,
  BellRing,
  Settings,
} from "lucide-react";

import type { Permission } from "./rbac";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
  /** Build order phase (spec §29) this module ships in. */
  phase: 1 | 2 | 3 | 4 | 5 | 6;
};

/** Highest build-order phase that has shipped — drives the sidebar's
 * "Soon" badge (`item.phase > CURRENT_PHASE`). Bump this as later phases
 * land; do not change past NavItem `phase` values to match. */
export const CURRENT_PHASE = 5;

export type NavGroup = {
  label: string | null;
  items: NavItem[];
};

// Primary navigation per product spec §2:
// Dashboard → Quotations → Invoices → Customers → Products & Services →
// Payments → Expenses → Reports → Reminders → Settings
export const NAV: NavGroup[] = [
  {
    label: null,
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard:view", phase: 1 },
    ],
  },
  {
    label: "Billing",
    items: [
      { label: "Quotations", href: "/quotations", icon: FileText, permission: "quotations:view", phase: 2 },
      { label: "Invoices", href: "/invoices", icon: ReceiptText, permission: "invoices:view", phase: 2 },
      { label: "Customers", href: "/customers", icon: Users, permission: "customers:view", phase: 2 },
      { label: "Products & Services", href: "/products-services", icon: Package, permission: "products:view", phase: 2 },
    ],
  },
  {
    label: "Money",
    items: [
      { label: "Payments", href: "/payments", icon: CreditCard, permission: "payments:view", phase: 3 },
      { label: "Expenses", href: "/expenses", icon: Wallet, permission: "expenses:view", phase: 5 },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Reports", href: "/reports", icon: BarChart3, permission: "reports:view", phase: 5 },
      { label: "Reminders", href: "/reminders", icon: BellRing, permission: "reminders:view", phase: 3 },
    ],
  },
  {
    label: null,
    items: [
      { label: "Settings", href: "/settings", icon: Settings, permission: "business:view", phase: 1 },
    ],
  },
];

/** Flat list of module pages that render the "planned" placeholder. */
export const PLACEHOLDER_MODULES = NAV.flatMap((g) => g.items).filter(
  (i) => i.phase > CURRENT_PHASE,
);
