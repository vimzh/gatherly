// Resolves the event URL and renders either recovery, loading, or workspace UI.
"use client";

import { useQuery } from "convex/react";
import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { EventWorkspace } from "./event-workspace";

export function EventRecovery({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="flex min-h-svh items-center justify-center px-5 py-12">
      <section className="w-full max-w-md rounded border border-border bg-card p-8 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded bg-secondary text-muted-foreground">
          <SearchX className="size-5" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-xl font-semibold tracking-[-0.025em]">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Start a new search
        </Link>
      </section>
    </main>
  );
}

export function EventWorkspaceLoading() {
  return (
    <main className="min-h-svh p-3 sm:p-5">
      <div className="mx-auto grid min-h-[calc(100svh-1.5rem)] max-w-[90rem] gap-3 lg:min-h-[calc(100svh-2.5rem)] lg:grid-cols-[17rem_minmax(0,1fr)_22rem]">
        <Skeleton className="min-h-48 rounded" />
        <Skeleton className="min-h-96 rounded" />
        <Skeleton className="min-h-64 rounded" />
      </div>
    </main>
  );
}

export function EventPageClient() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get("id")?.trim() || null;
  const sendToken = searchParams.get("token")?.trim() || null;
  const event = useQuery(api.events.get, eventId ? { eventId } : "skip");
  const research = useQuery(
    api.researchData.getByEvent,
    event ? { eventId: event._id } : "skip",
  );

  if (!eventId) {
    return (
      <EventRecovery
        title="This event link is incomplete"
        description="Start a new search to create a valid Gatherly event."
      />
    );
  }
  if (event === undefined) return <EventWorkspaceLoading />;
  if (event === null) {
    return (
      <EventRecovery
        title="Event not found"
        description="This event may have been removed, or the link may be incorrect."
      />
    );
  }

  return <EventWorkspace event={event} research={research} sendToken={sendToken} />;
}
