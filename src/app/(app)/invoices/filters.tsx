import Link from "next/link";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type InvoiceFilters = {
  status?: string;
  customerId?: string;
  from?: string;
  to?: string;
  dueFrom?: string;
  dueTo?: string;
  minAmount?: string;
  maxAmount?: string;
  q?: string;
};

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "SENT", label: "Sent" },
  { value: "VIEWED", label: "Viewed" },
  { value: "PARTIALLY_PAID", label: "Partially paid" },
  { value: "PAID", label: "Paid" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function InvoiceFiltersForm({
  filters,
  customers,
}: {
  filters: InvoiceFilters;
  customers: { id: string; name: string }[];
}) {
  return (
    <form method="get" className="mb-4 grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-3 lg:grid-cols-6">
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Status</label>
        <Select name="status" defaultValue={filters.status ?? ""}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Customer</label>
        <Select name="customerId" defaultValue={filters.customerId ?? ""}>
          <option value="">All customers</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Invoice #</label>
        <Input name="q" defaultValue={filters.q ?? ""} placeholder="Search…" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Date from</label>
        <Input type="date" name="from" defaultValue={filters.from ?? ""} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Date to</label>
        <Input type="date" name="to" defaultValue={filters.to ?? ""} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Due from</label>
        <Input type="date" name="dueFrom" defaultValue={filters.dueFrom ?? ""} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Due to</label>
        <Input type="date" name="dueTo" defaultValue={filters.dueTo ?? ""} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Min amount</label>
        <Input type="number" name="minAmount" defaultValue={filters.minAmount ?? ""} min="0" step="any" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Max amount</label>
        <Input type="number" name="maxAmount" defaultValue={filters.maxAmount ?? ""} min="0" step="any" />
      </div>
      <div className="flex items-end gap-2">
        <Button type="submit" size="sm">Apply</Button>
        <Link href="/invoices" className="text-xs text-muted-foreground hover:text-foreground">Clear</Link>
      </div>
    </form>
  );
}
