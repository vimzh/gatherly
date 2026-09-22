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
    <main className="min-h-svh px-4 py-5 sm:px-6 sm:py-7">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <Skeleton className="h-5 w-20 rounded" />
          <Skeleton className="h-4 w-28 rounded" />
        </div>
        <div className="border-b border-border py-12">
          <Skeleton className="h-6 w-44 rounded" />
          <Skeleton className="mt-5 h-12 max-w-2xl rounded" />
          <Skeleton className="mt-4 h-5 max-w-xl rounded" />
          <Skeleton className="mt-8 h-1 w-full rounded-full" />
        </div>
        <div className="grid gap-px overflow-hidden rounded border border-border bg-border py-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-48 rounded-none" />
          ))}
        </div>
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
  if (event.researchStage === "review_ready" && research === undefined) {
    return <EventWorkspaceLoading />;
  }

  return <EventWorkspace event={event} research={research} sendToken={sendToken} />;
}
