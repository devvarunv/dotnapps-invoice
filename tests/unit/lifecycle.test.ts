import { describe, expect, it } from "vitest";
import { computeLifecycleTransition, type LifecycleInput } from "@/lib/billing/lifecycle";

const NOW = new Date("2026-06-15T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const daysFromNow = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

const base: LifecycleInput = {
  status: "TRIALING",
  trialEndsAt: null,
  currentPeriodEnd: null,
  graceEndsAt: null,
};

describe("computeLifecycleTransition", () => {
  it("leaves an active trial alone", () => {
    const result = computeLifecycleTransition({ ...base, trialEndsAt: daysFromNow(3) }, NOW);
    expect(result).toBeNull();
  });

  it("moves an expired trial into GRACE, never straight to SUSPENDED", () => {
    const result = computeLifecycleTransition({ ...base, trialEndsAt: daysAgo(1) }, NOW);
    expect(result?.nextStatus).toBe("GRACE");
    expect(result?.graceEndsAt).toBeInstanceOf(Date);
  });

  it("leaves an active subscription within its period alone", () => {
    const result = computeLifecycleTransition({ ...base, status: "ACTIVE", currentPeriodEnd: daysFromNow(10) }, NOW);
    expect(result).toBeNull();
  });

  it("moves an expired active period to PAST_DUE, not straight to GRACE", () => {
    const result = computeLifecycleTransition({ ...base, status: "ACTIVE", currentPeriodEnd: daysAgo(1) }, NOW);
    expect(result?.nextStatus).toBe("PAST_DUE");
  });

  it("keeps PAST_DUE for a few days before escalating to GRACE", () => {
    const justPastDue = computeLifecycleTransition({ ...base, status: "PAST_DUE", currentPeriodEnd: daysAgo(1) }, NOW);
    expect(justPastDue).toBeNull();

    const longPastDue = computeLifecycleTransition({ ...base, status: "PAST_DUE", currentPeriodEnd: daysAgo(5) }, NOW);
    expect(longPastDue?.nextStatus).toBe("GRACE");
  });

  it("suspends once the grace period has elapsed, not before", () => {
    const stillInGrace = computeLifecycleTransition({ ...base, status: "GRACE", graceEndsAt: daysFromNow(1) }, NOW);
    expect(stillInGrace).toBeNull();

    const graceOver = computeLifecycleTransition({ ...base, status: "GRACE", graceEndsAt: daysAgo(1) }, NOW);
    expect(graceOver?.nextStatus).toBe("SUSPENDED");
    expect(graceOver?.suspendedAt).toBeInstanceOf(Date);
  });

  it("never auto-transitions SUSPENDED or CANCELED — those need a human", () => {
    expect(computeLifecycleTransition({ ...base, status: "SUSPENDED" }, NOW)).toBeNull();
    expect(computeLifecycleTransition({ ...base, status: "CANCELED" }, NOW)).toBeNull();
  });
});
