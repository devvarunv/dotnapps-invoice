import { Card } from "@/components/ui/primitives";
import { initials } from "@/lib/utils";
import { computeLiveTotals, liveLineAmount, formatLiveMoney } from "@/lib/billing/live-totals";
import type { EditableLineItem } from "@/components/app/line-item-editor";

/** Parses a plain `YYYY-MM-DD` <input type="date"> value into a display
 * string using local calendar fields only — never round-trips through UTC
 * (see `src/lib/utils.ts`'s own note on that exact class of bug). */
function formatPreviewDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * A live, read-only echo of the document being created/edited — updates
 * as the form changes. This is deliberately a lightweight preview, not a
 * pixel-exact replica of the real PDF (which needs the full business
 * profile — logo, address, bank details — not loaded into this form): the
 * authoritative, exact-match PDF is always available from the real PDF
 * route once the document is saved (spec §10 "web preview and PDF must
 * use the same calculation/data layer" applies to *that* artifact).
 */
export function DocumentPreviewCard({
  kind,
  numberLabel,
  businessName,
  customerName,
  primaryDateLabel,
  primaryDateValue,
  secondaryDateLabel,
  secondaryDateValue,
  items,
  currency,
  notes,
}: {
  kind: "Invoice" | "Quotation";
  numberLabel: string;
  businessName: string;
  customerName?: string;
  primaryDateLabel: string;
  primaryDateValue: string;
  secondaryDateLabel?: string;
  secondaryDateValue?: string | null;
  items: EditableLineItem[];
  currency: string;
  notes?: string;
}) {
  const totals = computeLiveTotals(items);
  const visibleItems = items.filter((i) => i.description.trim() || Number(i.rate) > 0);
  const primaryDate = formatPreviewDate(primaryDateValue);
  const secondaryDate = formatPreviewDate(secondaryDateValue);

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Preview
        </p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          Live
        </span>
      </div>

      <div className="space-y-5 p-5 text-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-lg font-bold tracking-tight">{kind.toUpperCase()}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{numberLabel}</p>
          </div>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {initials(businessName)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 border-y border-border py-3 text-xs">
          <div>
            <p className="text-muted-foreground">Billed by</p>
            <p className="mt-0.5 font-medium">{businessName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Billed to</p>
            <p className="mt-0.5 font-medium">{customerName || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{primaryDateLabel}</p>
            <p className="mt-0.5 font-medium">{primaryDate ?? "—"}</p>
          </div>
          {secondaryDateLabel && (
            <div>
              <p className="text-muted-foreground">{secondaryDateLabel}</p>
              <p className="mt-0.5 font-medium">{secondaryDate ?? "—"}</p>
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {kind === "Invoice" ? "Invoice items" : "Quotation items"}
          </p>
          {visibleItems.length === 0 ? (
            <p className="text-xs text-muted-foreground">No items yet.</p>
          ) : (
            <div className="space-y-1.5">
              {visibleItems.map((item) => (
                <div key={item.key} className="flex items-start justify-between gap-3 text-xs">
                  <span className="min-w-0 flex-1 truncate">
                    {item.description || "Untitled item"}{" "}
                    <span className="text-muted-foreground">× {item.quantity || 0}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {currency} {formatLiveMoney(liveLineAmount(item))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1 border-t border-border pt-3 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Taxable value</span>
            <span className="tabular-nums">{currency} {formatLiveMoney(totals.taxable)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax</span>
            <span className="tabular-nums">{currency} {formatLiveMoney(totals.tax)}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold">
            <span>Grand total</span>
            <span className="tabular-nums">{currency} {formatLiveMoney(totals.grand)}</span>
          </div>
        </div>

        {notes && (
          <div className="border-t border-border pt-3 text-xs">
            <p className="text-muted-foreground">Note</p>
            <p className="mt-0.5 whitespace-pre-wrap">{notes}</p>
          </div>
        )}
      </div>
    </Card>
  );
}
