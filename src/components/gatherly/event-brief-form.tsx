// Captures an event brief, creates its persistent Convex record, and opens it.
"use client";

import { useMutation } from "convex/react";
import { ArrowUpRight, LoaderCircle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { eventHref, normalizeEventBrief } from "@/lib/event-navigation";

const EXAMPLES = [
  "A 300-person hackathon in London with overnight access and strong Wi-Fi",
  "A creative showcase for 180 guests with a stage and late-evening access",
  "A company gathering for 120 people near central London with catering",
];

export function EventBriefForm() {
  const [brief, setBrief] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const briefRef = useRef<HTMLTextAreaElement>(null);
  const requestKeyRef = useRef<string | null>(null);
  const submittingRef = useRef(false);
  const createEvent = useMutation(api.events.create);
  const router = useRouter();

  function updateBrief(value: string) {
    setBrief(value);
    setError(null);
    requestKeyRef.current = null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    try {
      const normalized = normalizeEventBrief(brief);
      if (!normalized) {
        setError("Describe the event before starting a search.");
        briefRef.current?.focus();
        return;
      }

      submittingRef.current = true;
      setPending(true);
      setError(null);
      requestKeyRef.current ??= crypto.randomUUID();
      const eventId = await createEvent({
        brief: normalized,
        requestKey: requestKeyRef.current,
      });
      router.push(eventHref(eventId));
    } catch (caughtError) {
      briefRef.current?.focus();
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Gatherly could not create this event. Try again.",
      );
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  }

  return (
    <div className="mt-10 w-full">
      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-border bg-card p-3 text-left shadow-xl sm:p-4"
      >
        <label htmlFor="event-brief" className="sr-only">
          Describe your event and venue requirements
        </label>
        <Textarea
          ref={briefRef}
          id="event-brief"
          value={brief}
          onChange={(event) => updateBrief(event.target.value)}
          placeholder="I need a London venue for a 300-person creative showcase in October, with a stage and late access…"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "event-brief-error" : "event-brief-help"}
          className="min-h-36 resize-none border-0 bg-transparent px-3 py-3 text-base leading-7 shadow-none focus-visible:border-transparent focus-visible:ring-0 md:text-base"
        />
        <div className="flex items-end justify-between gap-3 border-t border-border px-2 pt-3">
          <p id="event-brief-help" className="hidden text-xs text-muted-foreground sm:block">
            Include location, guest count, dates, and must-haves.
          </p>
          <Button
            type="submit"
            size="lg"
            disabled={pending}
            className="ml-auto h-10 rounded-xl px-4"
          >
            {pending ? (
              <LoaderCircle className="animate-spin motion-reduce:animate-none" />
            ) : (
              <ArrowUpRight />
            )}
            {pending ? "Creating event" : "Find venues"}
          </Button>
        </div>
      </form>

      {error ? (
        <p id="event-brief-error" role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap justify-center gap-2" aria-label="Example event briefs">
        {EXAMPLES.map((example, index) => (
          <button
            key={example}
            type="button"
            onClick={() => updateBrief(example)}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-input hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {index === 0 ? "Hackathon" : index === 1 ? "Creative showcase" : "Company gathering"}
          </button>
        ))}
      </div>

      <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5 text-clay" aria-hidden="true" />
        You approve every email before it sends.
      </p>
    </div>
  );
}
