import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Turn a business name into a URL-safe slug. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a `Date` as `YYYY-MM-DD` from its *local* calendar fields, for
 * `<input type="date">`. Deliberately not `.toISOString().slice(0, 10)` —
 * that converts to UTC first, which silently rolls the date back a day
 * for anyone west of UTC in the evening (e.g. 8pm PST on the 5th is
 * already the 6th in UTC). Used both client-side (viewer's local time)
 * and in Server Components (the server's local time) — this app has no
 * per-user timezone preference, so "local to whoever is asking" is the
 * only notion of "today" it has.
 */
export function toLocalDateInput(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayDateInputValue(): string {
  return toLocalDateInput(new Date());
}
