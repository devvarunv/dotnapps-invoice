import type { LucideIcon } from "lucide-react";
import { PageHeader } from "./page-header";

/**
 * Shell for a nav module that hasn't shipped yet (build order, spec §29).
 * Keeps the route/nav entry real from Phase 1 so later phases attach
 * without reshaping navigation or permissions.
 */
export function ModulePlaceholder({
  icon: Icon,
  title,
  description,
  phase,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  phase: number;
}) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
        <div className="mx-auto grid size-11 place-items-center rounded-full bg-muted">
          <Icon className="size-5 text-muted-foreground" />
        </div>
        <p className="mt-4 text-sm font-medium">Coming in Phase {phase}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          This module isn&apos;t built yet. Foundation (Phase 1) ships auth,
          the business/tenancy model, roles, and this navigation shell.
        </p>
      </div>
    </div>
  );
}
