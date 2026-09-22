// @vitest-environment jsdom
// Verifies the simulated inbox summary, thread switching, and read-only boundary.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DemoOutreachInbox } from "./demo-outreach-inbox";

afterEach(cleanup);

describe("outreach inbox preview", () => {
  it("shows a clearly simulated organizer inbox and switches venue threads", () => {
    render(<DemoOutreachInbox />);

    expect(screen.getByText(/These messages illustrate the workflow/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Organizer summary" })).toBeTruthy();
    expect(screen.getByLabelText("Suggested reply").hasAttribute("readonly")).toBe(true);
    expect((screen.getByRole("button", { name: "Preview only" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText(/demo/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Bangalore International Centre/ }));

    expect(screen.getByRole("heading", { name: "Bangalore International Centre" })).toBeTruthy();
    expect(screen.getByText("The venue asked for the event date and seating format.")).toBeTruthy();
    expect((screen.getByLabelText("Suggested reply") as HTMLTextAreaElement).value).toContain(
      "theatre-style seating for 200",
    );
  });
});
