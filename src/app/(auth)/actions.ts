"use server";

import { AuthError } from "next-auth";

import { isRedirectError } from "@/lib/next";
import { signIn, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { loginSchema, signupSchema, requestPasswordResetSchema, resetPasswordSchema } from "@/lib/validation";
import { fieldErrors, formValue, type ActionState } from "@/lib/form";
import { rateLimit, clientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { generateResetToken, hashResetToken, isResetTokenUsable } from "@/lib/auth-tokens";

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
  });
  if (!parsed.success) {
    return { error: "Check the fields below.", fieldErrors: fieldErrors(parsed.error) };
  }

  const ip = await clientIp();
  const rl = rateLimit(`login:${ip}:${parsed.data.email}`, RATE_LIMITS.login.limit, RATE_LIMITS.login.windowMs);
  if (!rl.allowed) {
    return { error: `Too many attempts. Try again in ${Math.ceil(rl.retryAfterSeconds / 60)} minute(s).` };
  }

  const callbackUrl = formValue(formData, "callbackUrl") || "/dashboard";

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: callbackUrl.startsWith("/") ? callbackUrl : "/dashboard",
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    throw error;
  }
  return {};
}

export async function signupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    name: formValue(formData, "name"),
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
    confirmPassword: formValue(formData, "confirmPassword"),
  });
  if (!parsed.success) {
    return { error: "Check the fields below.", fieldErrors: fieldErrors(parsed.error) };
  }

  const ip = await clientIp();
  const rl = rateLimit(`signup:${ip}`, RATE_LIMITS.signup.limit, RATE_LIMITS.signup.windowMs);
  if (!rl.allowed) {
    return { error: `Too many accounts created from this network. Try again in ${Math.ceil(rl.retryAfterSeconds / 60)} minute(s).` };
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return {
      error: "An account with that email already exists.",
      fieldErrors: { email: "Already registered — try logging in." },
    };
  }

  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password) },
  });

  await recordAudit({
    action: "auth.register",
    actorId: user.id,
    targetType: "User",
    targetId: user.id,
    metadata: { email },
  });

  const next = formValue(formData, "next");
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: next.startsWith("/") ? next : "/onboarding",
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof AuthError) {
      // Account was created; ask them to log in manually.
      return { error: "Account created. Please log in." };
    }
    throw error;
  }
  return {};
}

function resetUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/reset-password/${token}`;
}

/**
 * Spec §4 "password reset". No email provider is configured anywhere in
 * this app (same gap as messaging/reminders), so — same honesty rule as
 * team invites — the generated link is shown directly on this same screen
 * rather than pretending an email went out. Always returns the same
 * generic success message regardless of whether the account exists, so the
 * form itself can't be used to enumerate registered emails; only an
 * existing account gets a real link back in `data`.
 */
export async function requestPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = requestPasswordResetSchema.safeParse({
    email: formValue(formData, "email"),
  });
  if (!parsed.success) {
    return { error: "Check the fields below.", fieldErrors: fieldErrors(parsed.error) };
  }

  const ip = await clientIp();
  const rl = rateLimit(
    `pwreset:${ip}:${parsed.data.email}`,
    RATE_LIMITS.passwordReset.limit,
    RATE_LIMITS.passwordReset.windowMs,
  );
  if (!rl.allowed) {
    return { error: `Too many attempts. Try again in ${Math.ceil(rl.retryAfterSeconds / 60)} minute(s).` };
  }

  const genericMessage =
    "If an account exists for that email, a reset link has been generated below.";

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) {
    return { ok: true, message: genericMessage };
  }

  const { raw, hash, expiresAt } = generateResetToken();
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hash, expiresAt },
  });
  await recordAudit({
    action: "auth.password_reset.request",
    actorId: user.id,
    targetType: "User",
    targetId: user.id,
  });

  return { ok: true, message: genericMessage, data: { resetUrl: resetUrl(raw) } };
}

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formValue(formData, "token"),
    newPassword: formValue(formData, "newPassword"),
    confirmPassword: formValue(formData, "confirmPassword"),
  });
  if (!parsed.success) {
    return { error: "Check the fields below.", fieldErrors: fieldErrors(parsed.error) };
  }

  const ip = await clientIp();
  const rl = rateLimit(`pwreset-confirm:${ip}`, RATE_LIMITS.passwordReset.limit, RATE_LIMITS.passwordReset.windowMs);
  if (!rl.allowed) {
    return { error: `Too many attempts. Try again in ${Math.ceil(rl.retryAfterSeconds / 60)} minute(s).` };
  }

  const tokenHash = hashResetToken(parsed.data.token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || !isResetTokenUsable(record, new Date())) {
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(parsed.data.newPassword) },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  await recordAudit({
    action: "auth.password_reset.complete",
    actorId: record.userId,
    targetType: "User",
    targetId: record.userId,
  });

  return { ok: true, message: "Password updated. You can now log in." };
}
