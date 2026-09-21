// Verifies the persistent event contract against an in-memory Convex backend.
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
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
    const eventId = await t.mutation(api.events.create, {
      brief: "  300-person creative showcase in London  ",
      requestKey: "create-once",
    });
    const event = await t.query(api.events.get, { eventId });

    expect(event?.brief).toBe("300-person creative showcase in London");
    expect(event?.status).toBe("researching");
    expect(event?.isDemo).toBe(true);
    expect(event?.activities).toHaveLength(7);
    expect(event?.activities.some((item) => item.state === "active")).toBe(true);
    expect(event?.activities.at(-1)?.label).toBe(
      "Waiting for organizer approval",
    );
  });

  it("returns the same event for a repeated request key", async () => {
    const t = convexTest(schema, modules);
    const args = { brief: "Community meetup", requestKey: "same-request" };
    const first = await t.mutation(api.events.create, args);
    const second = await t.mutation(api.events.create, args);

    expect(second).toBe(first);
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
});
