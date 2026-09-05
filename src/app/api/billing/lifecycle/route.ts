import { NextResponse } from "next/server";

import { runLifecycleForAllSubscriptions } from "@/lib/billing/lifecycle";
import { rateLimit, clientIp, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Cron entry point for subscription lifecycle transitions (spec §19). Two
 * ways to trigger it:
 *   - POST  Authorization: Bearer $AUTOMATION_SECRET  (any external
 *     scheduler)
 *   - GET   (Vercel Cron — see vercel.json). Vercel automatically sends
 *     `Authorization: Bearer $CRON_SECRET` on requests it triggers, so this
 *     only fires for genuine Vercel Cron invocations.
 * Mirrors dotnapps-crm's `/api/automation/run`/`/api/billing/lifecycle`.
 */
export async function POST(req: Request) {
  return handle(req, process.env.AUTOMATION_SECRET, "AUTOMATION_SECRET");
}

export async function GET(req: Request) {
  return handle(req, process.env.CRON_SECRET, "CRON_SECRET");
}

async function handle(req: Request, secret: string | undefined, secretName: string) {
  const ip = await clientIp();
  const rl = rateLimit(`cron:${ip}`, RATE_LIMITS.cron.limit, RATE_LIMITS.cron.windowMs);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (!secret) {
    return NextResponse.json({ error: `${secretName} is not set` }, { status: 500 });
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const changed = await runLifecycleForAllSubscriptions();
  return NextResponse.json({ ok: true, changed });
}
