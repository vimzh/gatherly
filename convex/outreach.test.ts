// Exercises AgentMail outreach with a mocked provider; no email leaves the test process.
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const send = vi.fn();
const credentials = {
  agentMailApiKey: "test-agentmail-key",
  agentMailInboxId: "gatherly@agentmail.test",
};

const modules = import.meta.glob("./**/*.ts");

async function setup(
  contactType: "email" | "contact_form" = "email",
  isDemo = false,
) {
  const t = convexTest(schema, modules);
  const sendToken = crypto.randomUUID();
  const ids = await t.run(async (ctx) => {
    const eventId = await ctx.db.insert("events", {
      brief: "A 300-person London event",
      title: "London event",
      requestKey: crypto.randomUUID(),
      status: "review_ready",
      isDemo,
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
  send.mockReset();
  vi.stubGlobal("fetch", send);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AgentMail outreach", () => {
  it("sends a reviewed draft and persists provider identifiers", async () => {
    const { t, eventId, draftId, sendToken } = await setup();
    send.mockResolvedValue(
      Response.json({ message_id: "message-1", thread_id: "thread-1" }),
    );

    await expect(
      t.action(api.outreach.sendDraft, { eventId, draftId, sendToken, ...credentials }),
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

  it("sends and persists the organizer's edited preview", async () => {
    const { t, eventId, draftId, sendToken } = await setup();
    send.mockResolvedValue(
      Response.json({ message_id: "message-edited", thread_id: "thread-edited" }),
    );

    await t.action(api.outreach.sendDraft, {
      eventId,
      draftId,
      sendToken,
      ...credentials,
      subject: "Edited venue enquiry",
      body: "Please confirm the edited requirements.",
    });

    const request = send.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(request.body as string)).toMatchObject({
      subject: "Edited venue enquiry",
      text: "Please confirm the edited requirements.",
    });
    expect((await t.query(api.researchData.getByEvent, { eventId }))?.drafts[0]).toMatchObject({
      subject: "Edited venue enquiry",
      body: "Please confirm the edited requirements.",
      status: "sent",
    });
  });

  it("does not allow an edited retry under the original send key", async () => {
    const { t, eventId, draftId, sendToken } = await setup();
    await t.mutation(internal.outreachData.prepareSend, { eventId, draftId, sendToken });

    await expect(
      t.action(api.outreach.sendDraft, {
        eventId,
        draftId,
        sendToken,
        ...credentials,
        subject: "Changed after the first attempt",
      }),
    ).rejects.toThrow("cannot be edited after a send attempt");
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects an empty edited preview before contacting AgentMail", async () => {
    const { t, eventId, draftId, sendToken } = await setup();

    await expect(
      t.action(api.outreach.sendDraft, {
        eventId,
        draftId,
        sendToken,
        ...credentials,
        subject: "   ",
        body: "Edited message",
      }),
    ).rejects.toThrow("subject must be between 1 and 200 characters");
    expect(send).not.toHaveBeenCalled();
    expect((await t.query(api.researchData.getByEvent, { eventId }))?.drafts[0].status).toBe("draft");
  });

  it("rejects an invalid event capability before contacting AgentMail", async () => {
    const { t, eventId, draftId } = await setup();

    await expect(
      t.action(api.outreach.sendDraft, {
        eventId,
        draftId,
        sendToken: "wrong-token",
        ...credentials,
      }),
    ).rejects.toThrow("not authorized");
    expect(send).not.toHaveBeenCalled();
  });

  it("never sends outreach from a demo event", async () => {
    const { t, eventId, draftId, sendToken } = await setup("email", true);

    await expect(
      t.action(api.outreach.sendDraft, {
        eventId,
        draftId,
        sendToken,
        ...credentials,
      }),
    ).rejects.toThrow("Demo events are read-only");
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects a contact form before contacting AgentMail", async () => {
    const { t, eventId, draftId, sendToken } = await setup("contact_form");

    await expect(
      t.action(api.outreach.sendDraft, { eventId, draftId, sendToken, ...credentials }),
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
      t.action(api.outreach.sendDraft, { eventId, draftId, sendToken, ...credentials }),
    ).rejects.toThrow("could not confirm");
    const failed = await t.query(api.researchData.getByEvent, { eventId });
    expect(failed?.drafts[0].status).toBe("failed");

    await expect(
      t.action(api.outreach.sendDraft, { eventId, draftId, sendToken, ...credentials }),
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
    const args = { eventId, draftId, sendToken, ...credentials };

    await t.action(api.outreach.sendDraft, args);
    await expect(t.action(api.outreach.sendDraft, args)).resolves.toEqual({
      status: "sent",
      messageId: "message-3",
      threadId: "thread-3",
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("fails before contacting AgentMail when its visitor key is absent", async () => {
    const { t, eventId, draftId, sendToken } = await setup();

    await expect(
      t.action(api.outreach.sendDraft, {
        eventId,
        draftId,
        sendToken,
        ...credentials,
        agentMailApiKey: "   ",
      }),
    ).rejects.toThrow("AgentMail API key must be between 1 and 512 characters");
    expect(send).not.toHaveBeenCalled();
    const draft = (await t.query(api.researchData.getByEvent, { eventId }))?.drafts[0];
    expect(draft?.status).toBe("draft");
    expect(draft?.sendAttemptedAt).toBeUndefined();
  });

  it("refuses a stale retry after the provider idempotency window", async () => {
    const { t, eventId, draftId, sendToken } = await setup();
    await t.run((ctx) => ctx.db.patch(draftId, {
      status: "failed",
      sendAttemptedAt: Date.now() - 24 * 60 * 60 * 1_000,
    }));

    await expect(
      t.action(api.outreach.sendDraft, { eventId, draftId, sendToken, ...credentials }),
    ).rejects.toThrow("needs manual review");
    expect(send).not.toHaveBeenCalled();
  });

  it("recovers an interrupted send with the original draft key", async () => {
    const { t, eventId, draftId, sendToken } = await setup();
    const args = { eventId, draftId, sendToken, ...credentials };
    const interrupted = await t.mutation(internal.outreachData.prepareSend, {
      eventId,
      draftId,
      sendToken,
    });
    expect((await t.query(api.researchData.getByEvent, { eventId }))?.drafts[0].status).toBe("sending");
    send.mockResolvedValue(Response.json({ message_id: "recovered-message", thread_id: "recovered-thread" }));
    await expect(t.action(api.outreach.sendDraft, args)).resolves.toMatchObject({ status: "sent" });
    expect(send.mock.calls[0][1].headers["Idempotency-Key"]).toBe(interrupted.idempotencyKey);
  });

  it("does not let a late failed attempt overwrite confirmed delivery", async () => {
    const { t, eventId, draftId, sendToken } = await setup();
    send.mockResolvedValue(Response.json({ message_id: "message-4", thread_id: "thread-4" }));
    await t.action(api.outreach.sendDraft, { eventId, draftId, sendToken, ...credentials });
    await t.mutation(internal.outreachData.markFailed, {
      eventId, draftId, message: "An earlier request timed out.",
    });
    const research = await t.query(api.researchData.getByEvent, { eventId });
    expect(research?.drafts[0]).toMatchObject({ status: "sent", agentMailMessageId: "message-4" });
  });

  it("rejects empty provider identifiers instead of persisting a false sent state", async () => {
    const { t, eventId, draftId, sendToken } = await setup();
    send.mockResolvedValue(Response.json({ message_id: "", thread_id: "" }));
    await expect(
      t.action(api.outreach.sendDraft, { eventId, draftId, sendToken, ...credentials }),
    ).rejects.toThrow("invalid send response");
    const research = await t.query(api.researchData.getByEvent, { eventId });
    expect(research?.drafts[0].status).toBe("failed");
  });
});
