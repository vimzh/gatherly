// Shows the live agent handoffs while Convex researches an event.
import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Brain,
  Check,
  Circle,
  ClipboardCheck,
  LoaderCircle,
  ScanSearch,
  Search,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Event = Doc<"events">;
type AgentStage = NonNullable<Event["agentStage"]>;
type StageState = "completed" | "active" | "queued" | "failed";

const agentStages: Array<{
  key: AgentStage;
  agent: string;
  task: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    key: "planning",
    agent: "Planner",
    task: "Reads the brief",
    description: "Locks the location, attendance, event type, and must-haves.",
    icon: Brain,
  },
  {
    key: "discovering",
    agent: "Scout",
    task: "Finds candidates",
    description: "Searches public venue sources without narrowing too early.",
    icon: Search,
  },
  {
    key: "enriching",
    agent: "Evidence agent",
    task: "Checks the facts",
    description: "Collects capacity, contacts, images, reviews, and source pages.",
    icon: ScanSearch,
  },
  {
    key: "synthesizing",
    agent: "Researcher",
    task: "Builds the shortlist",
    description: "Ranks useful options and drafts careful venue enquiries.",
    icon: ClipboardCheck,
  },
  {
    key: "critiquing",
    agent: "Critic",
    task: "Challenges the shortlist",
    description: "Finds unsupported claims, weak fits, and unsafe assumptions.",
    icon: ShieldCheck,
  },
  {
    key: "verifying",
    agent: "Verifier",
    task: "Runs final checks",
    description: "Checks every source, handoff, capacity claim, and draft.",
    icon: BadgeCheck,
  },
];

const activityLabels: Record<Event["activities"][number]["state"], string> = {
  queued: "Waiting",
  active: "Working",
  completed: "Done",
  failed: "Stopped",
  approval_required: "Your review",
};

function StageMarker({ state }: { state: StageState }) {
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
  return <Circle className="size-3" aria-hidden="true" />;
}

function readableResearchError(value: string | undefined) {
  if (!value) {
    return "Research could not finish. Check the configured providers and try again.";
  }
  const providerMessage = value.match(/"message":"([^"]+)"/)?.[1];
  return (providerMessage ?? value).split("\n")[0].slice(0, 300);
}

export function ResearchProgress({ event }: { event: Event }) {
  const currentIndex = Math.max(
    0,
    agentStages.findIndex((stage) => stage.key === event.agentStage),
  );
  const currentStage = agentStages[currentIndex];
  const failed = event.researchStage === "failed";
  const progress = Math.round(
    ((currentIndex + (failed ? 0 : 0.5)) / agentStages.length) * 100,
  );

  function stageState(index: number): StageState {
    if (index < currentIndex) return "completed";
    if (index === currentIndex) return failed ? "failed" : "active";
    return "queued";
  }

  return (
    <main className="min-h-svh px-4 py-5 sm:px-6 sm:py-7">
      <div className="mx-auto flex min-h-[calc(100svh-2.5rem)] max-w-6xl flex-col sm:min-h-[calc(100svh-3.5rem)]">
        <header className="flex items-center justify-between border-b border-border pb-4">
          <Link
            href="/"
            className="text-sm font-semibold tracking-[-0.02em] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Gatherly
          </Link>
          <span className="text-xs text-muted-foreground">Live event workspace</span>
        </header>

        <section aria-live="polite" className="border-b border-border py-9 sm:py-12">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(16rem,0.75fr)] lg:items-end">
            <div>
              <Badge
                variant="outline"
                className={cn(
                  "gap-2 font-medium",
                  failed ? "text-destructive" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    failed ? "bg-destructive" : "bg-clay",
                  )}
                  aria-hidden="true"
                />
                {failed ? "Research needs attention" : "Live research in progress"}
              </Badge>
              <h1 className="mt-5 max-w-3xl text-3xl font-semibold tracking-[-0.045em] sm:text-5xl sm:leading-[1.05]">
                {failed
                  ? "Research stopped before the shortlist was ready."
                  : "Gatherly is sourcing your venue."}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
                {failed
                  ? readableResearchError(event.researchError)
                  : "Six focused agents hand the work forward. This page updates as each one finishes."}
              </p>
            </div>

            <div className="border-l-2 border-foreground pl-5">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {failed ? "Stopped at" : "Working now"}
              </p>
              <p className="mt-2 text-xl font-semibold tracking-[-0.025em]">
                {currentStage.agent}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{currentStage.task}</p>
              <p className="mt-4 text-xs font-medium">
                Step {currentIndex + 1} of {agentStages.length}
              </p>
            </div>
          </div>

          <div
            className="mt-8 h-1 overflow-hidden rounded-full bg-secondary"
            role="progressbar"
            aria-label="Venue research progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div
              className={cn("h-full bg-foreground", failed && "bg-destructive")}
              style={{ width: `${Math.max(progress, 4)}%` }}
            />
          </div>
        </section>

        <section className="py-8" aria-labelledby="agent-handoffs-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Research team
              </p>
              <h2 id="agent-handoffs-title" className="mt-2 text-xl font-semibold tracking-[-0.025em]">
                Agent handoffs
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              {currentIndex} complete · {failed ? "research stopped" : "1 working"}
            </p>
          </div>

          <ol className="mt-5 grid gap-px overflow-hidden rounded border border-border bg-border sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {agentStages.map((stage, index) => {
              const state = stageState(index);
              const Icon = stage.icon;
              return (
                <li
                  key={stage.key}
                  className={cn(
                    "min-h-48 bg-card p-4",
                    state === "active" && "bg-secondary",
                    state === "failed" && "bg-destructive/5",
                  )}
                  aria-current={state === "active" || state === "failed" ? "step" : undefined}
                >
                  <div className="flex items-center justify-between gap-3">
                    <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                    <span
                      className={cn(
                        "flex size-7 items-center justify-center rounded border",
                        state === "completed" &&
                          "border-foreground bg-foreground text-primary-foreground",
                        state === "active" && "border-foreground text-foreground",
                        state === "queued" && "border-border text-muted-foreground",
                        state === "failed" &&
                          "border-destructive/40 text-destructive",
                      )}
                    >
                      <StageMarker state={state} />
                    </span>
                  </div>
                  <p className="mt-7 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    {state === "completed"
                      ? "Done"
                      : state === "active"
                        ? "Working"
                        : state === "failed"
                          ? "Stopped"
                          : "Waiting"}
                  </p>
                  <h3 className="mt-2 text-sm font-semibold">{stage.agent}</h3>
                  <p className="mt-1 text-xs font-medium">{stage.task}</p>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    {stage.description}
                  </p>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="grid gap-3 border-t border-border py-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)]">
          <div className="rounded border border-border bg-card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
              <h2 className="text-sm font-semibold">Live actions</h2>
              <span className="text-xs text-muted-foreground">Updates automatically</span>
            </div>
            <ol className="divide-y divide-border">
              {event.activities.map((activity) => (
                <li
                  key={activity.key}
                  className="grid grid-cols-[1.75rem_1fr] gap-3 py-4 sm:grid-cols-[1.75rem_1fr_auto]"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-7 items-center justify-center rounded border",
                      activity.state === "completed" &&
                        "border-foreground bg-foreground text-primary-foreground",
                      activity.state === "active" && "border-foreground",
                      activity.state === "queued" && "text-muted-foreground",
                      activity.state === "failed" && "text-destructive",
                    )}
                  >
                    <StageMarker
                      state={
                        activity.state === "approval_required"
                          ? "queued"
                          : activity.state
                      }
                    />
                  </span>
                  <div>
                    <h3 className="text-sm font-medium">{activity.label}</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {activity.state === "failed"
                        ? readableResearchError(activity.description)
                        : activity.description}
                    </p>
                  </div>
                  <span className="col-start-2 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:col-start-auto sm:pt-1">
                    {activityLabels[activity.state]}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <aside className="flex flex-col rounded border border-border bg-card p-5 sm:p-6">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Your brief
            </p>
            <h2 className="mt-3 text-lg font-semibold tracking-[-0.025em]">{event.title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{event.brief}</p>
            <div className="mt-auto border-t border-border pt-5">
              <p className="flex items-start gap-2 text-xs leading-5">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                AgentMail sends only after your confirmation.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
