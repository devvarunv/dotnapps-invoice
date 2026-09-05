import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { can, assignableRoles, ROLE_PERMISSIONS } from "@/lib/rbac";

describe("rbac", () => {
  it("owner has every permission", () => {
    const all = new Set(Object.values(ROLE_PERMISSIONS).flat());
    for (const p of all) {
      expect(can(Role.OWNER, p)).toBe(true);
    }
  });

  it("staff only sees the safe default (spec: 'only explicitly granted modules/actions')", () => {
    expect(can(Role.STAFF, "dashboard:view")).toBe(true);
    expect(can(Role.STAFF, "invoices:create")).toBe(false);
    expect(can(Role.STAFF, "business:manage")).toBe(false);
  });

  it("sales can create quotations but not record payments or cancel invoices", () => {
    expect(can(Role.SALES, "quotations:create")).toBe(true);
    expect(can(Role.SALES, "payments:record")).toBe(false);
    expect(can(Role.SALES, "invoices:cancel")).toBe(false);
  });

  it("accountant can record payments and manage expenses but not team/business settings", () => {
    expect(can(Role.ACCOUNTANT, "payments:record")).toBe(true);
    expect(can(Role.ACCOUNTANT, "expenses:create")).toBe(true);
    expect(can(Role.ACCOUNTANT, "business:manage")).toBe(false);
    expect(can(Role.ACCOUNTANT, "members:manage")).toBe(false);
  });

  it("only owner can assign admin, and owner is never assignable", () => {
    expect(assignableRoles(Role.OWNER)).toContain("ADMIN");
    expect(assignableRoles(Role.ADMIN)).not.toContain("ADMIN");
    for (const role of Object.values(Role)) {
      expect(assignableRoles(role)).not.toContain("OWNER");
    }
  });

  it("admin has every permission except billing:manage (owner-only)", () => {
    expect(can(Role.ADMIN, "billing:manage")).toBe(false);
    expect(can(Role.ADMIN, "invoices:cancel")).toBe(true);
    expect(can(Role.ADMIN, "members:manage")).toBe(true);
  });
});
