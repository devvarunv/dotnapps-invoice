"use client";

export function SentMessage({ text }: { text: string }) {
  return (
    <textarea
      readOnly
      value={text}
      rows={2}
      className="mt-2 w-full rounded border border-border bg-background p-2 text-xs"
      onFocus={(e) => e.currentTarget.select()}
    />
  );
}
