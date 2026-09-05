import { Role } from "@prisma/client";

/**
 * Permission catalogue.
 *
 * Phase 1 enforces the business / members / settings / audit permissions.
 * The billing-module permissions are declared now so navigation and later
 * phases can consume a single, stable vocabulary. Format: "<domain>:<action>".
 */
export const PERMISSIONS = [
  // Business & settings
  "business:view",
  "business:manage", // rename business, numbering, GST/tax defaults, templates
  "members:view",
  "members:invite",
  "members:manage", // change role, suspend, remove
  "settings:manage",
  "billing:manage",
  "integration:manage",
  "audit:view",
  "export:data",

  // Core billing (wired up in later phases)
  "dashboard:view",
  "customers:view",
  "customers:create",
  "customers:edit",
  "customers:delete",
  "products:view",
  "products:create",
  "products:edit",
  "products:delete",
  "quotations:view",
  "quotations:create",
  "quotations:edit",
  "quotations:send",
  "invoices:view",
  "invoices:create",
  "invoices:edit",
  "invoices:send",
  "invoices:cancel",
  "payments:view",
  "payments:record",
  "expenses:view",
  "expenses:create",
  "expenses:edit",
  "reports:view",
  "reminders:view",
  "reminders:manage",
  "bulk:send",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL: Permission[] = [...PERMISSIONS];

// Admin: "Operational management and reports" (spec §3) — everything except
// billing/business ownership actions that stay OWNER-only in application code
// (e.g. deleting the business, transferring ownership).
const ADMIN: Permission[] = ALL.filter((p) => p !== "billing:manage");

// Accountant: "Invoices, quotations, payments, expenses, reports" (spec §3).
const ACCOUNTANT: Permission[] = [
  "business:view",
  "members:view",
  "dashboard:view",
  "customers:view",
  "products:view",
  "quotations:view",
  "quotations:create",
  "quotations:edit",
  "quotations:send",
  "invoices:view",
  "invoices:create",
  "invoices:edit",
  "invoices:send",
  "invoices:cancel",
  "payments:view",
  "payments:record",
  "expenses:view",
  "expenses:create",
  "expenses:edit",
  "reports:view",
  "reminders:view",
  "reminders:manage",
  "bulk:send",
  "export:data",
];

// Sales: "Customers, quotations, products; restricted financial actions"
// (spec §3) — no payments/expenses/invoice-cancel.
const SALES: Permission[] = [
  "business:view",
  "members:view",
  "dashboard:view",
  "customers:view",
  "customers:create",
  "customers:edit",
  "products:view",
  "quotations:view",
  "quotations:create",
  "quotations:edit",
  "quotations:send",
  "invoices:view",
  "invoices:create",
  "payments:view",
  "reports:view",
  "reminders:view",
  "bulk:send",
];

// Staff: "Only explicitly granted modules/actions" (spec §3). V1 ships the
// safe default (view-only dashboard); per-user granular grants are future
// work — see README "Notes / next steps".
const STAFF: Permission[] = ["business:view", "dashboard:view"];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // OWNER has every permission, including billing/business ownership actions.
  // Ownership transfer and business deletion are OWNER-only checks handled
  // explicitly where they are implemented, not via this matrix.
  OWNER: ALL,
  ADMIN,
  ACCOUNTANT,
  SALES,
  STAFF,
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function canAny(role: Role, permissions: Permission[]): boolean {
  return permissions.some((p) => can(role, p));
}

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  ACCOUNTANT: "Accountant",
  SALES: "Sales",
  STAFF: "Staff",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  OWNER: "Full access: billing, business settings, team, integrations.",
  ADMIN: "Operational management and reports.",
  ACCOUNTANT: "Invoices, quotations, payments, expenses and reports.",
  SALES: "Customers, quotations and products; restricted financial actions.",
  STAFF: "Only explicitly granted modules/actions.",
};

/** Roles that a given role is allowed to assign to others. */
export function assignableRoles(role: Role): Role[] {
  switch (role) {
    case "OWNER":
      return ["ADMIN", "ACCOUNTANT", "SALES", "STAFF"];
    case "ADMIN":
      return ["ACCOUNTANT", "SALES", "STAFF"];
    default:
      return [];
  }
}

export class PermissionError extends Error {
  constructor(permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = "PermissionError";
  }
}
