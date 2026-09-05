export function UsageBar({
  label,
  current,
  limit,
}: {
  label: string;
  current: number;
  limit?: number;
}) {
  const unlimited = limit === undefined || limit === null;
  const pct = unlimited ? 0 : Math.min(100, Math.round((current / Math.max(limit, 1)) * 100));
  const isOver = !unlimited && current > limit;
  const isNear = !unlimited && !isOver && pct >= 80;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={isOver ? "font-medium text-destructive" : "text-muted-foreground"}>
          {Math.round(current * 100) / 100}{unlimited ? "" : ` / ${limit}`}
        </span>
      </div>
      {!unlimited && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${isOver ? "bg-destructive" : isNear ? "bg-amber-500" : "bg-primary"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
