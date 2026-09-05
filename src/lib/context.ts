import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Business, Membership, Role, User } from "@prisma/client";

import { auth } from "./auth";
import { prisma } from "./db";
import { can, PermissionError, type Permission } from "./rbac";

export const ACTIVE_BUSINESS_COOKIE = "dni_active_business";

type MembershipWithBusiness = Membership & { business: Business };

export type AuthContext = {
  user: User;
  memberships: MembershipWithBusiness[];
  activeBusiness: Business | null;
  membership: MembershipWithBusiness | null;
  role: Role | null;
};

export type BusinessContext = {
  user: User;
  memberships: MembershipWithBusiness[];
  business: Business;
  membership: MembershipWithBusiness;
  role: Role;
};

/**
 * Resolve the signed-in user and their active business from the session
 * cookie + database. Role and membership are always read fresh so permission
 * changes take effect immediately (the JWT is not trusted for authorization).
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return null;

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id, status: "ACTIVE" },
    include: { business: true },
    orderBy: { createdAt: "asc" },
  });

  if (memberships.length === 0) {
    return { user, memberships, activeBusiness: null, membership: null, role: null };
  }

  const cookieStore = await cookies();
  const wantedBusinessId = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value;
  const membership =
    memberships.find((m) => m.businessId === wantedBusinessId) ?? memberships[0];

  return {
    user,
    memberships,
    activeBusiness: membership.business,
    membership,
    role: membership.role,
  };
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: session.user.id } });
}

/** Page guard: send unauthenticated users to login. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Page guard: require an authenticated user with a resolved active business.
 * Users with no membership are sent to onboarding.
 */
export async function requireBusinessContext(): Promise<BusinessContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctx.membership || !ctx.activeBusiness || !ctx.role) {
    // Platform staff without a business of their own belong in the admin area.
    redirect(ctx.user.isSuperAdmin ? "/admin" : "/onboarding");
  }

  return {
    user: ctx.user,
    memberships: ctx.memberships,
    business: ctx.activeBusiness,
    membership: ctx.membership,
    role: ctx.role,
  };
}

/**
 * Server-action / server-component guard. Throws PermissionError when the
 * active role lacks the permission — callers surface this as a denied state
 * or a failed action result rather than leaking data.
 */
export async function requirePermission(
  permission: Permission,
): Promise<BusinessContext> {
  const ctx = await requireBusinessContext();
  if (!can(ctx.role, permission)) throw new PermissionError(permission);
  return ctx;
}

export type PermissionCheck =
  | { ok: true; ctx: BusinessContext }
  | { ok: false; ctx: BusinessContext };

/**
 * Non-throwing permission check for pages that want to render a
 * "permission denied" state instead of an error boundary.
 */
export async function checkPermission(
  permission: Permission,
): Promise<PermissionCheck> {
  const ctx = await requireBusinessContext();
  return { ok: can(ctx.role, permission), ctx };
}

export async function requireSuperAdmin(): Promise<User> {
  const user = await requireUser();
  if (!user.isSuperAdmin) redirect("/dashboard");
  return user;
}
