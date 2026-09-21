// Exposes the event creation and lookup contract used by the Gatherly frontend.
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { eventFields } from "./schema";

const initialActivities = [
  {
    key: "brief",
    label: "Understanding the brief",
    description: "Gatherly extracted the core event requirements.",
    state: "completed" as const,
  },
  {
    key: "search",
    label: "Searching venue sources",
    description: "Demo activity — live venue research is not connected yet.",
    state: "active" as const,
  },
  {
    key: "capacity",
    label: "Checking capacity and requirements",
    description: "Queued until venue sources are available.",
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
    label: "Building the shortlist",
    description: "Queued until venue evidence is collected.",
    state: "queued" as const,
  },
  {
    key: "outreach",
    label: "Drafting outreach",
    description: "No email will be sent without organizer approval.",
    state: "queued" as const,
  },
  {
    key: "approval",
    label: "Waiting for organizer approval",
    description: "Every outbound draft remains paused until you approve it.",
    state: "queued" as const,
  },
];

export const create = mutation({
  args: { brief: v.string(), requestKey: v.string() },
  returns: v.id("events"),
  handler: async (ctx, { brief: rawBrief, requestKey }) => {
    const existing = await ctx.db
      .query("events")
      .withIndex("by_request_key", (q) => q.eq("requestKey", requestKey))
      .unique();
    if (existing) return existing._id;

    const brief = rawBrief.trim();
    if (!brief) {
      throw new ConvexError("Describe the event before starting a search.");
    }
    if (brief.length > 4000) {
      throw new ConvexError("Event briefs must be 4,000 characters or fewer.");
    }

    const title = brief.length > 64 ? `${brief.slice(0, 61).trimEnd()}…` : brief;
    return ctx.db.insert("events", {
      brief,
      title,
      requestKey,
      status: "researching",
      isDemo: true,
      activities: initialActivities,
    });
  },
});

export const get = query({
  args: { eventId: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("events"),
      _creationTime: v.number(),
      ...eventFields,
    }),
    v.null(),
  ),
  handler: async (ctx, { eventId }) => {
    const normalizedId = ctx.db.normalizeId("events", eventId);
    return normalizedId ? ctx.db.get(normalizedId) : null;
  },
});
