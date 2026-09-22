// Shows a simulated organizer inbox for the completed Bengaluru venue demo.
"use client";

import {
  ArrowLeft,
  Building2,
  Check,
  CircleAlert,
  Clock3,
  Inbox,
  Mail,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  BENGALURU_DEMO_EVENT_ID,
  eventHref,
} from "@/lib/event-navigation";
import { cn } from "@/lib/utils";
import { CopyEventId } from "./copy-event-id";

type ThreadStatus = "replied" | "waiting" | "follow_up" | "draft";

type DemoThread = {
  id: string;
  venue: string;
  status: ThreadStatus;
  statusLabel: string;
  updatedAt: string;
  preview: string;
  summary: string;
  facts: Array<{ label: string; value: string }>;
  openQuestions: string[];
  messages: Array<{
    sender: string;
    direction: "outbound" | "inbound";
    time: string;
    body: string;
  }>;
  nextDraft: string;
};

const threads: DemoThread[] = [
  {
    id: "mlr",
    venue: "MLR Convention Centre",
    status: "replied",
    statusLabel: "Replied",
    updatedAt: "2h ago",
    preview: "Capacity and AV look workable. The venue needs an exact date.",
    summary:
      "Promising reply. The venue says it can configure a hall for 200 people and provide projection plus vegetarian catering. Gatherly still needs the exact date, Wi-Fi details, and a step-free access confirmation.",
    facts: [
      { label: "Capacity", value: "200-person layout indicated" },
      { label: "Availability", value: "Exact date required" },
      { label: "AV", value: "Projector and screen offered" },
      { label: "Catering", value: "Vegetarian menu offered" },
    ],
    openQuestions: ["Wi-Fi bandwidth", "Step-free route", "Final quote"],
    messages: [
      {
        sender: "You",
        direction: "outbound",
        time: "Yesterday, 4:42 PM",
        body: "We’re planning an evening developer meetup for 200 people in Bengaluru, running from 5 PM to 10 PM. Could you confirm a suitable room, reliable Wi-Fi, projection, step-free entry, vegetarian catering, and indicative pricing?",
      },
      {
        sender: "MLR events team",
        direction: "inbound",
        time: "Today, 10:18 AM",
        body: "Thanks for reaching out. We can configure one of our halls for approximately 200 guests and arrange a projector, screen, and vegetarian catering. Please share your preferred date so we can check availability and prepare a quote. Wi-Fi requirements can be reviewed with the event package.",
      },
    ],
    nextDraft:
      "Thanks for the details. Our preferred date is [add date], from 5 PM to 10 PM. Could you also confirm the available Wi-Fi bandwidth, the step-free route into the hall, and an itemized quote for the room, AV, and vegetarian catering?",
  },
  {
    id: "taj",
    venue: "Taj West End, Bengaluru",
    status: "waiting",
    statusLabel: "Awaiting reply",
    updatedAt: "Yesterday",
    preview: "Initial enquiry sent. No venue response yet.",
    summary:
      "The initial enquiry is delivered and still within the normal response window. Gatherly would wait two business days before preparing a follow-up.",
    facts: [
      { label: "Capacity", value: "Public source supports 200+" },
      { label: "Availability", value: "Awaiting reply" },
      { label: "AV", value: "Asked in outreach" },
      { label: "Catering", value: "Asked in outreach" },
    ],
    openQuestions: ["Availability", "Wi-Fi", "Accessibility", "Quote"],
    messages: [
      {
        sender: "You",
        direction: "outbound",
        time: "Yesterday, 5:06 PM",
        body: "Could you confirm a suitable event space for a 200-person Bengaluru developer meetup, including evening availability, Wi-Fi, projection, step-free access, vegetarian catering, and pricing?",
      },
    ],
    nextDraft:
      "Following up on our venue enquiry for a 200-person developer meetup. Could you let us know whether a suitable event space is available and who can help with a detailed proposal?",
  },
  {
    id: "bic",
    venue: "Bangalore International Centre",
    status: "follow_up",
    statusLabel: "Needs follow-up",
    updatedAt: "3h ago",
    preview: "The venue asked for the event date and seating format.",
    summary:
      "The venue responded but has not confirmed capacity or availability. The organizer needs to supply an exact date and preferred seating format before Gatherly can compare this option.",
    facts: [
      { label: "Capacity", value: "Not confirmed" },
      { label: "Availability", value: "Date needed" },
      { label: "AV", value: "Not answered" },
      { label: "Catering", value: "In-house option mentioned" },
    ],
    openQuestions: ["Exact capacity", "Seating layout", "AV package", "Step-free access"],
    messages: [
      {
        sender: "You",
        direction: "outbound",
        time: "Yesterday, 4:51 PM",
        body: "We’re looking for a Bengaluru venue for a 200-person evening developer meetup. Could you confirm capacity, availability, AV, Wi-Fi, accessibility, vegetarian catering, and pricing?",
      },
      {
        sender: "BIC programmes team",
        direction: "inbound",
        time: "Today, 9:12 AM",
        body: "Please send the event date, preferred seating format, and a short programme note. Once we have those details, our team can confirm which space may be suitable and share the applicable venue information.",
      },
    ],
    nextDraft:
      "Thanks for getting back to us. The event is planned for [add date], from 5 PM to 10 PM, with theatre-style seating for 200. Could you confirm whether a suitable space is available and share the AV, Wi-Fi, accessibility, catering, and pricing details?",
  },
  {
    id: "ritz",
    venue: "The Ritz-Carlton, Bangalore",
    status: "draft",
    statusLabel: "Draft ready",
    updatedAt: "Not sent",
    preview: "A contact-form enquiry is ready for organizer review.",
    summary:
      "Gatherly found a public contact form and prepared an enquiry, but nothing has been submitted. The organizer would review the message and choose whether to send it.",
    facts: [
      { label: "Capacity", value: "Public source supports 200+" },
      { label: "Availability", value: "Not requested yet" },
      { label: "Contact", value: "Public enquiry form" },
      { label: "State", value: "Waiting for approval" },
    ],
    openQuestions: ["Availability", "Wi-Fi", "Accessibility", "Catering", "Quote"],
    messages: [],
    nextDraft:
      "We’re planning an evening developer meetup in Bengaluru for approximately 200 people, from 5 PM to 10 PM. Could you confirm a suitable event space, reliable Wi-Fi, projection, step-free access, vegetarian catering, availability, and indicative pricing?",
  },
];

const statusStyles: Record<ThreadStatus, string> = {
  replied: "border-[#a8c5a4] bg-[#e6f0e2] text-[#315b39]",
  waiting: "border-[#b8cbd2] bg-[#e8f0f3] text-[#3f6875]",
  follow_up: "border-[#dac79e] bg-[#f4ecd8] text-[#795f24]",
  draft: "border-[#d6d2ca] bg-[#efede8] text-[#66615a]",
};

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0 px-3 py-2 first:pl-0">
      <p className="text-lg font-semibold tracking-[-0.03em]">{value}</p>
      <p className="text-[0.68rem] text-muted-foreground">{label}</p>
    </div>
  );
}

export function DemoOutreachInbox() {
  const [selectedId, setSelectedId] = useState(threads[0].id);
  const selected = threads.find((thread) => thread.id === selectedId) ?? threads[0];

  return (
    <main className="min-h-svh bg-[#f3f1ec]">
      <div className="mx-auto grid min-h-svh max-w-[96rem] lg:grid-cols-[14rem_20rem_minmax(0,1fr)] lg:border-x lg:border-[#dedbd4]">
        <aside className="flex flex-col border-b border-[#e3d3bd] bg-[#f8f0e4] p-4 lg:sticky lg:top-0 lg:h-svh lg:border-r lg:border-b-0 lg:p-5">
          <Link
            href="/"
            className="text-sm font-semibold tracking-[-0.02em] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Gatherly
          </Link>
          <div className="mt-8 border-b border-[#e3d3bd] pb-5">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#8a6338]">
              Event
            </p>
            <h1 className="mt-2 text-base font-semibold leading-6 tracking-[-0.02em]">
              Bengaluru developer meetup
            </h1>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              200 attendees · 5 PM–10 PM
            </p>
            <div className="mt-3">
              <CopyEventId eventId={BENGALURU_DEMO_EVENT_ID} />
            </div>
          </div>
          <nav className="mt-4" aria-label="Event workspace">
            <ul className="space-y-1">
              <li>
                <a
                  href={eventHref(BENGALURU_DEMO_EVENT_ID)}
                  className="flex items-center gap-2.5 rounded px-2.5 py-2 text-sm text-muted-foreground hover:bg-[#eee1cf] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Building2 className="size-4" aria-hidden="true" />
                  Venue results
                </a>
              </li>
              <li>
                <span
                  className="flex items-center gap-2.5 rounded bg-[#e7dfd2] px-2.5 py-2 text-sm font-medium"
                  aria-current="page"
                >
                  <Inbox className="size-4" aria-hidden="true" />
                  Outreach inbox
                </span>
              </li>
            </ul>
          </nav>
          <div className="mt-6 border-l-2 border-[#cfb577] bg-[#f4ecd8] px-3 py-2.5 text-xs leading-5 text-[#675322]">
            Preview data. These messages illustrate the workflow; no email was sent.
          </div>
        </aside>

        <section className="border-b border-[#d9d6cf] bg-[#f7f6f2] lg:h-svh lg:overflow-y-auto lg:border-r lg:border-b-0" aria-labelledby="inbox-title">
          <header className="border-b border-[#d9d6cf] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Organizer inbox
                </p>
                <h2 id="inbox-title" className="mt-1 text-xl font-semibold tracking-[-0.03em]">
                  Outreach
                </h2>
              </div>
              <Badge variant="outline" className="border-[#dac79e] bg-[#f4ecd8] text-[#795f24]">
                Preview data
              </Badge>
            </div>
            <div className="mt-4 grid grid-cols-4 divide-x divide-[#d9d6cf] border-t border-[#d9d6cf] pt-2">
              <Stat value="4" label="venues" />
              <Stat value="3" label="sent" />
              <Stat value="2" label="replies" />
              <Stat value="2" label="actions" />
            </div>
          </header>
          <ul className="divide-y divide-[#d9d6cf]" aria-label="Venue outreach threads">
            {threads.map((thread) => (
              <li key={thread.id}>
                <button
                  type="button"
                  aria-pressed={thread.id === selected.id}
                  onClick={() => setSelectedId(thread.id)}
                  className={cn(
                    "w-full px-4 py-4 text-left transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50",
                    thread.id === selected.id && "bg-white",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold">{thread.venue}</p>
                    <span className="shrink-0 text-[0.68rem] text-muted-foreground">
                      {thread.updatedAt}
                    </span>
                  </div>
                  <Badge variant="outline" className={cn("mt-2 text-[0.64rem]", statusStyles[thread.status])}>
                    {thread.statusLabel}
                  </Badge>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {thread.preview}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="min-w-0 bg-white lg:h-svh lg:overflow-y-auto" aria-labelledby="thread-title">
          <header className="border-b border-[#d9d6cf] px-4 py-4 sm:px-6">
            <a
              href={eventHref(BENGALURU_DEMO_EVENT_ID)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline underline-offset-4 lg:hidden"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Venue results
            </a>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 lg:mt-0">
              <div>
                <h2 id="thread-title" className="text-xl font-semibold tracking-[-0.03em]">
                  {selected.venue}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Bengaluru developer meetup · AgentMail thread preview
                </p>
              </div>
              <Badge variant="outline" className={statusStyles[selected.status]}>
                {selected.statusLabel}
              </Badge>
            </div>
          </header>

          <div className="px-4 py-5 sm:px-6">
            <section className="border-l-2 border-[#9db88d] bg-[#edf4e9] px-4 py-3" aria-labelledby="summary-title">
              <div className="flex items-center gap-2 text-[#355a3d]">
                <Check className="size-4" aria-hidden="true" />
                <h3 id="summary-title" className="text-sm font-semibold">Organizer summary</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#425b46]">{selected.summary}</p>
            </section>

            <dl className="mt-4 grid border-y border-[#ddd9d1] sm:grid-cols-2">
              {selected.facts.map((fact) => (
                <div key={fact.label} className="border-b border-[#ece9e3] py-3 last:border-b-0 sm:odd:border-r sm:odd:pr-4 sm:even:pl-4">
                  <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {fact.label}
                  </dt>
                  <dd className="mt-1 text-sm font-medium">{fact.value}</dd>
                </div>
              ))}
            </dl>

            <section className="mt-4" aria-labelledby="questions-title">
              <div className="flex items-center gap-2">
                <CircleAlert className="size-4 text-[#8a6b2d]" aria-hidden="true" />
                <h3 id="questions-title" className="text-sm font-semibold">Still unanswered</h3>
              </div>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {selected.openQuestions.map((question) => (
                  <li key={question} className="rounded border border-[#dac79e] bg-[#faf5e8] px-2 py-1 text-xs text-[#715b29]">
                    {question}
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-6" aria-labelledby="conversation-title">
              <div className="flex items-center justify-between border-b border-[#ddd9d1] pb-2">
                <h3 id="conversation-title" className="text-sm font-semibold">Conversation</h3>
                <span className="flex items-center gap-1 text-[0.68rem] text-muted-foreground">
                  <Clock3 className="size-3" aria-hidden="true" />
                  Conversation timeline
                </span>
              </div>
              {selected.messages.length > 0 ? (
                <div className="divide-y divide-[#ece9e3]">
                  {selected.messages.map((message) => (
                    <article key={`${message.sender}-${message.time}`} className="grid gap-2 py-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
                      <div>
                        <p className="text-xs font-semibold">{message.sender}</p>
                        <p className="mt-1 text-[0.68rem] text-muted-foreground">{message.time}</p>
                        <p className={cn(
                          "mt-2 inline-flex items-center gap-1 text-[0.64rem] font-semibold uppercase tracking-[0.08em]",
                          message.direction === "inbound" ? "text-[#315b39]" : "text-[#4a6670]",
                        )}>
                          {message.direction === "inbound" ? <Mail className="size-3" aria-hidden="true" /> : <Send className="size-3" aria-hidden="true" />}
                          {message.direction === "inbound" ? "Received" : "Sent"}
                        </p>
                      </div>
                      <p className={cn(
                        "border-l-2 px-3 py-2 text-sm leading-6",
                        message.direction === "inbound"
                          ? "border-[#a8c5a4] bg-[#f3f7f1]"
                          : "border-[#b8cbd2] bg-[#f3f7f8]",
                      )}>
                        {message.body}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="py-5 text-sm text-muted-foreground">
                  No messages yet. The first enquiry is ready for review.
                </p>
              )}
            </section>

            <section className="mt-2 border-t border-[#ddd9d1] pt-4" aria-labelledby="draft-title">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 id="draft-title" className="text-sm font-semibold">Suggested next reply</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Gatherly drafts the next step; the organizer reviews every send.
                  </p>
                </div>
                <Badge variant="outline">Approval required</Badge>
              </div>
              <Textarea
                readOnly
                value={selected.nextDraft}
                aria-label="Suggested reply"
                className="mt-3 min-h-32 resize-none bg-[#faf9f6] text-sm leading-6"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-[0.68rem] text-muted-foreground">Read-only preview.</p>
                <Button type="button" disabled size="sm">
                  <Send aria-hidden="true" />
                  Preview only
                </Button>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
