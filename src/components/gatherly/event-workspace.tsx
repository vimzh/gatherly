// Presents live venue research and organizer-confirmed AgentMail outreach.
"use client";

import { useAction } from "convex/react";
import {
  Building2,
  Inbox,
  Mail,
  ExternalLink,
  MapPin,
  Search,
  ShieldCheck,
  Star,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { eventInboxHref } from "@/lib/event-navigation";
import type { ProviderCredentials } from "@/lib/provider-credentials";
import { cn } from "@/lib/utils";
import { CopyEventId } from "./copy-event-id";
import { ResearchProgress } from "./research-progress";

type ResearchResult =
  | {
      venues: Doc<"venues">[];
      drafts: Doc<"outreachDrafts">[];
      rejectedCandidates: Doc<"rejectedVenues">[];
    }
  | null
  | undefined;

const workspaceLinks = [
  { label: "Venues", icon: Building2, target: "venues-title" },
  { label: "Outreach", icon: Mail, target: "outreach" },
];

function OutreachComposer({
  eventId,
  draft,
  venueName,
  recipient,
  sendToken,
  providerCredentials,
  isDemo,
}: {
  eventId: Id<"events">;
  draft: Doc<"outreachDrafts">;
  venueName: string;
  recipient: string | null;
  sendToken: string | null;
  providerCredentials: ProviderCredentials | null;
  isDemo: boolean;
}) {
  const sendDraft = useAction(api.outreach.sendDraft);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [error, setError] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const previewId = `outreach-preview-${draft._id}`;
  const editingLocked = Boolean(draft.sendAttemptedAt);

  if (sent || draft.status === "sent") {
    return <span className="text-xs font-medium">Sent via AgentMail</span>;
  }

  async function send() {
    if (
      sendingRef.current ||
      sent ||
      !recipient ||
      !sendToken ||
      !providerCredentials
    ) {
      return;
    }
    const editedSubject = subject.trim();
    const editedBody = body.trim();
    if (!editedSubject || !editedBody) {
      setError("Subject and message are required before sending.");
      return;
    }
    if (!window.confirm(`Send this email to ${recipient} for ${venueName}?`)) return;
    sendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      await sendDraft({
        eventId,
        draftId: draft._id,
        sendToken,
        agentMailApiKey: providerCredentials.agentMailApiKey,
        agentMailInboxId: providerCredentials.agentMailInboxId,
        ...(editingLocked ? {} : { subject: editedSubject, body: editedBody }),
      });
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AgentMail could not send this draft.");
    } finally {
      sendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="border-[#b8cdaa] bg-[#e3eee0] text-[#315b39] hover:bg-[#d8e7d4]"
        aria-controls={previewId}
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        {expanded ? "Hide outreach" : "Review outreach"}
      </Button>
      {expanded ? (
        <div
          id={previewId}
          className="mt-3 rounded border border-[#cbdde2] bg-[#f7fafb] p-3"
        >
          <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
            <div className="min-w-0 text-xs">
              <p className="font-medium">Email preview</p>
              <p className="mt-1 truncate text-muted-foreground">
                To: {recipient ?? "No public email found"}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={pending || !recipient || !sendToken || !providerCredentials}
              onClick={send}
            >
              {pending
                ? "Sending email"
                : draft.status === "sending" || draft.status === "failed"
                  ? "Retry send"
                  : "Send email"}
            </Button>
          </div>
          {!recipient || !sendToken || !providerCredentials ? (
            <p className="mt-2 text-xs text-destructive">
              {!recipient
                ? "A public email address is required for AgentMail."
                : isDemo
                  ? "This event is read-only. Start a live search with your own keys to send."
                  : !sendToken
                    ? "This read-only link cannot send outreach."
                    : "AgentMail credentials are missing from this browser session."}
            </p>
          ) : null}
          <label
            htmlFor={`${previewId}-subject`}
            className="mt-3 block text-xs font-medium"
          >
            Subject
          </label>
          <Input
            id={`${previewId}-subject`}
            className="mt-1 bg-white"
            value={subject}
            maxLength={200}
            disabled={editingLocked}
            onChange={(event) => setSubject(event.target.value)}
          />
          <label
            htmlFor={`${previewId}-body`}
            className="mt-3 block text-xs font-medium"
          >
            Message
          </label>
          <Textarea
            id={`${previewId}-body`}
            className="mt-1 h-56 min-h-48 field-sizing-fixed resize-y bg-white"
            value={body}
            maxLength={20_000}
            disabled={editingLocked}
            onChange={(event) => setBody(event.target.value)}
          />
          {editingLocked ? (
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Editing is locked after a send attempt so a retry uses the same message.
            </p>
          ) : null}
          {!pending && draft.status === "sending" ? (
            <p className="mt-2 text-xs text-muted-foreground">
              The previous send is unconfirmed. Retry this draft to reuse its original
              send key; attempts older than 24 hours need manual review.
            </p>
          ) : null}
          {error || (!pending && draft.status === "failed" && draft.sendError) ? (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {error ?? draft.sendError}
            </p>
          ) : null}
        </div>
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
            <article
              key={candidate._id}
              className="rounded border border-[#dfccc5] bg-[#f8efec] p-3"
            >
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
  providerCredentials,
}: {
  event: Omit<Doc<"events">, "requestKey" | "sendToken">;
  research: ResearchResult;
  sendToken: string | null;
  providerCredentials: ProviderCredentials | null;
}) {
  if (event.researchStage !== "review_ready") {
    return <ResearchProgress event={event} />;
  }

  const venues = research?.venues ?? [];
  const drafts = research?.drafts ?? [];
  const rejectedCandidates = research?.rejectedCandidates ?? [];

  return (
    <main className="min-h-svh bg-[#f3f1ec]">
      <div className="mx-auto grid min-h-svh max-w-[90rem] lg:grid-cols-[16rem_minmax(0,1fr)] lg:border-x lg:border-[#dedbd4]">
        <aside className="flex flex-col border-b border-[#e3d3bd] bg-[#f8f0e4] p-4 lg:border-r lg:border-b-0 lg:p-5">
          <Link
            href="/"
            className="w-fit text-sm font-semibold tracking-[-0.02em] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Gatherly
          </Link>

          <div className="mt-8 border-b border-border pb-5">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#8a6338]">
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
              {workspaceLinks
                .filter(({ label }) => label !== "Outreach" || drafts.length > 0)
                .map(({ label, icon: Icon, target }) => (
                  <li key={label}>
                    <a
                      href={`#${target}`}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-[#eee1cf] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      {label}
                    </a>
                  </li>
                ))}
              <li>
                <a
                  href={eventInboxHref(event._id, sendToken)}
                  className="flex items-center justify-between gap-2.5 rounded px-2.5 py-2 text-sm text-[#315b39] hover:bg-[#e6eadf] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex items-center gap-2.5">
                    <Inbox className="size-4" aria-hidden="true" />
                    Outreach inbox
                  </span>
                </a>
              </li>
            </ul>
          </nav>
        </aside>

        <section
          aria-labelledby="venues-title"
          className="flex min-w-0 flex-col bg-[#f1f6ef] px-4 py-5 sm:px-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <h2
              id="venues-title"
              className="text-xl font-semibold tracking-[-0.025em] text-[#355a3d]"
            >
              Venue results
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-muted-foreground">{venues.length} found</span>
              <CopyEventId eventId={event._id} />
            </div>
          </div>

          {venues.length > 0 ? (
            <div className="flex-1 divide-y divide-[#cad9c5]">
              {venues.map((venue, index) => {
                const draft = drafts.find((item) => item.venueId === venue._id);
                const image = venue.images?.[0];
                return (
                  <article
                    key={venue._id}
                    className={cn("py-4", index === 0 && "bg-[#eaf3e5]/60")}
                  >
                    <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
                      {image ? (
                        <a
                          href={image.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block overflow-hidden rounded border border-border bg-white"
                        >
                          {/* Firecrawl returns arbitrary HTTPS image hosts, so Next Image cannot safely predeclare them. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image.url}
                            alt={image.alt}
                            className="h-24 w-full object-cover sm:h-28"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        </a>
                      ) : (
                        <p className="flex h-24 items-center justify-center rounded border border-border bg-[#f4eee3] px-3 text-center text-xs text-muted-foreground sm:h-28">
                          No sourced image found.
                        </p>
                      )}
                      <div>
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
                      </div>
                    </div>
                    <div className="mt-3 border-t border-border pt-3">
                      {venue.recommendationScore !== undefined ? (
                        <div
                          className={cn(
                            "border-l-2 px-3 py-2.5",
                            index === 0
                              ? "border-[#9db88d] bg-[#deecd7]"
                              : "border-[#b9ced6] bg-[#edf3f5]",
                          )}
                        >
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
                          className="mt-3 border-l-2 border-[#d8c9aa] bg-[#f6f1e8] px-3 py-2.5"
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
                              className="rounded border border-[#d2dfcc] bg-[#f0f5ed] px-1.5 py-1 text-[0.68rem]"
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
                        <div
                          id={draft._id === drafts[0]?._id ? "outreach" : undefined}
                          className="mt-4 border-t border-border pt-3"
                        >
                          <OutreachComposer
                            key={draft._id}
                            eventId={event._id}
                            draft={draft}
                            venueName={venue.name}
                            recipient={
                              venue.contactType === "email" ? venue.contactValue : null
                            }
                            sendToken={sendToken}
                            providerCredentials={providerCredentials}
                            isDemo={event.isDemo}
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
              <span className="flex size-11 items-center justify-center rounded bg-[#dfeadd] text-[#45654b]">
                <Search className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-sm font-semibold">No verified venues found</h3>
              <p className="mt-2 max-w-60 text-xs leading-5 text-muted-foreground">
                The review finished without a venue that met the evidence checks.
              </p>
            </div>
          )}

          <RejectedCandidates candidates={rejectedCandidates} />

          <div className="border-t border-[#cbdde2] py-3">
            <p className="flex items-center gap-2 text-xs font-medium">
              <ShieldCheck className="size-4 text-[#4b7180]" aria-hidden="true" />
              AgentMail sends only after your confirmation.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
