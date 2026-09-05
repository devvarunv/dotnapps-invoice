"use client";

import { useActionState } from "react";
import { toggleExpenseCategoryAction } from "@/app/(app)/expenses/actions";
import { IDLE } from "@/lib/form";
import { Badge } from "@/components/ui/primitives";

export function ToggleCategoryButton({ categoryId, isActive }: { categoryId: string; isActive: boolean }) {
  const [, action] = useActionState(toggleExpenseCategoryAction, IDLE);
  return (
    <form action={action}>
      <input type="hidden" name="categoryId" value={categoryId} />
      <button type="submit">
        <Badge tone={isActive ? "success" : "neutral"} className="cursor-pointer">
          {isActive ? "Active" : "Inactive"}
        </Badge>
      </button>
    </form>
  );
}
