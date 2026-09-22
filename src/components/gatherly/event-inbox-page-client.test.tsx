// @vitest-environment jsdom
// Verifies that an event ID resolves to its agent and outreach inbox state.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventInboxPageClient } from "./event-inbox-page-client";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("convex/react", () => ({ useQuery: mocks.query }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("event inbox", () => {
  it("shows the event's agent progress and switches real outreach drafts", () => {
    const event = {
      _id: "event-id",
      _creationTime: 1,
      title: "Bengaluru meetup",
      brief: "A 200-person meetup",
      status: "review_ready",
      isDemo: false,
      researchStage: "review_ready",
      activities: [
        { key: "brief", label: "Understanding the brief", description: "Done", state: "completed" },
        { key: "approval", label: "Waiting for approval", description: "Review", state: "approval_required" },
      ],
    };
    const venues = [
      { _id: "venue-1", name: "Venue One", capacityMaximum: 250, contactType: "email", recommendationScore: 82 },
      { _id: "venue-2", name: "Venue Two", capacityMaximum: 220, contactType: "contact_form", recommendationScore: 70 },
    ];
    const drafts = [
      { _id: "draft-1", venueId: "venue-1", subject: "First enquiry", body: "First message", status: "sent", agentMailThreadId: "thread-1" },
      { _id: "draft-2", venueId: "venue-2", subject: "Second enquiry", body: "Second message", status: "draft" },
    ];
    mocks.query.mockReturnValueOnce(event).mockReturnValueOnce({ venues, drafts, rejectedCandidates: [] });

    render(<EventInboxPageClient eventId="event-id" sendToken="send-token" />);

    expect(screen.getByText("1 of 2 complete")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Venue One" })).toBeTruthy();
    expect(screen.getByText(/waiting for a reply/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open venue workspace" }).getAttribute("href")).toBe(
      "/event/?id=event-id&token=send-token",
    );

    fireEvent.click(screen.getByRole("button", { name: /Venue Two/ }));
    expect(screen.getByRole("heading", { name: "Venue Two" })).toBeTruthy();
    expect((screen.getByLabelText("Outreach message") as HTMLTextAreaElement).value).toBe("Second message");
  });
});
