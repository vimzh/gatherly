// @vitest-environment jsdom
// Exercises bookmark restoration and reactive research states without live providers.
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventPageClient } from "./event-page-client";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  generateResearch: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock("convex/react", () => ({
  useAction: () => mocks.generateResearch,
  useQuery: mocks.query,
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => mocks.searchParams }));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  mocks.searchParams = new URLSearchParams();
  sessionStorage.clear();
});

describe("event URL restoration", () => {
  it("skips backend lookups for an incomplete link", () => {
    render(<EventPageClient />);
    expect(screen.getByRole("heading", { name: "This event link is incomplete" })).toBeTruthy();
    expect(mocks.query.mock.calls.map((call) => call[1])).toEqual(["skip", "skip"]);
  });

  it("shows recovery for unknown or malformed event identifiers", () => {
    mocks.searchParams = new URLSearchParams("id=unknown");
    mocks.query.mockReturnValueOnce(null).mockReturnValueOnce(undefined);
    render(<EventPageClient />);
    expect(screen.getByRole("heading", { name: "Event not found" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Start a new search" }).getAttribute("href")).toBe("/");
    expect(mocks.query.mock.calls[1][1]).toBe("skip");
  });

  it("restores the bookmarked event and updates from research to the persisted shortlist", () => {
    mocks.searchParams = new URLSearchParams("id=event-id&token=send-token");
    const event = {
      _id: "event-id",
      _creationTime: 1,
      title: "Demo event",
      brief: "A demo event in London",
      status: "researching",
      isDemo: true,
      researchStage: "running",
      agentStage: "discovering",
      activities: [],
    };
    mocks.query.mockReturnValueOnce(event).mockReturnValueOnce(undefined);
    const { rerender } = render(<EventPageClient />);
    expect(screen.getByRole("heading", { name: "Gatherly is sourcing your venue." })).toBeTruthy();
    expect(mocks.query.mock.calls[0][1]).toEqual({ eventId: "event-id" });
    expect(mocks.query.mock.calls[1][1]).toEqual({ eventId: "event-id" });

    const readyEvent = { ...event, status: "review_ready", researchStage: "review_ready" };
    mocks.query.mockReturnValueOnce(readyEvent).mockReturnValueOnce(undefined);
    rerender(<EventPageClient />);
    expect(screen.queryByText("No verified venues found")).toBeNull();

    mocks.query.mockReturnValueOnce(readyEvent).mockReturnValueOnce({ venues: [], drafts: [], rejectedCandidates: [] });
    rerender(<EventPageClient />);
    expect(screen.getByRole("heading", { name: "Demo event" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "No verified venues found" })).toBeTruthy();
    expect(screen.queryByText("Agent checklist")).toBeNull();
  });

  it("starts a queued live event with its browser-session research keys", async () => {
    mocks.searchParams = new URLSearchParams("id=event-id&token=send-token");
    sessionStorage.setItem(
      "gatherly:provider-credentials:event-id",
      JSON.stringify({
        openaiApiKey: "sk-visitor",
        firecrawlApiKey: "fc-visitor",
        agentMailApiKey: "am-visitor",
        agentMailInboxId: "visitor@agentmail.test",
      }),
    );
    const queuedEvent = {
      _id: "event-id",
      _creationTime: 1,
      title: "Live event",
      brief: "A live event in Bengaluru",
      status: "researching",
      isDemo: false,
      researchStage: "queued",
      activities: [],
    };
    mocks.query.mockReturnValue(queuedEvent);
    mocks.generateResearch.mockResolvedValue(null);

    render(<EventPageClient />);

    await waitFor(() => expect(mocks.generateResearch).toHaveBeenCalledWith({
      eventId: "event-id",
      sendToken: "send-token",
      openaiApiKey: "sk-visitor",
      firecrawlApiKey: "fc-visitor",
    }));
  });
});
