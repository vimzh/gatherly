// @vitest-environment jsdom
// Verifies the demo gives each research agent an equal five-second turn.
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { DemoResearchReplay } from "./research-progress";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("demo research replay", () => {
  it("advances six agents over exactly 30 seconds", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(
      <DemoResearchReplay
        event={{
          _id: "demo-id" as Id<"events">,
          _creationTime: 1,
          title: "Bengaluru developer meetup",
          brief: "A 200-person meetup in Bengaluru",
          status: "review_ready",
          isDemo: true,
          researchStage: "review_ready",
          activities: [
            { key: "brief", label: "Understanding the brief", description: "Done", state: "completed" },
            { key: "search", label: "Searching venue sources", description: "Done", state: "completed" },
            { key: "capacity", label: "Checking capacity", description: "Done", state: "completed" },
            { key: "contacts", label: "Finding contacts", description: "Done", state: "completed" },
            { key: "shortlist", label: "Reviewing shortlist", description: "Done", state: "completed" },
            { key: "outreach", label: "Drafting outreach", description: "Done", state: "completed" },
            { key: "approval", label: "Waiting for approval", description: "Review", state: "approval_required" },
          ],
        }}
        onComplete={onComplete}
      />,
    );

    expect(screen.getByText("Agent research in progress")).toBeTruthy();
    expect(screen.queryByText("30-second demo replay")).toBeNull();
    expect(screen.getByText("Step 1 of 6")).toBeTruthy();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText("Step 2 of 6")).toBeTruthy();
    act(() => vi.advanceTimersByTime(20_000));
    expect(screen.getByText("Step 6 of 6")).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(5000));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
