"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ACTIVE_BUSINESS_COOKIE, getAuthContext } from "@/lib/context";

/** Set the active-business cookie (server-action / route-handler only). */
export async function setActiveBusiness(businessId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BUSINESS_COOKIE, businessId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function switchBusinessAction(formData: FormData): Promise<void> {
  const businessId = String(formData.get("businessId") ?? "");
  const session = await auth();
  if (!session?.user?.id || !businessId) return;

  // Only switch to a business the user is actually an active member of.
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id, businessId, status: "ACTIVE" },
  });
  if (!membership) return;

  await setActiveBusiness(businessId);
  redirect("/dashboard");
}

export async function signOutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_BUSINESS_COOKIE);
  await signOut({ redirectTo: "/login" });
}

/** Used by settings pages to re-check the caller still belongs to the business. */
export async function assertStillMember(): Promise<void> {
  const ctx = await getAuthContext();
  if (!ctx?.membership) redirect("/onboarding");
}
