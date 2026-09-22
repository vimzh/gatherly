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
  it("shows honest activity, empty results, and the approval boundary", () => {
    const html = renderToStaticMarkup(
      <EventWorkspace
        event={event}
        research={{ venues: [], drafts: [], rejectedCandidates: [] }}
        sendToken={null}
      />,
    );

    expect(html).toContain("AI research in progress");
    expect(html).toContain("Searching venue sources");
    expect(html).toContain("Researching venues");
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

    render(
      <EventWorkspace
        event={event}
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
