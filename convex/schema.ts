// Defines the persistent records used by the Gatherly event workspace.
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const activityState = v.union(
  v.literal("queued"),
  v.literal("active"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("approval_required"),
);

export const activity = v.object({
  key: v.string(),
  label: v.string(),
  description: v.string(),
  state: activityState,
});

export const eventStatus = v.union(
  v.literal("researching"),
  v.literal("review_ready"),
  v.literal("failed"),
);

export const agentStage = v.union(
  v.literal("planning"),
  v.literal("discovering"),
  v.literal("enriching"),
  v.literal("synthesizing"),
  v.literal("critiquing"),
  v.literal("verifying"),
);

export const criticismIssue = v.object({
  severity: v.union(v.literal("warning"), v.literal("blocker")),
  venueName: v.union(v.string(), v.null()),
  field: v.string(),
  message: v.string(),
});

export const verificationCheck = v.object({
  key: v.string(),
  passed: v.boolean(),
  detail: v.string(),
});

const venueImage = v.object({
  url: v.string(),
  sourceUrl: v.string(),
  alt: v.string(),
});

const venueReview = v.object({
  sourceName: v.string(),
  rating: v.union(v.number(), v.null()),
  reviewCount: v.union(v.number(), v.null()),
  summary: v.string(),
  sourceUrl: v.string(),
});

export const eventFields = {
  brief: v.string(),
  title: v.string(),
  requestKey: v.string(),
  status: eventStatus,
  isDemo: v.boolean(),
  activities: v.array(activity),
  researchStage: v.optional(
    v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("review_ready"),
      v.literal("failed"),
    ),
  ),
  researchError: v.optional(v.string()),
  researchQuery: v.optional(v.string()),
  agentStage: v.optional(agentStage),
  agentTrace: v.optional(v.array(agentStage)),
  aiReview: v.optional(
    v.object({
      model: v.string(),
      summary: v.string(),
      issues: v.array(criticismIssue),
      verification: v.array(verificationCheck),
      completedAt: v.number(),
    }),
  ),
};

export const venueFields = {
  eventId: v.id("events"),
  name: v.string(),
  location: v.string(),
  websiteUrl: v.string(),
  address: v.optional(v.union(v.string(), v.null())),
  fitSummary: v.string(),
  recommendationScore: v.optional(v.number()),
  recommendationReason: v.optional(v.string()),
  amenities: v.optional(v.array(v.string())),
  accessibilityNotes: v.optional(v.union(v.string(), v.null())),
  pricingNotes: v.optional(v.union(v.string(), v.null())),
  capacityMaximum: v.union(v.number(), v.null()),
  capacityNotes: v.string(),
  capacitySourceUrl: v.union(v.string(), v.null()),
  contactType: v.union(
    v.literal("email"),
    v.literal("contact_form"),
    v.literal("phone"),
  ),
  contactValue: v.string(),
  contactSourceUrl: v.string(),
  evidence: v.array(
    v.object({
      claim: v.string(),
      sourceTitle: v.string(),
      sourceUrl: v.string(),
    }),
  ),
  images: v.optional(v.array(venueImage)),
  reviews: v.optional(v.array(venueReview)),
};

export const outreachDraftFields = {
  eventId: v.id("events"),
  venueId: v.id("venues"),
  subject: v.string(),
  body: v.string(),
  status: v.union(
    v.literal("draft"),
    v.literal("approved"),
    v.literal("sending"),
    v.literal("sent"),
    v.literal("failed"),
  ),
  approvedAt: v.optional(v.number()),
  sendAttemptedAt: v.optional(v.number()),
  sentAt: v.optional(v.number()),
  sendError: v.optional(v.string()),
  agentMailMessageId: v.optional(v.string()),
  agentMailThreadId: v.optional(v.string()),
};

export const researchPlan = v.object({
  title: v.string(),
  requirements: v.object({
    location: v.string(),
    attendeeCount: v.union(v.number(), v.null()),
    dateOrWindow: v.union(v.string(), v.null()),
    eventType: v.string(),
    mustHaves: v.array(v.string()),
    missingDetails: v.array(v.string()),
  }),
  venues: v.array(
    v.object({
      name: v.string(),
      location: v.string(),
      websiteUrl: v.string(),
      address: v.union(v.string(), v.null()),
      fitSummary: v.string(),
      recommendationScore: v.number(),
      recommendationReason: v.string(),
      amenities: v.array(v.string()),
      accessibilityNotes: v.union(v.string(), v.null()),
      pricingNotes: v.union(v.string(), v.null()),
      capacity: v.object({
        maximum: v.union(v.number(), v.null()),
        notes: v.string(),
        sourceUrl: v.union(v.string(), v.null()),
      }),
      contact: v.object({
        type: venueFields.contactType,
        value: v.string(),
        sourceUrl: v.string(),
      }),
      evidence: venueFields.evidence,
      images: v.array(venueImage),
      reviews: v.array(venueReview),
      outreach: v.object({
        subject: v.string(),
        body: v.string(),
      }),
    }),
  ),
});

export default defineSchema({
  events: defineTable({
    ...eventFields,
    sendToken: v.optional(v.string()),
  }).index("by_request_key", ["requestKey"]),
  venues: defineTable(venueFields).index("by_event", ["eventId"]),
  outreachDrafts: defineTable(outreachDraftFields)
    .index("by_event", ["eventId"])
    .index("by_venue", ["venueId"]),
});
