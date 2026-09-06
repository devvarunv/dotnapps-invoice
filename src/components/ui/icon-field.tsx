import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Wraps an <Input>/<Select> with a leading icon inside the field. */
export function IconField({
  icon: Icon,
  children,
  className,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <div className="[&_input]:pl-9 [&_select]:pl-9">{children}</div>
    </div>
  );
}
