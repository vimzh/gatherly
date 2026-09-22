// Captures an event brief, creates its persistent Convex record, and opens it.
"use client";

import { useMutation } from "convex/react";
import { ArrowUpRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { eventHref, normalizeEventBrief } from "@/lib/event-navigation";

const EXAMPLES = [
  {
    type: "Hackathon",
    location: "London",
    attendance: "300 guests",
    requirements: "Overnight access · Strong Wi-Fi",
    prompt: "A 300-person hackathon in London with overnight access and strong Wi-Fi",
  },
  {
    type: "Creative showcase",
    location: "Berlin",
    attendance: "180 guests",
    requirements: "Stage · Late-evening access",
    prompt: "A creative showcase for 180 guests in Berlin with a stage and late-evening access",
  },
  {
    type: "Company gathering",
    location: "Central London",
    attendance: "120 guests",
    requirements: "Catering · Breakout space",
    prompt: "A company gathering for 120 people near central London with catering and breakout space",
  },
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
      const created = await createEvent({
        brief: normalized,
        requestKey: requestKeyRef.current,
      });
      router.push(eventHref(created.eventId, created.sendToken));
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
        className="rounded border border-border bg-card p-3 text-left sm:p-4"
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
        <div className="flex items-end justify-between gap-3 px-2 pt-3">
          <p id="event-brief-help" className="hidden text-xs text-muted-foreground sm:block">
            Include location, guest count, dates, and must-haves.
          </p>
          <Button
            type="submit"
            size="lg"
            disabled={pending}
            className="ml-auto h-10 rounded px-4"
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

      <div className="mt-6 grid grid-cols-3 gap-2" aria-label="Example event briefs">
        {EXAMPLES.map((example) => (
          <button
            key={example.type}
            type="button"
            onClick={() => updateBrief(example.prompt)}
            aria-pressed={brief === example.prompt}
            className="group flex min-h-40 min-w-0 flex-col rounded border border-border bg-card p-3 text-left transition-colors hover:border-input hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:border-foreground/40 aria-pressed:bg-secondary/60 sm:p-4"
          >
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {example.type}
            </span>
            <span className="mt-4 text-sm font-semibold tracking-[-0.015em]">
              {example.location}
            </span>
            <span className="mt-1 text-xs text-muted-foreground">
              {example.attendance}
            </span>
            <span className="mt-auto border-t border-border pt-3 text-[0.68rem] leading-4 text-muted-foreground group-hover:text-foreground sm:text-xs sm:leading-5">
              {example.requirements}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
