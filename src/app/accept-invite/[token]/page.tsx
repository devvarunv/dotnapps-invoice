import Link from "next/link";
import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/context";
import { prisma } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/rbac";
import { Logo } from "@/components/brand";
import { buttonClassName } from "@/components/ui/button";
import { AcceptInviteButton } from "@/app/onboarding/accept-invite-button";

export const metadata: Metadata = { title: "Team invitation" };

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [invite, user] = await Promise.all([
    prisma.invite.findUnique({ where: { token }, include: { business: true, invitedBy: true } }),
    getCurrentUser(),
  ]);

  const nextPath = `/accept-invite/${token}`;

  const invalid =
    !invite ||
    invite.status !== "PENDING" ||
    invite.expiresAt < new Date();

  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <header className="mx-auto flex h-14 w-full max-w-md items-center px-4">
        <Logo />
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          {invalid ? (
            <>
              <h1 className="text-lg font-semibold">Invitation unavailable</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                This invitation link is invalid, has already been used, or has
                expired. Ask an administrator of the business to send a new one.
              </p>
              <Link
                href="/login"
                className={buttonClassName({ variant: "outline", className: "mt-4" })}
              >
                Go to login
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold">
                Join {invite!.business.name}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {invite!.invitedBy.name} invited{" "}
                <span className="font-medium text-foreground">{invite!.email}</span>{" "}
                to join as {ROLE_LABELS[invite!.role]}.
              </p>
              {user ? (
                <div className="mt-4 flex justify-end">
                  <AcceptInviteButton token={token} />
                </div>
              ) : (
                <div className="mt-4 flex justify-end gap-2">
                  <Link
                    href={`/login?callbackUrl=${encodeURIComponent(nextPath)}`}
                    className={buttonClassName({ variant: "outline" })}
                  >
                    Log in
                  </Link>
                  <Link
                    href={`/signup?next=${encodeURIComponent(nextPath)}`}
                    className={buttonClassName()}
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
