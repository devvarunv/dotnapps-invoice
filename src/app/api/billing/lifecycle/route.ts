import { NextResponse } from "next/server";

import { runLifecycleForAllSubscriptions } from "@/lib/billing/lifecycle";
import { rateLimit, clientIp, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Cron entry point for subscription lifecycle transitions (spec §19). Not
 * called by the app itself — an external scheduler (e.g. a platform cron
 * job) is expected to POST here periodically with the shared secret,
 * mirroring dotnapps-crm's `/api/automation/run` endpoint.
 */
export async function POST(req: Request) {
  const ip = await clientIp();
  const rl = rateLimit(`cron:${ip}`, RATE_LIMITS.cron.limit, RATE_LIMITS.cron.windowMs);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const auth = req.headers.get("authorization");
  const secret = process.env.AUTOMATION_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const changed = await runLifecycleForAllSubscriptions();
  return NextResponse.json({ ok: true, changed });
}
