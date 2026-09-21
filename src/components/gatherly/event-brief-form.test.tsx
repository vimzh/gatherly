// @vitest-environment jsdom
// Protects the keyboard-focus behavior of the event brief composer.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventBriefForm } from "./event-brief-form";

const mocks = vi.hoisted(() => ({
  createEvent: vi.fn(),
  push: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useMutation: () => mocks.createEvent,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("event brief form", () => {
  it("returns focus to the composer when an empty brief is submitted", () => {
    render(<EventBriefForm />);
    const composer = screen.getByRole("textbox", {
      name: "Describe your event and venue requirements",
    });

    fireEvent.click(screen.getByRole("button", { name: "Find venues" }));

    expect(screen.getByRole("alert").textContent).toBe(
      "Describe the event before starting a search.",
    );
    expect(document.activeElement).toBe(composer);
    expect(mocks.createEvent).not.toHaveBeenCalled();
  });
});
