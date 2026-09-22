// Displays and copies the event identifier used to reopen a Gatherly workspace.
"use client";

import { Check, Copy, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyEventId({ eventId }: { eventId: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard access is unavailable.");
      await navigator.clipboard.writeText(eventId);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <code className="max-w-36 truncate text-[0.68rem] text-muted-foreground" title={eventId}>
        {eventId}
      </code>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 shrink-0 bg-transparent px-2 text-[0.68rem]"
        onClick={copy}
        aria-label="Copy event ID"
      >
        {state === "copied" ? (
          <Check aria-hidden="true" />
        ) : state === "failed" ? (
          <TriangleAlert aria-hidden="true" />
        ) : (
          <Copy aria-hidden="true" />
        )}
        {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy ID"}
      </Button>
    </div>
  );
}
