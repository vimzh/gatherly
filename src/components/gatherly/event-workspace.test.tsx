// @vitest-environment jsdom
// Verifies the durable workspace, rejected candidates, and recovery copy.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Doc } from "../../../convex/_generated/dataModel";
import { EventRecovery } from "./event-page-client";
import { EventWorkspace } from "./event-workspace";

const mocks = vi.hoisted(() => ({ sendDraft: vi.fn() }));

vi.mock("convex/react", () => ({ useAction: () => mocks.sendDraft }));

const event = {
  _id: "event-id",
  _creationTime: 1,
  brief: "A 300-person hackathon in London",
  title: "A 300-person hackathon in London",
  requestKey: "request-key",
  status: "researching",
  isDemo: false,
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

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

const venue = {
  _id: "venue-id",
  _creationTime: 1,
  eventId: event._id,
  name: "Demo Hall",
  location: "London",
  websiteUrl: "https://venue.example.com",
  fitSummary: "A venue for the demo event.",
  capacityMaximum: 300,
  capacityNotes: "Published maximum.",
  capacitySourceUrl: "https://venue.example.com",
  contactType: "email",
  contactValue: "events@venue.example.com",
  contactSourceUrl: "https://venue.example.com",
  images: [
    {
      url: "https://venue.example.com/exterior.jpg",
      sourceUrl: "https://venue.example.com/gallery",
      alt: "Demo Hall exterior",
    },
  ],
  evidence: [{ claim: "300 seats", sourceTitle: "Venue", sourceUrl: "https://venue.example.com" }],
} as Doc<"venues">;

const draft = {
  _id: "draft-id",
  _creationTime: 1,
  eventId: event._id,
  venueId: venue._id,
  subject: "Hackathon availability enquiry",
  body: "Hello Demo Hall,\n\nCan you host our 300-person hackathon?\nPlease confirm pricing and overnight access.",
  status: "draft",
} as Doc<"outreachDrafts">;

const providerCredentials = {
  openaiApiKey: "sk-test",
  firecrawlApiKey: "fc-test",
  agentMailApiKey: "am-test",
  agentMailInboxId: "gatherly@agentmail.test",
};

function renderDraft(outreachDraft = draft, sendToken: string | null = "send-token") {
  return render(
    <EventWorkspace
      event={{ ...event, status: "review_ready", researchStage: "review_ready" }}
      research={{ venues: [venue], drafts: [outreachDraft], rejectedCandidates: [] }}
      sendToken={sendToken}
      providerCredentials={providerCredentials}
    />,
  );
}

function openOutreach() {
  fireEvent.click(screen.getByRole("button", { name: "Review outreach" }));
}

describe("event workspace", () => {
  it("uses the completed workspace for venue results without the finished agent checklist", () => {
    renderDraft();

    expect(screen.getByRole("region", { name: "Venue results" })).toBeTruthy();
    expect(screen.queryByText("AI research reviewed")).toBeNull();
    expect(screen.queryByText("Agent checklist")).toBeNull();
    expect(screen.getByRole("img", { name: "Demo Hall exterior" }).className).toContain("h-24");
  });

  it("links a read-only event demo to the simulated outreach inbox", () => {
    render(
      <EventWorkspace
        event={{
          ...event,
          isDemo: true,
          status: "review_ready",
          researchStage: "review_ready",
        }}
        research={{ venues: [venue], drafts: [draft], rejectedCandidates: [] }}
        sendToken={null}
        providerCredentials={null}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Outreach inbox" }).getAttribute("href"),
    ).toBe("/inbox/?id=event-id");
  });

  it("opens an editable preview before confirmation and respects cancellation", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderDraft();

    expect(screen.queryByLabelText("Subject")).toBeNull();
    openOutreach();
    const subject = screen.getByLabelText("Subject") as HTMLInputElement;
    const body = screen.getByLabelText("Message") as HTMLTextAreaElement;
    expect(subject.value).toBe(draft.subject);
    expect(body.value).toBe(draft.body);
    fireEvent.change(subject, { target: { value: "Edited subject" } });
    fireEvent.change(body, { target: { value: "Edited message" } });
    expect(screen.getByRole("link", { name: "Outreach" }).getAttribute("href")).toBe("#outreach");
    fireEvent.click(screen.getByRole("button", { name: "Send email" }));

    expect(confirm).toHaveBeenCalledWith("Send this email to events@venue.example.com for Demo Hall?");
    expect(mocks.sendDraft).not.toHaveBeenCalled();
  });

  it("blocks duplicate sends while pending and until the sent subscription arrives", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let completeSend!: () => void;
    mocks.sendDraft.mockReturnValue(new Promise<void>((resolve) => { completeSend = resolve; }));
    renderDraft();
    openOutreach();

    fireEvent.click(screen.getByRole("button", { name: "Send email" }));
    const sendingButton = screen.getByRole("button", { name: "Sending email" }) as HTMLButtonElement;
    expect(sendingButton.disabled).toBe(true);
    fireEvent.click(sendingButton);
    expect(mocks.sendDraft).toHaveBeenCalledTimes(1);
    expect(mocks.sendDraft).toHaveBeenCalledWith({
      eventId: event._id, draftId: draft._id, sendToken: "send-token",
      agentMailApiKey: "am-test", agentMailInboxId: "gatherly@agentmail.test",
      subject: draft.subject, body: draft.body,
    });

    await act(async () => completeSend());
    expect(screen.getByText("Sent via AgentMail")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Review outreach" })).toBeNull();
  });

  it("shows persisted send failures after refresh and allows a confirmed retry", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mocks.sendDraft.mockRejectedValue(new Error("AgentMail rejected the send (429)."));
    renderDraft({
      ...draft,
      status: "failed",
      sendAttemptedAt: Date.now() - 60_000,
      sendError: "AgentMail rejected the send (503).",
    });
    openOutreach();

    expect(screen.getByRole("alert").textContent).toBe("AgentMail rejected the send (503).");
    fireEvent.click(screen.getByRole("button", { name: "Retry send" }));
    await act(async () => {});
    expect(screen.getByRole("alert").textContent).toBe("AgentMail rejected the send (429).");
    expect(mocks.sendDraft).toHaveBeenCalledTimes(1);
  });

  it("recovers an interrupted send only after confirmation and blocks pending duplicates", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    let completeSend!: () => void;
    mocks.sendDraft.mockReturnValue(new Promise<void>((resolve) => { completeSend = resolve; }));
    renderDraft({ ...draft, status: "sending", sendAttemptedAt: Date.now() - 60_000 });
    openOutreach();

    expect(screen.getByText(/The previous send is unconfirmed/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry send" }));
    expect(mocks.sendDraft).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Retry send" }));

    const sendingButton = screen.getByRole("button", { name: "Sending email" }) as HTMLButtonElement;
    expect(sendingButton.disabled).toBe(true);
    fireEvent.click(sendingButton);
    expect(mocks.sendDraft).toHaveBeenCalledTimes(1);
    expect(mocks.sendDraft).toHaveBeenCalledWith({
      eventId: event._id, draftId: draft._id, sendToken: "send-token",
      agentMailApiKey: "am-test", agentMailInboxId: "gatherly@agentmail.test",
    });

    await act(async () => completeSend());
    expect(screen.getByText("Sent via AgentMail")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry send" })).toBeNull();
  });

  it("does not offer sending without the event send token", () => {
    renderDraft(draft, null);
    openOutreach();
    expect(screen.getByText("This read-only link cannot send outreach.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Send email" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the current agent, completed handoffs, and live actions", () => {
    const html = renderToStaticMarkup(
      <EventWorkspace
        event={event}
        research={{ venues: [], drafts: [], rejectedCandidates: [] }}
        sendToken={null}
        providerCredentials={null}
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
        providerCredentials={null}
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
        providerCredentials={null}
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
