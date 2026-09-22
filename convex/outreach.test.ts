// Exercises AgentMail outreach with a mocked provider; no email leaves the test process.
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const send = vi.fn();

const modules = import.meta.glob("./**/*.ts");

async function setup(contactType: "email" | "contact_form" = "email") {
  const t = convexTest(schema, modules);
  const sendToken = crypto.randomUUID();
  const ids = await t.run(async (ctx) => {
    const eventId = await ctx.db.insert("events", {
      brief: "A 300-person London event",
      title: "London event",
      requestKey: crypto.randomUUID(),
      status: "review_ready",
      isDemo: true,
      activities: [],
      sendToken,
    });
    const venueId = await ctx.db.insert("venues", {
      eventId,
      name: "Test Venue",
      location: "London",
      websiteUrl: "https://venue.example.com",
      address: "1 Example Street",
      fitSummary: "A sourced test venue.",
      capacityMaximum: 400,
      capacityNotes: "Published capacity.",
      capacitySourceUrl: "https://venue.example.com/capacity",
      contactType,
      contactValue:
        contactType === "email"
          ? "events@venue.example.com"
          : "https://venue.example.com/contact",
      contactSourceUrl: "https://venue.example.com/contact",
      evidence: [
        {
          claim: "Hosts events.",
          sourceTitle: "Events",
          sourceUrl: "https://venue.example.com/events",
        },
      ],
    });
    const draftId = await ctx.db.insert("outreachDrafts", {
      eventId,
      venueId,
      subject: "Venue enquiry",
      body: "Is the venue available for our event?",
      status: "draft",
    });
    return { eventId, draftId };
  });
  return { t, sendToken, ...ids };
}

beforeEach(() => {
  process.env.AGENTMAIL_API_KEY = "test-agentmail-key";
  process.env.AGENTMAIL_INBOX_ID = "gatherly@agentmail.test";
  send.mockReset();
  vi.stubGlobal("fetch", send);
});

afterEach(() => {
  delete process.env.AGENTMAIL_API_KEY;
  delete process.env.AGENTMAIL_INBOX_ID;
  vi.unstubAllGlobals();
});

describe("AgentMail outreach", () => {
  it("sends a reviewed draft and persists provider identifiers", async () => {
    const { t, eventId, draftId, sendToken } = await setup();
    send.mockResolvedValue(
      Response.json({ message_id: "message-1", thread_id: "thread-1" }),
    );

    await expect(
      t.action(api.outreach.sendDraft, { eventId, draftId, sendToken }),
    ).resolves.toEqual({
      status: "sent",
      messageId: "message-1",
      threadId: "thread-1",
    });
    expect(send).toHaveBeenCalledWith(
      "https://api.agentmail.to/v0/inboxes/gatherly%40agentmail.test/messages/send",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": `gatherly.${draftId}`,
        }),
      }),
    );
    const request = send.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(request.body as string)).toMatchObject({
      to: ["events@venue.example.com"],
      subject: "Venue enquiry",
    });
    const research = await t.query(api.researchData.getByEvent, { eventId });
    expect(research?.drafts[0]).toMatchObject({
      status: "sent",
      agentMailMessageId: "message-1",
      agentMailThreadId: "thread-1",
    });
  });

  it("rejects an invalid event capability before contacting AgentMail", async () => {
    const { t, eventId, draftId } = await setup();

    await expect(
      t.action(api.outreach.sendDraft, {
        eventId,
        draftId,
        sendToken: "wrong-token",
      }),
    ).rejects.toThrow("not authorized");
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects a contact form before contacting AgentMail", async () => {
    const { t, eventId, draftId, sendToken } = await setup("contact_form");

    await expect(
      t.action(api.outreach.sendDraft, { eventId, draftId, sendToken }),
    ).rejects.toThrow("requires a verified public venue email address");
    expect(send).not.toHaveBeenCalled();
  });

  it("records provider failure and safely reuses the same idempotency key", async () => {
    const { t, eventId, draftId, sendToken } = await setup();
    send
      .mockRejectedValueOnce(new Error("network uncertainty"))
      .mockResolvedValueOnce(
        Response.json({ message_id: "message-2", thread_id: "thread-2" }),
      );

    await expect(
      t.action(api.outreach.sendDraft, { eventId, draftId, sendToken }),
    ).rejects.toThrow("could not confirm");
    const failed = await t.query(api.researchData.getByEvent, { eventId });
    expect(failed?.drafts[0].status).toBe("failed");

    await expect(
      t.action(api.outreach.sendDraft, { eventId, draftId, sendToken }),
    ).resolves.toMatchObject({ status: "sent", messageId: "message-2" });
    expect(
      (send.mock.calls[0][1] as RequestInit).headers,
    ).toMatchObject((send.mock.calls[1][1] as RequestInit).headers as object);
  });

  it("returns a completed send without sending a duplicate", async () => {
    const { t, eventId, draftId, sendToken } = await setup();
    send.mockResolvedValue(
      Response.json({ message_id: "message-3", thread_id: "thread-3" }),
    );
    const args = { eventId, draftId, sendToken };

    await t.action(api.outreach.sendDraft, args);
    await expect(t.action(api.outreach.sendDraft, args)).resolves.toEqual({
      status: "sent",
      messageId: "message-3",
      threadId: "thread-3",
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("fails before contacting AgentMail when its secret is absent", async () => {
    delete process.env.AGENTMAIL_API_KEY;
    const { t, eventId, draftId, sendToken } = await setup();

    await expect(
      t.action(api.outreach.sendDraft, { eventId, draftId, sendToken }),
    ).rejects.toThrow("AGENTMAIL_API_KEY is missing");
    expect(send).not.toHaveBeenCalled();
  });
});
