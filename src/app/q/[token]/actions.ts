"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { formValue, type ActionState } from "@/lib/form";

/**
 * Customer-facing portal actions (spec §17). No auth — the unguessable
 * `publicToken` is the access control, matching a document's public share
 * link. Every mutation is scoped to a specific token + expected prior
 * status so a stale tab can't double-submit or resurrect an expired quote.
 */
export async function respondToQuotationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = formValue(formData, "token");
  const decision = formValue(formData, "decision");
  if (decision !== "ACCEPTED" && decision !== "REJECTED") {
    return { error: "Invalid request." };
  }

  const quotation = await prisma.quotation.findUnique({ where: { publicToken: token } });
  if (!quotation) return { error: "This quotation link is invalid." };
  if (quotation.status !== "SENT" && quotation.status !== "VIEWED") {
    return { error: "This quotation has already been responded to, or can no longer be actioned." };
  }
  if (quotation.validUntil && quotation.validUntil < new Date()) {
    return { error: "This quotation has expired. Ask the sender for a new one." };
  }

  await prisma.quotation.update({
    where: { id: quotation.id },
    data: { status: decision, respondedAt: new Date() },
  });
  await recordAudit({
    action: decision === "ACCEPTED" ? "quotation.accept" : "quotation.reject",
    businessId: quotation.businessId,
    targetType: "Quotation",
    targetId: quotation.id,
  });

  revalidatePath(`/q/${token}`);
  return {
    ok: true,
    message: decision === "ACCEPTED" ? "Thanks! The quotation has been accepted." : "The quotation has been declined.",
  };
}
