// Resolves an event and presents its agent activity and outreach delivery queue.
"use client";

import { useQuery } from "convex/react";
import {
  Check,
  Circle,
  Clock3,
  Inbox,
  LoaderCircle,
  Mail,
  Send,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { eventHref } from "@/lib/event-navigation";
import { cn } from "@/lib/utils";
import { CopyEventId } from "./copy-event-id";
import { DemoOutreachInbox } from "./demo-outreach-inbox";
import { EventRecovery, EventWorkspaceLoading } from "./event-page-client";

type Event = Omit<Doc<"events">, "requestKey" | "sendToken">;
type Research = {
  venues: Doc<"venues">[];
  drafts: Doc<"outreachDrafts">[];
  rejectedCandidates: Doc<"rejectedVenues">[];
};
type DraftStatus = Doc<"outreachDrafts">["status"];

const draftLabels: Record<DraftStatus, string> = {
  draft: "Draft ready",
  approved: "Approved",
  sending: "Confirming send",
  sent: "Sent",
  failed: "Needs attention",
};

const draftStyles: Record<DraftStatus, string> = {
  draft: "border-[#d6d2ca] bg-[#efede8] text-[#66615a]",
  approved: "border-[#b8cbd2] bg-[#e8f0f3] text-[#3f6875]",
  sending: "border-[#b8cbd2] bg-[#e8f0f3] text-[#3f6875]",
  sent: "border-[#a8c5a4] bg-[#e6f0e2] text-[#315b39]",
  failed: "border-[#dfb4a8] bg-[#f7e7e2] text-[#8a4938]",
};

function ActivityMarker({ state }: { state: Event["activities"][number]["state"] }) {
  if (state === "completed") return <Check className="size-3" aria-hidden="true" />;
  if (state === "active") {
    return <LoaderCircle className="size-3 animate-spin motion-reduce:animate-none" aria-hidden="true" />;
  }
  if (state === "failed") return <TriangleAlert className="size-3" aria-hidden="true" />;
  return <Circle className="size-2.5" aria-hidden="true" />;
}

function threadSummary(draft: Doc<"outreachDrafts">, venue: Doc<"venues"> | null) {
  if (draft.status === "sent") {
    return `AgentMail confirmed delivery to ${venue?.name ?? "the venue"}. Gatherly is waiting for a reply.`;
  }
  if (draft.status === "sending") {
    return "The send was started, but provider confirmation is still pending. Retry only from the original draft.";
  }
  if (draft.status === "failed") {
    return draft.sendError ?? "The last delivery attempt needs organizer review.";
  }
  return `The enquiry for ${venue?.name ?? "this venue"} is prepared and still requires organizer approval.`;
}

function EventInboxWorkspace({
  event,
  research,
  sendToken,
}: {
  event: Event;
  research: Research;
  sendToken: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const drafts = research.drafts;
  const selectedDraft = drafts.find((draft) => draft._id === selectedId) ?? drafts[0] ?? null;
  const selectedVenue = selectedDraft
    ? research.venues.find((venue) => venue._id === selectedDraft.venueId) ?? null
    : null;
  const completed = event.activities.filter((activity) => activity.state === "completed").length;
  const sent = drafts.filter((draft) => draft.status === "sent").length;
  const attention = drafts.filter((draft) => draft.status === "failed").length;

  return (
    <main className="min-h-svh bg-[#f3f1ec]">
      <div className="mx-auto grid min-h-svh max-w-[96rem] lg:grid-cols-[15rem_20rem_minmax(0,1fr)] lg:border-x lg:border-[#dedbd4]">
        <aside className="flex flex-col border-b border-[#e3d3bd] bg-[#f8f0e4] p-4 lg:sticky lg:top-0 lg:h-svh lg:overflow-y-auto lg:border-r lg:border-b-0 lg:p-5">
          <Link
            href="/"
            className="text-sm font-semibold tracking-[-0.02em] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Gatherly
          </Link>
          <div className="mt-7 border-b border-[#e3d3bd] pb-5">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#8a6338]">
              Event
            </p>
            <h1 className="mt-2 line-clamp-3 text-base font-semibold leading-6 tracking-[-0.02em]">
              {event.title}
            </h1>
            <div className="mt-3">
              <CopyEventId eventId={event._id} />
            </div>
          </div>

          <nav className="mt-4" aria-label="Event workspace">
            <ul className="space-y-1">
              <li>
                <a
                  href={eventHref(event._id, sendToken)}
                  className="flex items-center gap-2.5 rounded px-2.5 py-2 text-sm text-muted-foreground hover:bg-[#eee1cf] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Mail className="size-4" aria-hidden="true" />
                  Venue workspace
                </a>
              </li>
              <li>
                <span className="flex items-center gap-2.5 rounded bg-[#e7dfd2] px-2.5 py-2 text-sm font-medium" aria-current="page">
                  <Inbox className="size-4" aria-hidden="true" />
                  Outreach inbox
                </span>
              </li>
            </ul>
          </nav>

          <section className="mt-6 border-t border-[#e3d3bd] pt-5" aria-labelledby="agent-status-title">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Agent activity
                </p>
                <h2 id="agent-status-title" className="mt-1 text-sm font-semibold">
                  {completed} of {event.activities.length} complete
                </h2>
              </div>
            </div>
            <ol className="mt-3 space-y-2.5">
              {event.activities.map((activity) => (
                <li key={activity.key} className="grid grid-cols-[1.25rem_1fr] items-start gap-2 text-xs">
                  <span className={cn(
                    "mt-0.5 flex size-5 items-center justify-center rounded border",
                    activity.state === "completed" && "border-[#8eaa86] bg-[#e6f0e2] text-[#315b39]",
                    activity.state === "active" && "border-[#7896a0] bg-[#e8f0f3] text-[#3f6875]",
                    activity.state === "failed" && "border-[#c89384] bg-[#f7e7e2] text-[#8a4938]",
                  )}>
                    <ActivityMarker state={activity.state} />
                  </span>
                  <span className="leading-5 text-muted-foreground">{activity.label}</span>
                </li>
              ))}
            </ol>
          </section>
        </aside>

        <section className="border-b border-[#d9d6cf] bg-[#f7f6f2] lg:h-svh lg:overflow-y-auto lg:border-r lg:border-b-0" aria-labelledby="event-inbox-title">
          <header className="border-b border-[#d9d6cf] px-4 py-4">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Event inbox
            </p>
            <h2 id="event-inbox-title" className="mt-1 text-xl font-semibold tracking-[-0.03em]">
              Outreach
            </h2>
            <div className="mt-4 grid grid-cols-3 divide-x divide-[#d9d6cf] border-t border-[#d9d6cf] pt-3 text-center">
              <div><p className="text-lg font-semibold">{drafts.length}</p><p className="text-[0.68rem] text-muted-foreground">drafts</p></div>
              <div><p className="text-lg font-semibold">{sent}</p><p className="text-[0.68rem] text-muted-foreground">sent</p></div>
              <div><p className="text-lg font-semibold">{attention}</p><p className="text-[0.68rem] text-muted-foreground">attention</p></div>
            </div>
          </header>

          {drafts.length > 0 ? (
            <ul className="divide-y divide-[#d9d6cf]" aria-label="Venue outreach">
              {drafts.map((draft) => {
                const venue = research.venues.find((candidate) => candidate._id === draft.venueId);
                return (
                  <li key={draft._id}>
                    <button
                      type="button"
                      aria-pressed={draft._id === selectedDraft?._id}
                      onClick={() => setSelectedId(draft._id)}
                      className={cn(
                        "w-full px-4 py-4 text-left hover:bg-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50",
                        draft._id === selectedDraft?._id && "bg-white",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold">{venue?.name ?? "Venue"}</p>
                        <span className="text-[0.68rem] text-muted-foreground">
                          {draft.sentAt ? new Date(draft.sentAt).toLocaleDateString() : "Not sent"}
                        </span>
                      </div>
                      <Badge variant="outline" className={cn("mt-2 text-[0.64rem]", draftStyles[draft.status])}>
                        {draftLabels[draft.status]}
                      </Badge>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {draft.subject}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-5 py-10 text-center">
              <Clock3 className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
              <h3 className="mt-3 text-sm font-semibold">No outreach yet</h3>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Drafts appear here after venue research and verification finish.
              </p>
            </div>
          )}
        </section>

        <section className="min-w-0 bg-white lg:h-svh lg:overflow-y-auto" aria-labelledby="outreach-detail-title">
          {selectedDraft ? (
            <>
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#d9d6cf] px-4 py-4 sm:px-6">
                <div>
                  <h2 id="outreach-detail-title" className="text-xl font-semibold tracking-[-0.03em]">
                    {selectedVenue?.name ?? "Venue outreach"}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">{selectedDraft.subject}</p>
                </div>
                <Badge variant="outline" className={draftStyles[selectedDraft.status]}>
                  {draftLabels[selectedDraft.status]}
                </Badge>
              </header>
              <div className="px-4 py-5 sm:px-6">
                <section className="border-l-2 border-[#9db88d] bg-[#edf4e9] px-4 py-3" aria-labelledby="delivery-summary-title">
                  <h3 id="delivery-summary-title" className="text-sm font-semibold text-[#355a3d]">
                    Organizer summary
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#425b46]">
                    {threadSummary(selectedDraft, selectedVenue)}
                  </p>
                </section>

                <dl className="mt-4 grid border-y border-[#ddd9d1] sm:grid-cols-2">
                  <div className="border-b border-[#ece9e3] py-3 sm:border-r sm:pr-4">
                    <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Capacity</dt>
                    <dd className="mt-1 text-sm font-medium">{selectedVenue?.capacityMaximum ?? "Needs confirmation"}</dd>
                  </div>
                  <div className="border-b border-[#ece9e3] py-3 sm:pl-4">
                    <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Contact route</dt>
                    <dd className="mt-1 text-sm font-medium">{selectedVenue?.contactType === "email" ? "Public email" : "Public contact form"}</dd>
                  </div>
                  <div className="border-b border-[#ece9e3] py-3 sm:border-r sm:pr-4 sm:border-b-0">
                    <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Fit score</dt>
                    <dd className="mt-1 text-sm font-medium">{selectedVenue?.recommendationScore ?? "Not scored"}{selectedVenue?.recommendationScore !== undefined ? "/100" : ""}</dd>
                  </div>
                  <div className="py-3 sm:pl-4">
                    <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">AgentMail</dt>
                    <dd className="mt-1 text-sm font-medium">{selectedDraft.agentMailThreadId ? "Thread created" : "Not connected yet"}</dd>
                  </div>
                </dl>

                <section className="mt-6" aria-labelledby="outbound-message-title">
                  <div className="flex items-center justify-between border-b border-[#ddd9d1] pb-2">
                    <h3 id="outbound-message-title" className="text-sm font-semibold">Outbound message</h3>
                    <span className="flex items-center gap-1 text-[0.68rem] text-muted-foreground">
                      <Send className="size-3" aria-hidden="true" />
                      {selectedDraft.status === "sent" ? "Sent" : "Prepared"}
                    </span>
                  </div>
                  <Textarea
                    readOnly
                    value={selectedDraft.body}
                    aria-label="Outreach message"
                    className="mt-3 min-h-56 resize-none bg-[#faf9f6] text-sm leading-6"
                  />
                </section>

                <section className="mt-5 border-l-2 border-[#b8cbd2] bg-[#f3f7f8] px-4 py-3" aria-labelledby="reply-state-title">
                  <h3 id="reply-state-title" className="text-sm font-semibold text-[#3f6875]">
                    Venue replies
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#4a6670]">
                    {selectedDraft.status === "sent"
                      ? "Waiting for a venue reply. Inbound AgentMail reply sync is not connected in this prototype yet."
                      : "This message has not been sent, so there is no venue reply yet."}
                  </p>
                </section>

                <a
                  href={eventHref(event._id, sendToken)}
                  className="mt-5 inline-flex h-9 items-center justify-center rounded border border-border bg-white px-3 text-sm font-medium hover:bg-secondary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  Open venue workspace
                </a>
              </div>
            </>
          ) : (
            <div className="flex min-h-[26rem] items-center justify-center px-5 py-12 text-center">
              <div className="max-w-sm">
                <Inbox className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
                <h2 id="outreach-detail-title" className="mt-4 text-lg font-semibold">Outreach will appear here</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  The agent activity rail shows what is happening now. Verified drafts become inbox threads when research completes.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export function EventInboxPageClient({
  eventId: routeEventId,
  sendToken: routeSendToken,
}: {
  eventId?: string | null;
  sendToken?: string | null;
} = {}) {
  const searchParams = useSearchParams();
  const eventId = routeEventId ?? (searchParams.get("id")?.trim() || null);
  const sendToken = routeSendToken ?? (searchParams.get("token")?.trim() || null);
  const event = useQuery(api.events.get, eventId ? { eventId } : "skip");
  const research = useQuery(
    api.researchData.getByEvent,
    event ? { eventId: event._id } : "skip",
  );

  if (!eventId) {
    return <EventRecovery title="This inbox link is incomplete" description="Open an event workspace to reach its outreach inbox." />;
  }
  if (event === undefined) return <EventWorkspaceLoading />;
  if (event === null) {
    return <EventRecovery title="Event not found" description="This event may have been removed, or the inbox link may be incorrect." />;
  }
  if (event.isDemo) return <DemoOutreachInbox />;
  if (research === undefined) return <EventWorkspaceLoading />;

  return (
    <EventInboxWorkspace
      event={event}
      research={research ?? { venues: [], drafts: [], rejectedCandidates: [] }}
      sendToken={sendToken}
    />
  );
}
