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
    description: "Firecrawl venue, image, and review research is queued.",
    state: "queued" as const,
  },
  {
    key: "capacity",
    label: "Checking capacity and requirements",
    description: "Queued until public venue evidence is collected.",
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
    description: "Queued until the first research pass is complete.",
    state: "queued" as const,
  },
  {
    key: "outreach",
    label: "Drafting outreach",
    description: "AgentMail drafts are prepared for organizer review.",
    state: "queued" as const,
  },
  {
    key: "approval",
    label: "Waiting for organizer approval",
    description: "Nothing sends until the organizer confirms a specific draft.",
    state: "queued" as const,
  },
];

export const create = mutation({
  args: { brief: v.string(), requestKey: v.string() },
  returns: v.object({ eventId: v.id("events"), sendToken: v.string() }),
  handler: async (ctx, { brief: rawBrief, requestKey }) => {
    const existing = await ctx.db
      .query("events")
      .withIndex("by_request_key", (q) => q.eq("requestKey", requestKey))
      .unique();
    if (existing) {
      const sendToken = existing.sendToken ?? crypto.randomUUID();
      if (!existing.sendToken) await ctx.db.patch(existing._id, { sendToken });
      return { eventId: existing._id, sendToken };
    }

    const brief = rawBrief.trim();
    if (!brief) {
      throw new ConvexError("Describe the event before starting a search.");
    }
    if (brief.length > 4000) {
      throw new ConvexError("Event briefs must be 4,000 characters or fewer.");
    }

    const title = brief.length > 64 ? `${brief.slice(0, 61).trimEnd()}…` : brief;
    const sendToken = crypto.randomUUID();
    const eventId = await ctx.db.insert("events", {
      brief,
      title,
      requestKey,
      status: "researching",
      isDemo: false,
      activities: initialActivities,
      researchStage: "queued",
      sendToken,
    });
    return { eventId, sendToken };
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
    if (!normalizedId) return null;
    const event = await ctx.db.get(normalizedId);
    if (!event) return null;
    // The creation key can recover the send token through an idempotent retry.
    const { requestKey: _requestKey, sendToken: _sendToken, ...publicEvent } = event;
    void _requestKey;
    void _sendToken;
    return publicEvent;
  },
});
