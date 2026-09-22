// Resolves the event URL and renders either recovery, loading, or workspace UI.
"use client";

import { useAction, useQuery } from "convex/react";
import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import {
  parseProviderCredentials,
  providerCredentialsSnapshot,
  saveProviderCredentials,
  type ProviderCredentials,
} from "@/lib/provider-credentials";
import { EventWorkspace } from "./event-workspace";
import { DemoResearchReplay } from "./research-progress";

const subscribeToSession = () => () => undefined;

function RetryResearch({
  eventId,
  sendToken,
  credentials,
}: {
  eventId: Id<"events">;
  sendToken: string;
  credentials: ProviderCredentials;
}) {
  const retry = useAction(api.research.generateForEvent);
  const [openaiApiKey, setOpenaiApiKey] = useState(credentials.openaiApiKey);
  const [firecrawlApiKey, setFirecrawlApiKey] = useState(credentials.firecrawlApiKey);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const openaiKey = openaiApiKey.trim();
    const firecrawlKey = firecrawlApiKey.trim();
    if (!openaiKey || !firecrawlKey) {
      setError("Add both research keys before retrying.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      saveProviderCredentials(eventId, {
        ...credentials,
        openaiApiKey: openaiKey,
        firecrawlApiKey: firecrawlKey,
      });
      await retry({
        eventId,
        sendToken,
        openaiApiKey: openaiKey,
        firecrawlApiKey: firecrawlKey,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Research could not restart.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 flex max-w-xl flex-wrap items-end gap-3">
      <label className="min-w-52 flex-1 text-xs font-medium">
        OpenAI API key
        <input
          type="password"
          required
          maxLength={512}
          autoComplete="off"
          value={openaiApiKey}
          onChange={(event) => setOpenaiApiKey(event.target.value)}
          className="mt-1 block h-10 w-full rounded border border-input bg-background px-3"
        />
      </label>
      <label className="min-w-52 flex-1 text-xs font-medium">
        Firecrawl API key
        <input
          type="password"
          required
          maxLength={512}
          autoComplete="off"
          value={firecrawlApiKey}
          onChange={(event) => setFirecrawlApiKey(event.target.value)}
          className="mt-1 block h-10 w-full rounded border border-input bg-background px-3"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Retrying" : "Retry research"}
      </button>
      {error ? (
        <p role="alert" className="w-full text-xs text-destructive">{error}</p>
      ) : null}
    </form>
  );
}

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

export function EventPageClient({
  eventId: routeEventId,
  sendToken: routeSendToken,
  replayDemo: routeReplayDemo,
}: {
  eventId?: string | null;
  sendToken?: string | null;
  replayDemo?: boolean;
} = {}) {
  const searchParams = useSearchParams();
  const eventId = routeEventId ?? (searchParams.get("id")?.trim() || null);
  const sendToken = routeSendToken ?? (searchParams.get("token")?.trim() || null);
  const replayDemo = routeReplayDemo ?? searchParams.get("demo") === "agents";
  const event = useQuery(api.events.get, eventId ? { eventId } : "skip");
  const research = useQuery(
    api.researchData.getByEvent,
    event ? { eventId: event._id } : "skip",
  );
  const generateResearch = useAction(api.research.generateForEvent);
  const startedEventRef = useRef<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [demoReplayComplete, setDemoReplayComplete] = useState(false);
  const finishDemoReplay = useCallback(() => setDemoReplayComplete(true), []);
  const credentialSnapshot = useSyncExternalStore(
    subscribeToSession,
    () => (eventId ? providerCredentialsSnapshot(eventId) : ""),
    () => null,
  );
  const credentials = useMemo(
    () => credentialSnapshot ? parseProviderCredentials(credentialSnapshot) : null,
    [credentialSnapshot],
  );
  const credentialsLoaded = credentialSnapshot !== null;

  useEffect(() => {
    if (
      !eventId ||
      !event ||
      event.isDemo ||
      event.researchStage !== "queued" ||
      !sendToken ||
      !credentials ||
      startedEventRef.current === eventId
    ) {
      return;
    }
    startedEventRef.current = eventId;
    setStartError(null);
    void generateResearch({
      eventId: event._id,
      sendToken,
      openaiApiKey: credentials.openaiApiKey,
      firecrawlApiKey: credentials.firecrawlApiKey,
    }).catch((caught) => {
      startedEventRef.current = null;
      setStartError(
        caught instanceof Error
          ? caught.message
          : "Gatherly could not start this venue search.",
      );
    });
  }, [credentials, event, eventId, generateResearch, sendToken]);

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
  if (event.isDemo && replayDemo && !demoReplayComplete) {
    return <DemoResearchReplay event={event} onComplete={finishDemoReplay} />;
  }
  if (!event.isDemo && event.researchStage === "queued" && !credentialsLoaded) {
    return <EventWorkspaceLoading />;
  }
  if (
    !event.isDemo &&
    event.researchStage === "queued" &&
    (!credentials || !sendToken || startError)
  ) {
    return (
      <EventRecovery
        title="This live search cannot start"
        description={
          startError ??
          "Its browser-session credentials are missing. Return home and start a new live search with your provider access."
        }
      />
    );
  }
  if (event.researchStage === "review_ready" && research === undefined) {
    return <EventWorkspaceLoading />;
  }

  return (
    <EventWorkspace
      event={event}
      research={research}
      sendToken={sendToken}
      providerCredentials={credentials}
      retryControls={
        event.researchStage === "failed" && !event.isDemo && sendToken && credentials
          ? <RetryResearch eventId={event._id} sendToken={sendToken} credentials={credentials} />
          : undefined
      }
    />
  );
}
