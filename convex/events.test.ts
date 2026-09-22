// Verifies the persistent event contract against an in-memory Convex backend.
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("events", () => {
  it("rejects blank and overlong briefs", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(api.events.create, { brief: "   ", requestKey: "blank" }),
    ).rejects.toThrow("Describe the event before starting a search.");
    await expect(
      t.mutation(api.events.create, {
        brief: "x".repeat(4001),
        requestKey: "long",
      }),
    ).rejects.toThrow("Event briefs must be 4,000 characters or fewer.");
  });

  it("stores a trimmed brief with honest demo activity", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(api.events.create, {
      brief: "  300-person creative showcase in London  ",
      requestKey: "create-once",
    });
    const eventId = created.eventId;
    const event = await t.query(api.events.get, { eventId });
    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect(),
    );

    expect(event?.brief).toBe("300-person creative showcase in London");
    expect(created.sendToken).toMatch(/^[0-9a-f-]{36}$/);
    expect(event).not.toHaveProperty("sendToken");
    expect(event?.status).toBe("researching");
    expect(event?.isDemo).toBe(true);
    expect(event?.activities).toHaveLength(7);
    expect(event?.researchStage).toBe("queued");
    expect(event?.activities.some((item) => item.state === "queued")).toBe(true);
    expect(event?.activities.at(-1)?.label).toBe(
      "Waiting for organizer approval",
    );
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].name).toBe("research:generateForEvent");
  });

  it("returns the same event for a repeated request key", async () => {
    const t = convexTest(schema, modules);
    const args = { brief: "Community meetup", requestKey: "same-request" };
    const first = await t.mutation(api.events.create, args);
    const second = await t.mutation(api.events.create, args);

    expect(second).toEqual(first);
  });

  it("returns null for malformed and unknown identifiers", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.events.get, { eventId: "not-an-id" })).toBeNull();

    const missingId = await t.run(async (ctx) =>
      ctx.db.insert("events", {
        brief: "Temporary event",
        title: "Temporary event",
        requestKey: "temporary",
        status: "researching",
        isDemo: true,
        activities: [],
      }),
    );
    await t.run(async (ctx) => ctx.db.delete(missingId));

    expect(await t.query(api.events.get, { eventId: missingId })).toBeNull();
  });

  it("persists reviewed venues and protects idempotent outreach state", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(api.events.create, {
      brief: "A 300-person London hackathon",
      requestKey: "reviewed-research",
    });
    const { eventId, sendToken } = created;

    expect(await t.mutation(internal.researchData.begin, { eventId })).toEqual({
      brief: "A 300-person London hackathon",
    });
    await expect(
      t.mutation(internal.researchData.setAgentStage, {
        eventId,
        stage: "enriching",
      }),
    ).rejects.toThrow("Agent stage handoff is out of order.");
    await t.mutation(internal.researchData.setAgentStage, {
      eventId,
      stage: "discovering",
    });
    await t.mutation(internal.researchData.setAgentStage, {
      eventId,
      stage: "enriching",
    });
    const progressing = await t.query(api.events.get, { eventId });
    expect(progressing?.agentStage).toBe("enriching");
    expect(progressing?.agentTrace).toEqual(["planning", "discovering", "enriching"]);
    expect(
      progressing?.activities
        .filter((activity) => activity.state === "active")
        .map((activity) => activity.key),
    ).toEqual(["capacity", "contacts"]);
    await t.mutation(internal.researchData.complete, {
      eventId,
      model: "test-model",
      plan: {
        title: "London hackathon",
        requirements: {
          location: "London",
          attendeeCount: 300,
          dateOrWindow: null,
          eventType: "hackathon",
          mustHaves: ["Strong Wi-Fi"],
          missingDetails: ["Exact date"],
        },
        venues: [1, 2].map((number) => ({
          name: `Venue ${number}`,
          location: "London",
          websiteUrl: `https://venue-${number}.example.com`,
          address: `${number} Example Street, London`,
          fitSummary: "Potential fit based on public venue information.",
          recommendationScore: 90 - number * 5,
          recommendationReason: "Strong capacity and contact evidence; confirm availability.",
          amenities: ["Strong Wi-Fi"],
          accessibilityNotes: "Step-free entrance details are published.",
          pricingNotes: "Pricing is available by enquiry.",
          capacity: {
            maximum: 400,
            notes: "Published standing capacity.",
            sourceUrl: `https://venue-${number}.example.com/capacity`,
          },
          contact: {
            type: "email" as const,
            value: `events@venue-${number}.example.com`,
            sourceUrl: `https://venue-${number}.example.com/contact`,
          },
          evidence: [
            {
              claim: "Hosts large events.",
              sourceTitle: "Events",
              sourceUrl: `https://venue-${number}.example.com/events`,
            },
          ],
          images: [
            {
              url: `https://images.example.com/venue-${number}.jpg`,
              sourceUrl: `https://venue-${number}.example.com`,
              alt: `Venue ${number}`,
            },
          ],
          reviews: [
            {
              sourceName: "Example Reviews",
              rating: 4.2,
              reviewCount: 120,
              summary: "Public reviews mention helpful staff.",
              sourceUrl: `https://reviews.example.com/venue-${number}`,
            },
          ],
          outreach: {
            subject: "Hackathon venue enquiry",
            body: "Is the venue available, and can you confirm capacity and pricing?",
          },
        })),
      },
      rejectedCandidates: [
        {
          name: "Venue 180",
          location: "London",
          sourceUrl: "https://venue-180.example.com",
          capacityMaximum: 180,
          reason: "Published maximum capacity is below the requested 300 attendees.",
        },
      ],
      reviewSummary: "The revised shortlist passed review.",
      issues: [],
      verification: [
        { key: "outreach_safety", passed: true, detail: "Drafts only ask questions." },
      ],
    });

    const research = await t.query(api.researchData.getByEvent, { eventId });
    expect((await t.query(api.events.get, { eventId }))?.agentStage).toBeUndefined();
    expect(research?.venues).toHaveLength(2);
    expect(research?.venues[0].images).toHaveLength(1);
    expect(research?.venues[0].recommendationScore).toBe(85);
    expect(research?.venues[0].reviews?.[0].rating).toBe(4.2);
    expect(research?.drafts).toHaveLength(2);
    expect(research?.drafts.every((draft) => draft.status === "draft")).toBe(true);
    expect(research?.rejectedCandidates).toMatchObject([
      {
        name: "Venue 180",
        capacityMaximum: 180,
        reason: "Published maximum capacity is below the requested 300 attendees.",
      },
    ]);

    const draftId = research!.drafts[0]._id;
    const otherEvent = await t.mutation(api.events.create, {
      brief: "A separate demo event",
      requestKey: "other-event",
    });
    await expect(
      t.mutation(internal.outreachData.prepareSend, {
        eventId: otherEvent.eventId,
        draftId,
        sendToken: otherEvent.sendToken,
      }),
    ).rejects.toThrow("Outreach draft not found for this event.");
    await expect(
      t.mutation(internal.outreachData.prepareSend, {
        eventId,
        draftId,
        sendToken: "wrong-token",
      }),
    ).rejects.toThrow("not authorized");

    const prepared = await t.mutation(internal.outreachData.prepareSend, {
      eventId,
      draftId,
      sendToken,
    });
    const retried = await t.mutation(internal.outreachData.prepareSend, {
      eventId,
      draftId,
      sendToken,
    });
    expect(prepared.recipient).toBe("events@venue-1.example.com");
    expect(retried.idempotencyKey).toBe(prepared.idempotencyKey);

    await t.mutation(internal.outreachData.markSent, {
      eventId,
      draftId,
      agentMailMessageId: "message-test",
      agentMailThreadId: "thread-test",
    });
    const sent = await t.query(api.researchData.getByEvent, { eventId });
    expect(sent?.drafts[0]).toMatchObject({
      status: "sent",
      agentMailMessageId: "message-test",
      agentMailThreadId: "thread-test",
    });
  });
});
