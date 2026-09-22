// @vitest-environment jsdom
// Verifies the durable workspace, rejected candidates, and recovery copy.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import type { Doc } from "../../../convex/_generated/dataModel";
import { EventRecovery } from "./event-page-client";
import { EventWorkspace } from "./event-workspace";

const event = {
  _id: "event-id",
  _creationTime: 1,
  brief: "A 300-person hackathon in London",
  title: "A 300-person hackathon in London",
  requestKey: "request-key",
  status: "researching",
  isDemo: true,
  researchStage: "running",
  agentStage: "discovering",
  agentTrace: ["planning", "discovering"],
  activities: [
    {
      key: "brief",
      label: "Understanding the brief",
      description: "Gatherly extracted the core event requirements.",
      state: "completed",
    },
    {
      key: "search",
      label: "Searching venue sources",
      description: "Demo activity — live venue research is not connected yet.",
      state: "active",
    },
    {
      key: "approval",
      label: "Waiting for organizer approval",
      description: "Every outbound draft remains paused until you approve it.",
      state: "queued",
    },
  ],
} as Doc<"events">;

afterEach(cleanup);

describe("event workspace", () => {
  it("shows the current agent, completed handoffs, and live actions", () => {
    const html = renderToStaticMarkup(
      <EventWorkspace
        event={event}
        research={{ venues: [], drafts: [], rejectedCandidates: [] }}
        sendToken={null}
      />,
    );

    expect(html).toContain("Gatherly is sourcing your venue.");
    expect(html).toContain("Agent handoffs");
    expect(html).toContain("Scout");
    expect(html).toContain("Step 2 of 6");
    expect(html).toContain("Planner");
    expect(html).toContain("Searching venue sources");
    expect(html).toContain("AgentMail sends only after your confirmation.");
  });

  it("reveals rejected candidates without offering outreach", () => {
    const rejectedCandidate = {
      _id: "rejected-venue-id",
      _creationTime: 1,
      eventId: event._id,
      name: "Venue 180",
      location: "London",
      sourceUrl: "https://venue-180.example.com",
      capacityMaximum: 180,
      reason: "Published maximum capacity is below the requested 200 attendees.",
    } as Doc<"rejectedVenues">;
    const reviewReadyEvent = {
      ...event,
      status: "review_ready",
      researchStage: "review_ready",
      agentStage: undefined,
    } as Doc<"events">;

    render(
      <EventWorkspace
        event={reviewReadyEvent}
        research={{ venues: [], drafts: [], rejectedCandidates: [rejectedCandidate] }}
        sendToken={null}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "View rejected candidates (1)" }),
    );

    expect(screen.getByText("Venue 180")).toBeTruthy();
    expect(screen.getByText("Capacity: 180")).toBeTruthy();
    expect(screen.queryByText("Send with AgentMail")).toBeNull();
  });

  it("shows a useful provider failure without an internal stack trace", () => {
    const failedEvent = {
      ...event,
      status: "failed",
      researchStage: "failed",
      researchError:
        'Uncaught ConvexError: {"message":"Firecrawl search failed: Insufficient credits."} at fail (node_modules/provider.ts:38:4)',
    } as Doc<"events">;
    const html = renderToStaticMarkup(
      <EventWorkspace
        event={failedEvent}
        research={{ venues: [], drafts: [], rejectedCandidates: [] }}
        sendToken={null}
      />,
    );

    expect(html).toContain("Firecrawl search failed: Insufficient credits.");
    expect(html).not.toContain("node_modules");
  });

  it("offers a new search when an event link cannot be resolved", () => {
    const html = renderToStaticMarkup(
      <EventRecovery
        title="Event not found"
        description="This event may have been removed."
      />,
    );

    expect(html).toContain("Event not found");
    expect(html).toContain('href="/"');
    expect(html).toContain("Start a new search");
  });
});
