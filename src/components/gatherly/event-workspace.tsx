// Presents one persisted event as a responsive sourcing workspace.
import {
  Building2,
  Check,
  Circle,
  Clock3,
  LoaderCircle,
  Mail,
  MailCheck,
  MessageSquareText,
  Search,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Activity = Doc<"events">["activities"][number];

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

export function EventWorkspace({ event }: { event: Doc<"events"> }) {
  const completedCount = event.activities.filter(
    (activity) => activity.state === "completed",
  ).length;

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
                Demo activity
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
            <span className="text-xs text-muted-foreground">0 found</span>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center py-14 text-center lg:py-8">
            <span className="flex size-11 items-center justify-center rounded bg-secondary text-muted-foreground">
              <Search className="size-5" aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-sm font-semibold">No venues yet</h3>
            <p className="mt-2 max-w-60 text-xs leading-5 text-muted-foreground">
              Live venue research will replace this demo activity once Firecrawl is connected.
            </p>
          </div>

          <div className="rounded border border-border bg-secondary p-3.5">
            <p className="flex items-center gap-2 text-xs font-medium">
              <ShieldCheck className="size-4 text-clay" aria-hidden="true" />
              Nothing sends without your approval.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
