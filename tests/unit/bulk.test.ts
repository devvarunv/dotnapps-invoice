import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { evaluateBulkItem, type BulkInvoice } from "@/lib/bulk/process";

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

const readyBusiness = {
  addressLine1: "1 Main St",
  city: "Bengaluru",
  state: "Karnataka",
  contactEmail: "hello@biz.test",
  contactPhone: null,
} as any;

const notReadyBusiness = { ...readyBusiness, addressLine1: null } as any;

function makeInvoice(overrides: Partial<BulkInvoice> = {}): BulkInvoice {
  return {
    id: "inv1",
    number: "INV-1",
    status: "SENT",
    grandTotal: D(1000),
    dueDate: new Date("2026-01-01"),
    publicToken: "tok123",
    currency: "INR",
    customer: { name: "Acme", email: "a@test.com", phone: "555-0100" } as any,
    allocations: [],
    ...overrides,
  } as BulkInvoice;
}

describe("evaluateBulkItem", () => {
  it("fails every item when the business profile isn't send-ready", () => {
    const result = evaluateBulkItem(notReadyBusiness, makeInvoice(), "SEND_INVOICE", "EMAIL");
    expect(result.status).toBe("FAILED");
    expect(result.failureReason).toMatch(/business profile/i);
  });

  it("skips a cancelled invoice", () => {
    const result = evaluateBulkItem(readyBusiness, makeInvoice({ status: "CANCELLED" }), "SEND_INVOICE", "EMAIL");
    expect(result.status).toBe("SKIPPED");
  });

  it("skips a reminder for a draft invoice (never sent)", () => {
    const result = evaluateBulkItem(readyBusiness, makeInvoice({ status: "DRAFT" }), "SEND_REMINDER", "EMAIL");
    expect(result.status).toBe("SKIPPED");
    expect(result.failureReason).toMatch(/hasn't been sent/i);
  });

  it("allows sending an invoice notice for a still-draft invoice", () => {
    const result = evaluateBulkItem(readyBusiness, makeInvoice({ status: "DRAFT" }), "SEND_INVOICE", "EMAIL");
    expect(result.status).toBe("SENT");
  });

  it("skips a reminder for a fully paid invoice", () => {
    const result = evaluateBulkItem(
      readyBusiness,
      makeInvoice({ allocations: [{ amount: D(1000), payment: { status: "ACTIVE" } }] as any }),
      "SEND_REMINDER",
      "EMAIL",
    );
    expect(result.status).toBe("SKIPPED");
    expect(result.failureReason).toMatch(/already paid/i);
  });

  it("skips when the customer has no contact for the chosen channel", () => {
    const result = evaluateBulkItem(
      readyBusiness,
      makeInvoice({ customer: { name: "Acme", email: null, phone: null } as any }),
      "SEND_INVOICE",
      "EMAIL",
    );
    expect(result.status).toBe("SKIPPED");
    expect(result.failureReason).toMatch(/no email/i);
  });

  it("renders a message with the outstanding balance, not the grand total, when partially paid", () => {
    const result = evaluateBulkItem(
      readyBusiness,
      makeInvoice({ allocations: [{ amount: D(400), payment: { status: "ACTIVE" } }] as any }),
      "SEND_REMINDER",
      "EMAIL",
    );
    expect(result.status).toBe("SENT");
    expect(result.message).toContain("INR 600");
  });

  it("ignores reversed payments when deciding whether an invoice is already paid", () => {
    const result = evaluateBulkItem(
      readyBusiness,
      makeInvoice({ allocations: [{ amount: D(1000), payment: { status: "REVERSED" } }] as any }),
      "SEND_REMINDER",
      "EMAIL",
    );
    expect(result.status).toBe("SENT");
  });
});
