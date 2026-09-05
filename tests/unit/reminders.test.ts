import { describe, expect, it } from "vitest";
import { isReminderDue, renderReminderTemplate, defaultReminderTemplate } from "@/lib/billing/reminders";

describe("isReminderDue", () => {
  const dueDate = new Date("2026-01-15T00:00:00Z");

  it("BEFORE_DUE_7 fires from 7 days before due date onward", () => {
    expect(isReminderDue("BEFORE_DUE_7", dueDate, new Date("2026-01-08T00:00:00Z"))).toBe(true);
    expect(isReminderDue("BEFORE_DUE_7", dueDate, new Date("2026-01-07T00:00:00Z"))).toBe(false);
  });

  it("ON_DUE_DATE fires on and after the due date, not before", () => {
    expect(isReminderDue("ON_DUE_DATE", dueDate, new Date("2026-01-15T00:00:00Z"))).toBe(true);
    expect(isReminderDue("ON_DUE_DATE", dueDate, new Date("2026-01-14T00:00:00Z"))).toBe(false);
  });

  it("OVERDUE_30 fires only 30 days past due", () => {
    expect(isReminderDue("OVERDUE_30", dueDate, new Date("2026-02-14T00:00:00Z"))).toBe(true);
    expect(isReminderDue("OVERDUE_30", dueDate, new Date("2026-02-13T00:00:00Z"))).toBe(false);
  });
});

describe("renderReminderTemplate", () => {
  it("substitutes every variable", () => {
    const rendered = renderReminderTemplate(defaultReminderTemplate("OVERDUE_3"), {
      customerName: "Rahul",
      invoiceNumber: "INV-1",
      amount: "INR 5000",
      dueDate: "Jan 15, 2026",
      link: "https://example.test/i/abc",
    });
    expect(rendered).toContain("Rahul");
    expect(rendered).toContain("INV-1");
    expect(rendered).toContain("INR 5000");
    expect(rendered).toContain("Jan 15, 2026");
    expect(rendered).toContain("https://example.test/i/abc");
    expect(rendered).not.toContain("{{");
  });
});
