import type { Metadata } from "next";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        This link is valid for one hour and can only be used once.
      </p>

      <div className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <ResetPasswordForm token={token} />
      </div>
    </div>
  );
}
