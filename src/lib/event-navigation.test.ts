// Covers the input normalization and static URL contract used by event creation.
import { describe, expect, it } from "vitest";
import {
  eventHref,
  eventInboxHref,
  normalizeEventBrief,
  outreachDemoHref,
  parseHostedEventPath,
  venueDemoHref,
} from "./event-navigation";

describe("event navigation", () => {
  it("rejects blank briefs and trims meaningful Unicode", () => {
    expect(normalizeEventBrief(" \n\t ")).toBeNull();
    expect(normalizeEventBrief("  200-person कलाकार showcase  ")).toBe(
      "200-person कलाकार showcase",
    );
  });

  it("rejects briefs over 4,000 characters", () => {
    expect(() => normalizeEventBrief("x".repeat(4001))).toThrow(
      "Event briefs must be 4,000 characters or fewer.",
    );
  });

  it("encodes the Convex identifier into the static event route", () => {
    expect(eventHref("event/id+1", "send/token+1")).toBe(
      "/event/?id=event%2Fid%2B1&token=send%2Ftoken%2B1",
    );
    expect(eventHref("demo/id")).toBe("/event/?id=demo%2Fid");
    expect(eventInboxHref("demo/id", "send/token")).toBe(
      "/inbox/?id=demo%2Fid&token=send%2Ftoken",
    );
    expect(outreachDemoHref()).toBe(
      "/inbox/?id=j5772sbbtpkpyyx2gqz3c9f72d8ewfms",
    );
    expect(venueDemoHref()).toBe(
      "/event/?id=j5772sbbtpkpyyx2gqz3c9f72d8ewfms&demo=agents",
    );
  });

  it("recognizes hosted event and inbox paths", () => {
    expect(parseHostedEventPath("/event/event%2Fid")).toEqual({
      eventId: "event/id",
      view: "event",
    });
    expect(parseHostedEventPath("/event/event-id/inbox/")).toEqual({
      eventId: "event-id",
      view: "inbox",
    });
    expect(parseHostedEventPath("/event/event-id/settings")).toBeNull();
    expect(parseHostedEventPath("/something-else")).toBeNull();
  });
});
