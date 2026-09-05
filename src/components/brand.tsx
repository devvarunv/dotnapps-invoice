import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Logomark — a receipt/document silhouette with a check, matching the
 * product promise ("Create. Quote. Invoice. Share. Get Paid."). Uses
 * currentColor so it follows text color (and therefore light/dark theme)
 * automatically.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <path d="M24 12H68L76 20V88L64 82L52 88L40 82L28 88L24 84V12Z" fillOpacity="0.12" />
      <path d="M24 12H68L76 20V88L64 82L52 88L40 82L28 88L24 84V12Z" fillOpacity="0" stroke="currentColor" strokeWidth="4" />
      <path d="M35 34H65" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M35 47H65" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M35 60H52" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({
  className,
  href = "/",
}: {
  className?: string;
  href?: string | null;
}) {
  const mark = (
    <span className={cn("flex items-center gap-2 font-semibold", className)}>
      <LogoMark className="size-7 text-foreground" />
      <span className="tracking-tight">
        Dotnapps <span className="text-muted-foreground">Invoice</span>
      </span>
    </span>
  );
  return href ? (
    <Link href={href} className="inline-flex">
      {mark}
    </Link>
  ) : (
    mark
  );
}
