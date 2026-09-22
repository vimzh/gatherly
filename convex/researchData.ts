// Persists reviewed venue research and exposes the client read contract.
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalMutation,
  query,
} from "./_generated/server";
import {
  agentStage,
  criticismIssue,
  outreachDraftFields,
  rejectedCandidate,
  rejectedVenueFields,
  researchPlan,
  verificationCheck,
  venueFields,
} from "./schema";

type AgentStage =
  | "planning"
  | "discovering"
  | "enriching"
  | "synthesizing"
  | "critiquing"
  | "verifying";

export const RESEARCH_WATCHDOG_MS = 9 * 60_000;

const agentStageOrder: AgentStage[] = [
  "planning",
  "discovering",
  "enriching",
  "synthesizing",
  "critiquing",
  "verifying",
];

const runningActivities = [
  {
    key: "brief",
    label: "Understanding the brief",
    description: "Gatherly extracted the event requirements for venue research.",
    state: "completed" as const,
  },
  {
    key: "search",
    label: "Searching venue sources",
    description: "Firecrawl is searching and scraping venue, image, review, and contact sources.",
    state: "active" as const,
  },
  {
    key: "capacity",
    label: "Checking capacity and requirements",
    description: "Queued until venue evidence is collected.",
    state: "queued" as const,
  },
  {
    key: "contacts",
    label: "Finding public contact routes",
    description: "Queued until candidate venues are identified.",
    state: "queued" as const,
  },
  {
    key: "shortlist",
    label: "Critiquing and verifying the shortlist",
    description: "An independent model review and deterministic checks run before results appear.",
    state: "queued" as const,
  },
  {
    key: "outreach",
    label: "Drafting outreach",
    description: "AgentMail-ready drafts are prepared for organizer review.",
    state: "queued" as const,
  },
  {
    key: "approval",
    label: "Waiting for organizer approval",
    description: "Nothing sends until the organizer confirms a specific draft.",
    state: "queued" as const,
  },
];

const stageConfiguration: Record<
  AgentStage,
  { active: string[]; completed: string[]; descriptions: Record<string, string> }
> = {
  planning: {
    active: ["brief"],
    completed: [],
    descriptions: {
      brief: "The planning agent is extracting the location, attendance, event type, and constraints.",
    },
  },
  discovering: {
    active: ["search"],
    completed: ["brief"],
    descriptions: {
      search: "The discovery agent is selecting concrete venue candidates from Firecrawl results.",
    },
  },
  enriching: {
    active: ["capacity", "contacts"],
    completed: ["brief", "search"],
    descriptions: {
      capacity: "Evidence agents are checking capacity, facilities, images, and public reviews.",
      contacts: "Evidence agents are verifying official sites and public contact routes.",
    },
  },
  synthesizing: {
    active: ["shortlist"],
    completed: ["brief", "search", "capacity", "contacts"],
    descriptions: {
      shortlist: "The research agent is building a sourced shortlist and safe outreach drafts.",
    },
  },
  critiquing: {
    active: ["shortlist"],
    completed: ["brief", "search", "capacity", "contacts"],
    descriptions: {
      shortlist: "The critic agent is challenging every claim and correcting or removing weak candidates.",
    },
  },
  verifying: {
    active: ["shortlist"],
    completed: ["brief", "search", "capacity", "contacts"],
    descriptions: {
      shortlist: "The verifier is enforcing source, capacity, contact, coordination, and outreach-safety checks.",
    },
  },
};

function activitiesForStage(stage: AgentStage) {
  const configuration = stageConfiguration[stage];
  return runningActivities.map((activity) => ({
    ...activity,
    description: configuration.descriptions[activity.key] ?? activity.description,
    state: configuration.active.includes(activity.key)
      ? ("active" as const)
      : configuration.completed.includes(activity.key)
        ? ("completed" as const)
        : ("queued" as const),
  }));
}

const completedActivities = runningActivities.map((activity, index) => ({
  ...activity,
  description:
    index === 4
      ? "The critic reviewed the shortlist and all deterministic checks passed."
      : activity.description,
  state: index === 6 ? ("approval_required" as const) : ("completed" as const),
}));

export const begin = internalMutation({
  args: {
    eventId: v.id("events"),
    sendToken: v.optional(v.string()),
  },
  returns: v.union(v.object({ brief: v.string(), attemptId: v.string() }), v.null()),
  handler: async (ctx, { eventId, sendToken }) => {
    const event = await ctx.db.get(eventId);
    if (sendToken !== undefined && (!event?.sendToken || event.sendToken !== sendToken)) {
      throw new ConvexError("This event link is not authorized to start research.");
    }
    if (!event || event.researchStage === "running" || event.status === "review_ready") {
      return null;
    }

    const attemptId = crypto.randomUUID();
    await ctx.db.patch(eventId, {
      status: "researching",
      researchStage: "running",
      researchAttemptId: attemptId,
      agentStage: "planning",
      agentTrace: ["planning"],
      researchError: undefined,
      researchQuery: undefined,
      aiReview: undefined,
      activities: activitiesForStage("planning"),
    });
    // A separate durable mutation survives termination of the action's worker.
    await ctx.scheduler.runAfter(RESEARCH_WATCHDOG_MS, internal.researchData.fail, {
      eventId,
      attemptId,
      message: "Venue research stopped before completion. Please try again.",
    });
    return { brief: event.brief, attemptId };
  },
});

export const setAgentStage = internalMutation({
  args: { eventId: v.id("events"), attemptId: v.string(), stage: agentStage },
  returns: v.null(),
  handler: async (ctx, { eventId, attemptId, stage }) => {
    const event = await ctx.db.get(eventId);
    if (!event || event.researchStage !== "running" || event.researchAttemptId !== attemptId) return null;
    if (event.agentStage === stage) return null;
    const currentIndex = event.agentStage
      ? agentStageOrder.indexOf(event.agentStage)
      : -1;
    if (agentStageOrder.indexOf(stage) !== currentIndex + 1) {
      throw new ConvexError("Agent stage handoff is out of order.");
    }
    await ctx.db.patch(eventId, {
      agentStage: stage,
      agentTrace: [...(event.agentTrace ?? []), stage],
      activities: activitiesForStage(stage),
    });
    return null;
  },
});

export const recordSearchQuery = internalMutation({
  args: { eventId: v.id("events"), attemptId: v.string(), researchQuery: v.string() },
  returns: v.null(),
  handler: async (ctx, { eventId, attemptId, researchQuery }) => {
    const event = await ctx.db.get(eventId);
    if (!event || event.researchStage !== "running" || event.researchAttemptId !== attemptId) return null;
    await ctx.db.patch(eventId, { researchQuery });
    return null;
  },
});

export const complete = internalMutation({
  args: {
    eventId: v.id("events"),
    attemptId: v.string(),
    model: v.string(),
    plan: researchPlan,
    rejectedCandidates: v.array(rejectedCandidate),
    reviewSummary: v.string(),
    issues: v.array(criticismIssue),
    verification: v.array(verificationCheck),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event || event.researchStage !== "running" || event.researchAttemptId !== args.attemptId) return null;

    const existingVenue = await ctx.db
      .query("venues")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .first();
    if (existingVenue) return null;

    for (const venue of args.plan.venues) {
      const venueId = await ctx.db.insert("venues", {
        eventId: args.eventId,
        name: venue.name,
        location: venue.location,
        websiteUrl: venue.websiteUrl,
        address: venue.address,
        fitSummary: venue.fitSummary,
        recommendationScore: venue.recommendationScore,
        recommendationReason: venue.recommendationReason,
        amenities: venue.amenities,
        accessibilityNotes: venue.accessibilityNotes,
        pricingNotes: venue.pricingNotes,
        capacityMaximum: venue.capacity.maximum,
        capacityNotes: venue.capacity.notes,
        capacitySourceUrl: venue.capacity.sourceUrl,
        contactType: venue.contact.type,
        contactValue: venue.contact.value,
        contactSourceUrl: venue.contact.sourceUrl,
        evidence: venue.evidence,
        images: venue.images,
        reviews: venue.reviews,
      });
      await ctx.db.insert("outreachDrafts", {
        eventId: args.eventId,
        venueId,
        subject: venue.outreach.subject,
        body: venue.outreach.body,
        status: "draft",
      });
    }

    for (const candidate of args.rejectedCandidates.slice(0, 10)) {
      await ctx.db.insert("rejectedVenues", {
        eventId: args.eventId,
        ...candidate,
      });
    }

    await ctx.db.patch(args.eventId, {
      title: args.plan.title,
      status: "review_ready",
      researchStage: "review_ready",
      agentStage: undefined,
      researchError: undefined,
      activities: completedActivities,
      aiReview: {
        model: args.model,
        summary: args.reviewSummary,
        issues: args.issues,
        verification: args.verification,
        completedAt: Date.now(),
      },
    });
    return null;
  },
});

export const fail = internalMutation({
  args: {
    eventId: v.id("events"),
    attemptId: v.string(),
    model: v.optional(v.string()),
    message: v.string(),
    reviewSummary: v.optional(v.string()),
    issues: v.optional(v.array(criticismIssue)),
    verification: v.optional(v.array(verificationCheck)),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event || event.researchStage !== "running" || event.researchAttemptId !== args.attemptId) return null;

    await ctx.db.patch(args.eventId, {
      status: "failed",
      researchStage: "failed",
      researchError: args.message.slice(0, 500),
      activities: event.activities.map((activity) =>
        activity.state === "active"
          ? {
              ...activity,
              description: args.message.slice(0, 500),
              state: "failed" as const,
            }
          : activity,
      ),
      aiReview:
        args.model && args.reviewSummary && args.issues && args.verification
          ? {
              model: args.model,
              summary: args.reviewSummary,
              issues: args.issues,
              verification: args.verification,
              completedAt: Date.now(),
            }
          : undefined,
    });
    return null;
  },
});

export const getByEvent = query({
  args: { eventId: v.id("events") },
  returns: v.union(
    v.object({
      venues: v.array(
        v.object({
          _id: v.id("venues"),
          _creationTime: v.number(),
          ...venueFields,
        }),
      ),
      drafts: v.array(
        v.object({
          _id: v.id("outreachDrafts"),
          _creationTime: v.number(),
          ...outreachDraftFields,
        }),
      ),
      rejectedCandidates: v.array(
        v.object({
          _id: v.id("rejectedVenues"),
          _creationTime: v.number(),
          ...rejectedVenueFields,
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, { eventId }) => {
    if (!(await ctx.db.get(eventId))) return null;
    const [venues, drafts, rejectedCandidates] = await Promise.all([
      ctx.db
        .query("venues")
        .withIndex("by_event", (q) => q.eq("eventId", eventId))
        .take(5),
      ctx.db
        .query("outreachDrafts")
        .withIndex("by_event", (q) => q.eq("eventId", eventId))
        .take(5),
      ctx.db
        .query("rejectedVenues")
        .withIndex("by_event", (q) => q.eq("eventId", eventId))
        .take(10),
    ]);
    return { venues, drafts, rejectedCandidates };
  },
});
