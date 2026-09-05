"use client";

import { useActionState } from "react";
import { toggleProductActiveAction } from "./actions";
import { IDLE } from "@/lib/form";
import { Badge } from "@/components/ui/primitives";

export function ToggleActiveButton({
  productId,
  isActive,
}: {
  productId: string;
  isActive: boolean;
}) {
  const [state, action] = useActionState(toggleProductActiveAction, IDLE);
  return (
    <form action={action}>
      <input type="hidden" name="productId" value={productId} />
      <button type="submit">
        <Badge tone={isActive ? "success" : "neutral"} className="cursor-pointer">
          {isActive ? "Active" : "Inactive"}
        </Badge>
      </button>
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
