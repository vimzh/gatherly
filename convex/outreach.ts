// Sends one organizer-confirmed outreach draft through AgentMail's HTTP API.
"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

function agentMailConfig(apiKey: string, inboxId: string) {
  const normalizedApiKey = apiKey.trim();
  const normalizedInboxId = inboxId.trim();
  if (!normalizedApiKey || normalizedApiKey.length > 512) {
    throw new Error("AgentMail API key must be between 1 and 512 characters.");
  }
  if (!normalizedInboxId || normalizedInboxId.length > 320) {
    throw new Error("AgentMail inbox ID must be between 1 and 320 characters.");
  }
  return { apiKey: normalizedApiKey, inboxId: normalizedInboxId };
}

type PreparedSend = {
  recipient: string;
  subject: string;
  body: string;
  idempotencyKey: string;
  agentMailMessageId?: string;
  agentMailThreadId?: string;
};

type SentDraft = {
  status: "sent";
  messageId: string;
  threadId: string;
};

async function sendWithAgentMail(
  config: ReturnType<typeof agentMailConfig>,
  message: { recipient: string; subject: string; body: string; idempotencyKey: string },
) {
  const response = await fetch(
    `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(config.inboxId)}/messages/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.idempotencyKey,
      },
      body: JSON.stringify({
        to: [message.recipient],
        subject: message.subject,
        text: message.body,
        labels: ["gatherly", "outreach"],
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) {
    throw new Error(`AgentMail rejected the send (${response.status}).`);
  }
  const result: unknown = await response.json();
  if (
    !result ||
    typeof result !== "object" ||
    !("message_id" in result) ||
    typeof result.message_id !== "string" ||
    !result.message_id.trim() ||
    !("thread_id" in result) ||
    typeof result.thread_id !== "string" ||
    !result.thread_id.trim()
  ) {
    throw new Error("AgentMail returned an invalid send response.");
  }
  return { messageId: result.message_id, threadId: result.thread_id };
}

export const sendDraft = action({
  args: {
    eventId: v.id("events"),
    draftId: v.id("outreachDrafts"),
    sendToken: v.string(),
    agentMailApiKey: v.string(),
    agentMailInboxId: v.string(),
    subject: v.optional(v.string()),
    body: v.optional(v.string()),
  },
  returns: v.object({
    status: v.literal("sent"),
    messageId: v.string(),
    threadId: v.string(),
  }),
  handler: async (ctx, args): Promise<SentDraft> => {
    const { apiKey, inboxId } = agentMailConfig(
      args.agentMailApiKey,
      args.agentMailInboxId,
    );
    const prepared: PreparedSend = await ctx.runMutation(
      internal.outreachData.prepareSend,
      {
        eventId: args.eventId,
        draftId: args.draftId,
        sendToken: args.sendToken,
        subject: args.subject,
        body: args.body,
      },
    );
    if (prepared.agentMailMessageId && prepared.agentMailThreadId) {
      return {
        status: "sent" as const,
        messageId: prepared.agentMailMessageId,
        threadId: prepared.agentMailThreadId,
      };
    }

    try {
      const sent = await sendWithAgentMail(
        { apiKey, inboxId },
        {
          recipient: prepared.recipient,
          subject: prepared.subject,
          body: prepared.body,
          idempotencyKey: prepared.idempotencyKey,
        },
      );
      await ctx.runMutation(internal.outreachData.markSent, {
        eventId: args.eventId,
        draftId: args.draftId,
        agentMailMessageId: sent.messageId,
        agentMailThreadId: sent.threadId,
      });
      return {
        status: "sent" as const,
        messageId: sent.messageId,
        threadId: sent.threadId,
      };
    } catch (error) {
      const message =
        error instanceof Error && error.message.startsWith("AgentMail ")
          ? error.message.slice(0, 500)
          : "AgentMail could not confirm the send. Retry only from this same draft so the idempotency key is reused.";
      await ctx.runMutation(internal.outreachData.markFailed, {
        eventId: args.eventId,
        draftId: args.draftId,
        message,
      });
      throw new Error(message);
    }
  },
});
