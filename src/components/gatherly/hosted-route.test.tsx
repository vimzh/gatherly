// @vitest-environment jsdom
// Verifies the root static fallback dispatches hosted event and inbox paths.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HostedRoute } from "./hosted-route";

const route = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

vi.mock("./event-page-client", () => ({
  EventPageClient: ({ eventId, replayDemo }: { eventId: string; replayDemo?: boolean }) => (
    <p>Event {eventId} {replayDemo ? "replay" : "direct"}</p>
  ),
  EventWorkspaceLoading: () => <p>Loading</p>,
}));
vi.mock("./event-inbox-page-client", () => ({
  EventInboxPageClient: ({ eventId }: { eventId: string }) => <p>Inbox {eventId}</p>,
}));

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
  route.pathname = "/";
});

describe("hosted routes", () => {
  it("preserves the agent replay flag on a hosted event path", () => {
    window.history.replaceState({}, "", "/event/event-123?demo=agents");
    route.pathname = "/event/event-123";
    render(<HostedRoute><p>Landing</p></HostedRoute>);

    expect(screen.getByText("Event event-123 replay")).toBeTruthy();
  });

  it("dispatches an event inbox path", () => {
    window.history.replaceState({}, "", "/event/event-123/inbox");
    route.pathname = "/event/event-123/inbox";
    render(<HostedRoute><p>Landing</p></HostedRoute>);

    expect(screen.getByText("Inbox event-123")).toBeTruthy();
    expect(screen.queryByText("Landing")).toBeNull();
  });

  it("keeps unrelated paths on the landing page", () => {
    window.history.replaceState({}, "", "/");
    render(<HostedRoute><p>Landing</p></HostedRoute>);

    expect(screen.getByText("Landing")).toBeTruthy();
  });

  it("returns to the landing page when the pathname changes", () => {
    window.history.replaceState({}, "", "/event/event-123");
    route.pathname = "/event/event-123";
    const view = render(<HostedRoute><p>Landing</p></HostedRoute>);
    expect(screen.getByText("Event event-123 direct")).toBeTruthy();

    window.history.pushState({}, "", "/");
    route.pathname = "/";
    view.rerender(<HostedRoute><p>Landing</p></HostedRoute>);
    expect(screen.getByText("Landing")).toBeTruthy();
    expect(screen.queryByText("Event event-123 direct")).toBeNull();
  });
});
