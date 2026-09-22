// Owns the transactional state changes around irreversible AgentMail sends.
import { ConvexError, v } from "convex/values";
import { internalMutation } from "./_generated/server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1_000;
const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 20_000;

export const prepareSend = internalMutation({
  args: {
    eventId: v.id("events"),
    draftId: v.id("outreachDrafts"),
    sendToken: v.string(),
    subject: v.optional(v.string()),
    body: v.optional(v.string()),
  },
  returns: v.object({
    recipient: v.string(),
    subject: v.string(),
    body: v.string(),
    idempotencyKey: v.string(),
    agentMailMessageId: v.optional(v.string()),
    agentMailThreadId: v.optional(v.string()),
  }),
  handler: async (ctx, { eventId, draftId, sendToken, subject, body }) => {
    const [event, draft] = await Promise.all([
      ctx.db.get(eventId),
      ctx.db.get(draftId),
    ]);
    if (!event || !event.sendToken || event.sendToken !== sendToken) {
      throw new ConvexError("This event link is not authorized to send outreach.");
    }
    if (event.isDemo) {
      throw new ConvexError("Demo events are read-only and cannot send outreach.");
    }
    if (!draft || draft.eventId !== eventId) {
      throw new ConvexError("Outreach draft not found for this event.");
    }

    const venue = await ctx.db.get(draft.venueId);
    if (!venue || venue.eventId !== eventId) {
      throw new ConvexError("Venue not found for this outreach draft.");
    }
    if (venue.contactType !== "email" || !EMAIL_PATTERN.test(venue.contactValue)) {
      throw new ConvexError("AgentMail requires a verified public venue email address.");
    }

    const idempotencyKey = `gatherly.${draft._id}`;
    if (draft.status === "sent") {
      if (!draft.agentMailMessageId || !draft.agentMailThreadId) {
        throw new ConvexError("The sent draft is missing its AgentMail identifiers.");
      }
      return {
        recipient: venue.contactValue,
        subject: draft.subject,
        body: draft.body,
        idempotencyKey,
        agentMailMessageId: draft.agentMailMessageId,
        agentMailThreadId: draft.agentMailThreadId,
      };
    }

    const now = Date.now();
    if (
      draft.sendAttemptedAt &&
      now - draft.sendAttemptedAt >= IDEMPOTENCY_WINDOW_MS
    ) {
      throw new ConvexError(
        "This send attempt is older than AgentMail's idempotency window and needs manual review.",
      );
    }

    if (draft.sendAttemptedAt && (subject !== undefined || body !== undefined)) {
      throw new ConvexError(
        "An outreach draft cannot be edited after a send attempt. Retry the original message instead.",
      );
    }

    const outgoingSubject = (subject ?? draft.subject).trim();
    const outgoingBody = (body ?? draft.body).trim();
    if (!outgoingSubject || outgoingSubject.length > MAX_SUBJECT_LENGTH) {
      throw new ConvexError(
        `The outreach subject must be between 1 and ${MAX_SUBJECT_LENGTH} characters.`,
      );
    }
    if (!outgoingBody || outgoingBody.length > MAX_BODY_LENGTH) {
      throw new ConvexError(
        `The outreach message must be between 1 and ${MAX_BODY_LENGTH} characters.`,
      );
    }

    await ctx.db.patch(draftId, {
      subject: outgoingSubject,
      body: outgoingBody,
      status: "sending",
      approvedAt: draft.approvedAt ?? now,
      sendAttemptedAt: draft.sendAttemptedAt ?? now,
      sendError: undefined,
    });
    return {
      recipient: venue.contactValue,
      subject: outgoingSubject,
      body: outgoingBody,
      idempotencyKey,
    };
  },
});

export const markSent = internalMutation({
  args: {
    eventId: v.id("events"),
    draftId: v.id("outreachDrafts"),
    agentMailMessageId: v.string(),
    agentMailThreadId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft || draft.eventId !== args.eventId) {
      throw new ConvexError("Outreach draft not found for this event.");
    }
    await ctx.db.patch(args.draftId, {
      status: "sent",
      sentAt: draft.sentAt ?? Date.now(),
      sendError: undefined,
      agentMailMessageId: args.agentMailMessageId,
      agentMailThreadId: args.agentMailThreadId,
    });
    return null;
  },
});

export const markFailed = internalMutation({
  args: {
    eventId: v.id("events"),
    draftId: v.id("outreachDrafts"),
    message: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft || draft.eventId !== args.eventId || draft.status !== "sending") {
      return null;
    }
    await ctx.db.patch(args.draftId, {
      status: "failed",
      sendError: args.message.slice(0, 500),
    });
    return null;
  },
});
