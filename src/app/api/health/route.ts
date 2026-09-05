import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { logError } from "@/lib/logger";

/**
 * Spec §28 "health checks" — for uptime monitors/load balancers/orchestrators.
 * Deliberately unauthenticated (it must be reachable before anyone has a
 * session) and reveals nothing about the app beyond "the database is
 * reachable".
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      database: "ok",
      latencyMs: Date.now() - startedAt,
      time: new Date().toISOString(),
    });
  } catch (error) {
    logError("health check: database unreachable", error);
    return NextResponse.json(
      { status: "error", database: "unreachable", time: new Date().toISOString() },
      { status: 503 },
    );
  }
}
