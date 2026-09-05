import { describe, it, expect } from "vitest";
import { isResetTokenUsable, generateResetToken, hashResetToken } from "@/lib/auth-tokens";

describe("generateResetToken", () => {
  it("hashes the raw token deterministically", () => {
    const { raw, hash } = generateResetToken();
    expect(hashResetToken(raw)).toBe(hash);
  });

  it("never stores the raw token as the hash", () => {
    const { raw, hash } = generateResetToken();
    expect(hash).not.toBe(raw);
  });
});

describe("isResetTokenUsable", () => {
  const now = new Date("2026-01-15T12:00:00Z");

  it("is usable when unused and not yet expired", () => {
    const token = { usedAt: null, expiresAt: new Date("2026-01-15T13:00:00Z") };
    expect(isResetTokenUsable(token, now)).toBe(true);
  });

  it("is not usable once expired", () => {
    const token = { usedAt: null, expiresAt: new Date("2026-01-15T11:59:59Z") };
    expect(isResetTokenUsable(token, now)).toBe(false);
  });

  it("is not usable once already used, even if not expired", () => {
    const token = { usedAt: new Date("2026-01-15T11:00:00Z"), expiresAt: new Date("2026-01-15T13:00:00Z") };
    expect(isResetTokenUsable(token, now)).toBe(false);
  });

  it("treats the exact expiry instant as expired", () => {
    const token = { usedAt: null, expiresAt: now };
    expect(isResetTokenUsable(token, now)).toBe(false);
  });
});
