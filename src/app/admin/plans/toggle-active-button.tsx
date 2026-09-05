"use client";

import { useActionState } from "react";
import { togglePlanActiveAction } from "../actions";
import { IDLE } from "@/lib/form";
import { Badge } from "@/components/ui/primitives";

export function TogglePlanActiveButton({ planId, isActive }: { planId: string; isActive: boolean }) {
  const [, action] = useActionState(togglePlanActiveAction, IDLE);
  return (
    <form action={action}>
      <input type="hidden" name="planId" value={planId} />
      <button type="submit">
        <Badge tone={isActive ? "success" : "neutral"} className="cursor-pointer">
          {isActive ? "Active" : "Inactive"}
        </Badge>
      </button>
    </form>
  );
}
