// Covers the input normalization and static URL contract used by event creation.
import { describe, expect, it } from "vitest";
import { eventHref, normalizeEventBrief } from "./event-navigation";

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
      "/event?id=event%2Fid%2B1&token=send%2Ftoken%2B1",
    );
  });
});
