// Presents live venue research and organizer-confirmed AgentMail outreach.
"use client";

import { useAction } from "convex/react";
import {
  Building2,
  Check,
  Circle,
  Clock3,
  LoaderCircle,
  Mail,
  MailCheck,
  MessageSquareText,
  ExternalLink,
  MapPin,
  Search,
  ShieldCheck,
  Star,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Activity = Doc<"events">["activities"][number];
type ResearchResult =
  | {
      venues: Doc<"venues">[];
      drafts: Doc<"outreachDrafts">[];
      rejectedCandidates: Doc<"rejectedVenues">[];
    }
  | null
  | undefined;

const workspaceLinks = [
  { label: "Activity", icon: Clock3, active: true },
  { label: "Venues", icon: Building2, active: false },
  { label: "Outreach", icon: Mail, active: false },
  { label: "Replies", icon: MessageSquareText, active: false },
];

const stateLabels: Record<Activity["state"], string> = {
  queued: "Queued",
  active: "In progress",
  completed: "Complete",
  failed: "Needs attention",
  approval_required: "Approval required",
};

function ActivityIcon({ state }: { state: Activity["state"] }) {
  if (state === "completed") return <Check className="size-4" aria-hidden="true" />;
  if (state === "active") {
    return (
      <LoaderCircle
        className="size-4 animate-spin motion-reduce:animate-none"
        aria-hidden="true"
      />
    );
  }
  if (state === "failed") {
    return <TriangleAlert className="size-4" aria-hidden="true" />;
  }
  if (state === "approval_required") {
    return <MailCheck className="size-4" aria-hidden="true" />;
  }
  return <Circle className="size-4" aria-hidden="true" />;
}

function DraftSendButton({
  eventId,
  draft,
  venueName,
  recipient,
  sendToken,
}: {
  eventId: Id<"events">;
  draft: Doc<"outreachDrafts">;
  venueName: string;
  recipient: string | null;
  sendToken: string | null;
}) {
  const sendDraft = useAction(api.outreach.sendDraft);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (draft.status === "sent") {
    return <span className="text-xs font-medium">Sent via AgentMail</span>;
  }
  if (!recipient) {
    return (
      <span className="text-xs text-muted-foreground">
        A public email address is required for AgentMail.
      </span>
    );
  }
  if (!sendToken) {
    return (
      <span className="text-xs text-destructive">
        Open the original private event link to send.
      </span>
    );
  }
  const authorizedToken = sendToken;

  async function send() {
    if (!window.confirm(`Send this email to ${recipient} for ${venueName}?`)) return;
    setPending(true);
    setError(null);
    try {
      await sendDraft({ eventId, draftId: draft._id, sendToken: authorizedToken });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AgentMail could not send this draft.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <Button
        type="button"
        size="sm"
        disabled={pending || draft.status === "sending"}
        onClick={send}
      >
        {pending || draft.status === "sending"
          ? "Sending"
          : draft.status === "failed"
            ? "Retry with AgentMail"
            : "Send with AgentMail"}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function RejectedCandidates({
  candidates,
}: {
  candidates: Doc<"rejectedVenues">[];
}) {
  const [expanded, setExpanded] = useState(false);

  if (candidates.length === 0) return null;

  return (
    <section className="mb-3 border-t border-border pt-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full justify-between"
        aria-controls="rejected-candidates"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        {expanded ? "Hide" : "View"} rejected candidates ({candidates.length})
      </Button>
      {expanded ? (
        <div id="rejected-candidates" className="mt-3 max-h-72 space-y-2 overflow-y-auto">
          <p className="text-xs leading-5 text-muted-foreground">
            Excluded by automated fit checks, but still available for your review.
          </p>
          {candidates.map((candidate) => (
            <article key={candidate._id} className="rounded border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">{candidate.name}</h3>
                  <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                    {candidate.location}
                  </p>
                </div>
                <a
                  href={candidate.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open source for ${candidate.name}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="size-4" aria-hidden="true" />
                </a>
              </div>
              <p className="mt-3 text-xs">
                Capacity: {candidate.capacityMaximum ?? "Not published"}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {candidate.reason}
              </p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function EventWorkspace({
  event,
  research,
  sendToken,
}: {
  event: Doc<"events">;
  research: ResearchResult;
  sendToken: string | null;
}) {
  const completedCount = event.activities.filter(
    (activity) => activity.state === "completed",
  ).length;
  const venues = research?.venues ?? [];
  const drafts = research?.drafts ?? [];
  const rejectedCandidates = research?.rejectedCandidates ?? [];

  return (
    <main className="min-h-svh p-3 sm:p-5">
      <div className="mx-auto grid min-h-[calc(100svh-1.5rem)] max-w-[90rem] gap-3 lg:min-h-[calc(100svh-2.5rem)] lg:grid-cols-[17rem_minmax(0,1fr)_22rem]">
        <aside className="flex flex-col rounded border border-border bg-card p-4 lg:p-5">
          <Link
            href="/"
            className="w-fit text-sm font-semibold tracking-[-0.02em] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Gatherly
          </Link>

          <div className="mt-8 border-b border-border pb-5">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Event brief
            </p>
            <h1 className="mt-2 line-clamp-2 text-base font-semibold leading-6 tracking-[-0.02em]">
              {event.title}
            </h1>
            <p className="mt-3 line-clamp-5 text-xs leading-5 text-muted-foreground">
              {event.brief}
            </p>
          </div>

          <nav className="mt-4" aria-label="Event workspace">
            <ul className="space-y-1">
              {workspaceLinks.map(({ label, icon: Icon, active }) => (
                <li key={label}>
                  <span
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm",
                      active
                        ? "bg-secondary font-medium text-foreground"
                        : "text-muted-foreground",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {label}
                  </span>
                </li>
              ))}
            </ul>
          </nav>

          <p className="mt-auto hidden pt-8 text-[0.68rem] leading-5 text-muted-foreground lg:block">
            Event ID<br />
            <span className="font-medium text-foreground">{event._id}</span>
          </p>
        </aside>

        <section
          aria-labelledby="activity-title"
          aria-live="polite"
          className="rounded border border-border bg-card p-5 sm:p-7"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
            <div>
              <Badge variant="outline" className="gap-1.5 font-medium text-muted-foreground">
                <span className="size-1.5 rounded-full bg-clay" aria-hidden="true" />
                {event.researchStage === "review_ready"
                  ? "AI research reviewed"
                  : "AI research in progress"}
              </Badge>
              <h2 id="activity-title" className="mt-4 text-2xl font-semibold tracking-[-0.035em]">
                Sourcing your venue
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Follow the useful actions Gatherly takes for this event.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {completedCount} of {event.activities.length} complete
            </p>
          </div>

          <ol className="mt-2 divide-y divide-border">
            {event.activities.map((activity) => (
              <li key={activity.key} className="grid grid-cols-[2.25rem_1fr] gap-3 py-5">
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded border",
                    activity.state === "completed" &&
                      "border-graphite bg-graphite text-primary-foreground",
                    activity.state === "active" &&
                      "border-clay/40 bg-clay/10 text-clay",
                    activity.state === "queued" &&
                      "border-border bg-secondary text-muted-foreground",
                    activity.state === "failed" &&
                      "border-destructive/30 bg-destructive/10 text-destructive",
                    activity.state === "approval_required" &&
                      "border-graphite/30 bg-secondary text-foreground",
                  )}
                >
                  <ActivityIcon state={activity.state} />
                </span>
                <div className="min-w-0 pt-0.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold">{activity.label}</h3>
                    <span className="text-[0.68rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      {stateLabels[activity.state]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {activity.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <aside
          aria-labelledby="venues-title"
          className="flex flex-col rounded border border-border bg-card p-5"
        >
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h2 id="venues-title" className="text-sm font-semibold">
              Venue results
            </h2>
            <span className="text-xs text-muted-foreground">{venues.length} found</span>
          </div>

          {venues.length > 0 ? (
            <div className="flex-1 space-y-3 overflow-y-auto py-4">
              {venues.map((venue, index) => {
                const draft = drafts.find((item) => item.venueId === venue._id);
                const image = venue.images?.[0];
                return (
                  <article key={venue._id} className="overflow-hidden rounded border border-border">
                    {image ? (
                      <a href={image.sourceUrl} target="_blank" rel="noreferrer">
                        {/* Firecrawl returns arbitrary HTTPS image hosts, so Next Image cannot safely predeclare them. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image.url}
                          alt={image.alt}
                          className="aspect-[16/9] w-full border-b border-border object-cover"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      </a>
                    ) : (
                      <p className="border-b border-border bg-secondary px-3.5 py-3 text-xs text-muted-foreground">
                        No sourced image found.
                      </p>
                    )}
                    <div className="p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold">{venue.name}</h3>
                          <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                            <MapPin className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                            {venue.address ?? venue.location}
                          </p>
                        </div>
                        <a
                          href={venue.websiteUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open ${venue.name} website`}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="size-4" aria-hidden="true" />
                        </a>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-muted-foreground">
                        {venue.fitSummary}
                      </p>
                      {venue.recommendationScore !== undefined ? (
                        <div className="mt-3 rounded border border-border bg-secondary p-2.5">
                          <Badge variant="outline" className="text-[0.68rem]">
                            {index === 0 ? "Recommended" : "Fit score"} ·{" "}
                            {venue.recommendationScore}/100
                          </Badge>
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">
                            {venue.recommendationReason}
                          </p>
                        </div>
                      ) : null}
                      <p className="mt-2 text-xs">
                        Capacity: {venue.capacityMaximum ?? "Needs confirmation"}
                      </p>
                      <p className="mt-2 text-xs">
                        Public contact:{" "}
                        {venue.contactType === "contact_form" ? (
                          <a
                            href={venue.contactValue}
                            target="_blank"
                            rel="noreferrer"
                            className="underline underline-offset-4"
                          >
                            Contact form
                          </a>
                        ) : (
                          venue.contactValue
                        )}
                      </p>
                      {venue.reviews?.slice(0, 2).map((review) => (
                        <div
                          key={review.sourceUrl}
                          className="mt-3 rounded border border-border bg-secondary p-2.5"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="flex items-center gap-1 font-medium">
                              <Star className="size-3" aria-hidden="true" />
                              {review.rating === null
                                ? "Public reviews"
                                : `${review.rating}/5`}
                              {review.reviewCount === null
                                ? ""
                                : ` · ${review.reviewCount} reviews`}
                            </span>
                            <a
                              href={review.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="underline underline-offset-4"
                            >
                              {review.sourceName}
                            </a>
                          </div>
                          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                            {review.summary}
                          </p>
                        </div>
                      ))}
                      {!venue.reviews?.length ? (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Independent reviews: not found in public sources.
                        </p>
                      ) : null}
                      {venue.amenities?.length ? (
                        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Amenities">
                          {venue.amenities.slice(0, 6).map((amenity) => (
                            <li
                              key={amenity}
                              className="rounded border border-border px-1.5 py-1 text-[0.68rem]"
                            >
                              {amenity}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Amenities: not found in public sources.
                        </p>
                      )}
                      <p className="mt-3 text-xs leading-5">
                        <span className="font-medium">Accessibility:</span>{" "}
                        <span className="text-muted-foreground">
                          {venue.accessibilityNotes ?? "Not found in public sources."}
                        </span>
                      </p>
                      <p className="mt-2 text-xs leading-5">
                        <span className="font-medium">Pricing:</span>{" "}
                        <span className="text-muted-foreground">
                          {venue.pricingNotes ?? "Not published; confirm with the venue."}
                        </span>
                      </p>
                      <a
                        href={venue.evidence[0]?.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs underline underline-offset-4"
                      >
                        View source <ExternalLink className="size-3" aria-hidden="true" />
                      </a>
                      {draft ? (
                        <div className="mt-4 border-t border-border pt-3">
                          <p className="mb-2 text-xs font-medium">{draft.subject}</p>
                          <DraftSendButton
                            eventId={event._id}
                            draft={draft}
                            venueName={venue.name}
                            recipient={
                              venue.contactType === "email" ? venue.contactValue : null
                            }
                            sendToken={sendToken}
                          />
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center py-14 text-center lg:py-8">
              <span className="flex size-11 items-center justify-center rounded bg-secondary text-muted-foreground">
                <Search className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-sm font-semibold">
                {event.researchStage === "failed" ? "Research needs attention" : "Researching venues"}
              </h3>
              <p className="mt-2 max-w-60 text-xs leading-5 text-muted-foreground">
                {event.researchError ??
                  "Firecrawl is gathering venue evidence before OpenAI and the verifier review the shortlist."}
              </p>
            </div>
          )}

          <RejectedCandidates candidates={rejectedCandidates} />

          <div className="rounded border border-border bg-secondary p-3.5">
            <p className="flex items-center gap-2 text-xs font-medium">
              <ShieldCheck className="size-4 text-clay" aria-hidden="true" />
              AgentMail sends only after your confirmation.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
