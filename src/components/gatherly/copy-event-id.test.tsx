// @vitest-environment jsdom
// Verifies that the visible event locator is copied without exposing send authority.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyEventId } from "./copy-event-id";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("copy event ID", () => {
  it("copies the exact event identifier", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<CopyEventId eventId="event-123" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy event ID" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("event-123"));
    expect(screen.getByText("Copied")).toBeTruthy();
  });
});
