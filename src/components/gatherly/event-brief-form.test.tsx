// @vitest-environment jsdom
// Protects the keyboard-focus behavior of the event brief composer.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  vi.resetAllMocks();
  sessionStorage.clear();
});

function fillCredentials() {
  fireEvent.click(screen.getByRole("button", { name: "Configure keys" }));
  fireEvent.change(screen.getByLabelText("OpenAI API key"), {
    target: { value: "sk-test" },
  });
  fireEvent.change(screen.getByLabelText("Firecrawl API key"), {
    target: { value: "fc-test" },
  });
  fireEvent.change(screen.getByLabelText("AgentMail API key"), {
    target: { value: "am-test" },
  });
  fireEvent.change(screen.getByLabelText("AgentMail inbox ID"), {
    target: { value: "gatherly@agentmail.test" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save keys" }));
}

describe("event brief form", () => {
  it("keeps the submitted brief stable and blocks duplicates until navigation", async () => {
    let completeCreate!: (value: { eventId: string; sendToken: string }) => void;
    mocks.createEvent.mockReturnValue(new Promise((resolve) => { completeCreate = resolve; }));
    render(<EventBriefForm />);
    const composer = screen.getByRole("textbox", {
      name: "Describe your event and venue requirements",
    }) as HTMLTextAreaElement;
    fireEvent.change(composer, { target: { value: "  Demo event for 300 people  " } });
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Find venues" }));
    fireEvent.submit(composer.closest("form")!);
    expect(composer.readOnly).toBe(true);
    expect((screen.getByRole("button", { name: /Creative showcase/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(mocks.createEvent).toHaveBeenCalledTimes(1);
    expect(mocks.createEvent).toHaveBeenCalledWith({ brief: "Demo event for 300 people", requestKey: expect.any(String) });

    await act(async () => completeCreate({ eventId: "event-id", sendToken: "send-token" }));
    expect(mocks.push).toHaveBeenCalledWith("/event/?id=event-id&token=send-token");
    expect(JSON.parse(sessionStorage.getItem("gatherly:provider-credentials:event-id")!))
      .toMatchObject({ openaiApiKey: "sk-test", agentMailInboxId: "gatherly@agentmail.test" });
    expect((screen.getByRole("button", { name: "Creating event" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("preserves the brief and reuses the request key when creation is retried", async () => {
    mocks.createEvent.mockRejectedValueOnce(new Error("Connection interrupted"));
    mocks.createEvent.mockResolvedValueOnce({ eventId: "event-id", sendToken: "send-token" });
    render(<EventBriefForm />);
    const composer = screen.getByRole("textbox", {
      name: "Describe your event and venue requirements",
    }) as HTMLTextAreaElement;
    fireEvent.change(composer, { target: { value: "Demo event" } });
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Find venues" }));
    await act(async () => {});
    expect(screen.getByRole("alert").textContent).toBe("Connection interrupted");
    expect(composer.value).toBe("Demo event");
    expect(composer.readOnly).toBe(false);
    expect(document.activeElement).toBe(composer);
    fireEvent.click(screen.getByRole("button", { name: "Find venues" }));
    await act(async () => {});
    expect(mocks.createEvent.mock.calls[1][0].requestKey).toBe(mocks.createEvent.mock.calls[0][0].requestKey);
    expect(mocks.push).toHaveBeenCalledTimes(1);
  });

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

  it("fills the composer from a detailed example card", () => {
    render(<EventBriefForm />);

    fireEvent.click(screen.getByRole("button", { name: /Creative showcase/i }));

    expect((screen.getByRole("textbox", {
      name: "Describe your event and venue requirements",
    }) as HTMLTextAreaElement).value).toBe(
      "A creative showcase for 180 guests in Berlin with a stage and late-evening access",
    );
    expect(screen.getByText("180 guests")).toBeTruthy();
    expect(screen.getByText("Stage · Late-evening access")).toBeTruthy();
  });

  it("loads an uploaded text brief into the composer", async () => {
    render(<EventBriefForm />);
    const input = screen.getByLabelText("Choose brief file") as HTMLInputElement;
    const file = new File(["# Brief"], "developer-meetup.md", {
      type: "text/markdown",
    });
    Object.defineProperty(file, "text", { value: async () => "# Brief" });

    expect(input.accept).toContain(".md");
    const click = vi.spyOn(input, "click");
    fireEvent.click(screen.getByRole("button", { name: "Upload text brief" }));
    expect(click).toHaveBeenCalledOnce();
    fireEvent.change(input, { target: { files: [file] } });

    await act(async () => {});

    expect(screen.getByRole("button", { name: "Replace brief file: developer-meetup.md" })).toBeTruthy();
    expect(screen.getByText("developer-meetup.md")).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Describe your event and venue requirements" }) as HTMLTextAreaElement).value).toBe("# Brief");
    expect(mocks.createEvent).not.toHaveBeenCalled();
  });

  it("rejects a non-text upload without replacing the brief", async () => {
    render(<EventBriefForm />);
    const input = screen.getByLabelText("Choose brief file") as HTMLInputElement;
    const file = new File(["binary"], "brief.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });
    await act(async () => {});

    expect(screen.getByRole("alert").textContent).toContain(".txt or .md");
    expect((screen.getByRole("textbox", { name: "Describe your event and venue requirements" }) as HTMLTextAreaElement).value).toBe("");
  });

  it("opens key configuration when a live search has no credentials", () => {
    render(<EventBriefForm />);
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "Describe your event and venue requirements",
      }),
      { target: { value: "A 200-person meetup in Bengaluru" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Find venues" }));

    expect(screen.getByRole("heading", { name: "Configure provider keys" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("all four provider credentials");
    expect(mocks.createEvent).not.toHaveBeenCalled();
  });

  it("starts the Bengaluru agent replay without changing the brief", () => {
    render(<EventBriefForm />);
    const composer = screen.getByRole("textbox", {
      name: "Describe your event and venue requirements",
    }) as HTMLTextAreaElement;
    const demo = screen.getByRole("link", { name: /Bengaluru/ });

    expect(demo.getAttribute("href")).toBe(
      "/event/?id=j5772sbbtpkpyyx2gqz3c9f72d8ewfms&demo=agents",
    );
    expect(screen.queryByText("Full demo")).toBeNull();
    demo.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(demo);
    expect(composer.value).toBe("");
    expect(screen.queryByText("Want to see Gatherly before adding keys?")).toBeNull();
  });
});
