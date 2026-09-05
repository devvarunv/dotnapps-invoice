"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/context";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { createBusinessSchema } from "@/lib/validation";
import { fieldErrors, formValue, type ActionState } from "@/lib/form";
import { slugify } from "@/lib/utils";
import { ensureDefaultReminderRules } from "@/lib/billing/reminder-rules";
import { ensureDefaultExpenseCategories } from "@/lib/finance/expense-categories";
import { getSubscription } from "@/lib/billing/entitlements";
import { setActiveBusiness } from "@/app/(app)/actions";

export async function createBusinessAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = createBusinessSchema.safeParse({
    name: formValue(formData, "name"),
  });
  if (!parsed.success) {
    return { error: "Check the fields below.", fieldErrors: fieldErrors(parsed.error) };
  }

  const name = parsed.data.name;
  const base = slugify(name) || "business";
  let slug = base;
  for (let i = 2; await prisma.business.findUnique({ where: { slug } }); i++) {
    slug = `${base}-${i}`;
  }

  const business = await prisma.$transaction(async (tx) => {
    const created = await tx.business.create({
      data: { name, slug, createdById: user.id },
    });
    await tx.membership.create({
      data: { userId: user.id, businessId: created.id, role: "OWNER" },
    });
    return created;
  });

  await recordAudit({
    action: "business.create",
    businessId: business.id,
    actorId: user.id,
    targetType: "Business",
    targetId: business.id,
    metadata: { name, slug },
  });

  await ensureDefaultReminderRules(business.id);
  await ensureDefaultExpenseCategories(business.id);
  await getSubscription(business.id); // starts the 14-day trial immediately

  await setActiveBusiness(business.id);
  redirect("/dashboard");
}

/**
 * Accept a pending invite that was addressed to the signed-in user's email.
 * Shared by the onboarding screen and the /accept-invite/[token] page.
 */
export async function acceptInviteAction(token: string): Promise<ActionState> {
  const user = await requireUser();

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { business: true },
  });

  if (!invite || invite.status !== "PENDING") {
    return { error: "This invite is no longer valid." };
  }
  if (invite.expiresAt < new Date()) {
    await prisma.invite.update({
      where: { id: invite.id },
      data: { status: "EXPIRED" },
    });
    return { error: "This invite has expired. Ask an admin to send a new one." };
  }
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    return {
      error: `This invite was sent to ${invite.email}. Log in with that email to accept it.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.membership.upsert({
      where: { userId_businessId: { userId: user.id, businessId: invite.businessId } },
      create: { userId: user.id, businessId: invite.businessId, role: invite.role },
      update: { status: "ACTIVE" },
    });
    await tx.invite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
  });

  await recordAudit({
    action: "member.invite.accept",
    businessId: invite.businessId,
    actorId: user.id,
    targetType: "User",
    targetId: user.id,
    metadata: { role: invite.role },
  });

  await setActiveBusiness(invite.businessId);
  redirect("/dashboard");
}

export async function acceptInviteFormAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return acceptInviteAction(formValue(formData, "token"));
}
