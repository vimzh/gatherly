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

export const eventFields = {
  brief: v.string(),
  title: v.string(),
  requestKey: v.string(),
  status: eventStatus,
  isDemo: v.boolean(),
  activities: v.array(activity),
};

export default defineSchema({
  events: defineTable(eventFields).index("by_request_key", ["requestKey"]),
});
