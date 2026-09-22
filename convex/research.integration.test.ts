// Exercises event creation, scheduled research, review persistence, and approved outreach without network access.
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { ResearchPlan } from "./lib/researchWorkflow";
import { RESEARCH_ACTION_DEADLINE_MS } from "./research";
import { RESEARCH_WATCHDOG_MS } from "./researchData";
import schema from "./schema";

const providers = vi.hoisted(() => ({
  parse: vi.fn(),
  search: vi.fn(),
  send: vi.fn(),
}));

vi.mock("openai", () => ({
  default: class {
    responses = { parse: providers.parse };
  },
}));
const modules = import.meta.glob("./**/*.ts");
const brief = "A 300-person hackathon in London";
const researchCredentials = {
  openaiApiKey: "test-openai-key",
  firecrawlApiKey: "test-firecrawl-key",
};
const outreachCredentials = {
  agentMailApiKey: "test-agentmail-key",
  agentMailInboxId: "gatherly@agentmail.test",
};
const searchPlan = { location: "London", attendeeCount: 300, eventType: "hackathon" };
const candidates = [1, 2, 3, 4].map((number) => ({
  name: `Venue ${number}`,
  location: "London",
  websiteUrl: `https://venue-${number}.example.com/`,
}));
const venuePages = candidates.map((candidate, index) => ({
  title: candidate.name,
  url: candidate.websiteUrl,
  markdown: `London event venue with capacity for 400. Email events@venue-${index + 1}.example.com for availability and pricing.`,
  images: [`https://venue-${index + 1}.example.com/photo.jpg`],
}));
const reviewPages = candidates.map((candidate, index) => ({
  title: `${candidate.name} customer reviews`,
  url: `https://reviews.example.com/venue-${index + 1}`,
  markdown: `${candidate.name}: event attendees rate the venue 4 out of 5 from 20 reviews.`,
}));
const plan: ResearchPlan = {
  title: "London hackathon venues",
  requirements: {
    ...searchPlan,
    dateOrWindow: null,
    mustHaves: [],
    missingDetails: ["Event date"],
  },
  venues: candidates.map((candidate, index) => ({
    ...candidate,
    address: null,
    fitSummary: "Published capacity meets the brief; availability needs confirmation.",
    recommendationScore: 90 - index * 5,
    recommendationReason: "Published capacity and an official public email; confirm pricing.",
    amenities: [],
    accessibilityNotes: null,
    pricingNotes: null,
    capacity: {
      maximum: 400,
      notes: "Published event capacity.",
      sourceUrl: candidate.websiteUrl,
    },
    contact: {
      type: "email",
      value: `events@venue-${index + 1}.example.com`,
      sourceUrl: candidate.websiteUrl,
    },
    evidence: [{
      claim: "Published capacity for 400 attendees.",
      sourceTitle: candidate.name,
      sourceUrl: candidate.websiteUrl,
    }],
    images: [{
      url: venuePages[index].images[0],
      sourceUrl: candidate.websiteUrl,
      alt: candidate.name,
    }],
    reviews: [{
      sourceName: "Customer reviews",
      rating: 4,
      reviewCount: 20,
      summary: "Event attendees reviewed the venue.",
      sourceUrl: reviewPages[index].url,
    }],
    outreach: {
      subject: "London hackathon venue enquiry",
      body: "Could you confirm availability, capacity, accessibility, restrictions, and pricing?",
    },
  })),
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-22T12:00:00Z"));
  providers.send.mockReset().mockRejectedValue(new Error("Unexpected network request"));
  providers.search.mockReset().mockImplementation(async (query: string) => ({
    web: query.includes("customer reviews") ? reviewPages : venuePages,
  }));
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    if (String(input) === "https://api.firecrawl.dev/v2/search") {
      const request = JSON.parse(String(init?.body));
      return Response.json({ success: true, data: await providers.search(request.query) });
    }
    return providers.send(input, init);
  }));
  providers.parse.mockReset().mockImplementation(async (request) => {
    switch (request.text.format.name) {
      case "venue_search_plan":
        return { output_parsed: structuredClone(searchPlan) };
      case "venue_candidates":
        return { output_parsed: { candidates: structuredClone(candidates), rejectedCandidates: [] } };
      case "venue_research":
        return { output_parsed: structuredClone(plan) };
      case "venue_research_critique":
        return { output_parsed: {
          approved: true,
          summary: "The evidence supports the shortlist; confirm missing details with each venue.",
          issues: [],
          revisedPlan: structuredClone(plan),
        } };
      default:
        throw new Error(`Unexpected OpenAI schema: ${request.text.format.name}`);
    }
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function createAndResearch() {
  const t = convexTest(schema, modules);
  const created = await t.mutation(api.events.create, {
    brief,
    requestKey: "integration-event",
  });
  expect((await t.query(api.events.get, { eventId: created.eventId }))?.researchStage)
    .toBe("queued");
  await t.action(api.research.generateForEvent, {
    eventId: created.eventId,
    sendToken: created.sendToken,
    ...researchCredentials,
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  return { t, ...created };
}

async function startAbandonedAttempt() {
  const t = convexTest(schema, modules);
  const eventId = await t.run((ctx) => ctx.db.insert("events", {
    brief, title: brief, requestKey: "abandoned-action", status: "researching",
    researchStage: "queued", isDemo: true, activities: [],
  }));
  const attempt = await t.mutation(internal.researchData.begin, { eventId });
  return { t, eventId, attemptId: attempt!.attemptId };
}

describe("event research and outreach integration", () => {
  it("durably fails an abandoned action after the watchdog delay without restarting providers", async () => {
    const { t, eventId, attemptId } = await startAbandonedAttempt();
    expect(RESEARCH_WATCHDOG_MS).toBeGreaterThan(RESEARCH_ACTION_DEADLINE_MS);
    expect(await t.mutation(internal.researchData.begin, { eventId })).toBeNull();
    await vi.advanceTimersByTimeAsync(RESEARCH_WATCHDOG_MS - 1);
    expect((await t.query(api.events.get, { eventId }))?.researchStage).toBe("running");
    await vi.advanceTimersByTimeAsync(1);
    await t.finishInProgressScheduledFunctions();
    const event = await t.query(api.events.get, { eventId });
    expect(event).toMatchObject({
      status: "failed", researchStage: "failed", researchAttemptId: attemptId,
      researchError: "Venue research stopped before completion. Please try again.",
    });
    expect(event?.activities.some((activity) => activity.state === "failed")).toBe(true);
    expect(providers.parse).not.toHaveBeenCalled();
    expect(providers.search).not.toHaveBeenCalled();
    expect(providers.send).not.toHaveBeenCalled();
  });

  it("ignores old attempt writes and watchdogs during a newer attempt and after completion", async () => {
    const { t, eventId, attemptId } = await startAbandonedAttempt();
    await t.mutation(internal.researchData.fail, {
      eventId, attemptId, message: "First worker failed.",
    });
    await vi.advanceTimersByTimeAsync(60_000);
    const next = await t.mutation(internal.researchData.begin, { eventId });
    expect(next?.attemptId).not.toBe(attemptId);
    const current = await t.query(api.events.get, { eventId });
    const completion = {
      eventId, attemptId, model: "test-model", plan, rejectedCandidates: [],
      reviewSummary: "Reviewed fixture", issues: [], verification: [],
    };
    await t.mutation(internal.researchData.setAgentStage, {
      eventId, attemptId, stage: "discovering",
    });
    await t.mutation(internal.researchData.recordSearchQuery, {
      eventId, attemptId, researchQuery: "Stale search query",
    });
    await t.mutation(internal.researchData.complete, completion);
    await t.mutation(internal.researchData.fail, {
      eventId, attemptId, message: "Stale action failure",
    });
    await vi.advanceTimersByTimeAsync(RESEARCH_WATCHDOG_MS - 60_000);
    await t.finishInProgressScheduledFunctions();
    expect(await t.query(api.events.get, { eventId })).toEqual(current);
    expect(await t.query(api.researchData.getByEvent, { eventId })).toEqual({
      venues: [], drafts: [], rejectedCandidates: [],
    });
    await t.mutation(internal.researchData.complete, {
      ...completion, attemptId: next!.attemptId,
    });
    const completed = await t.query(api.events.get, { eventId });
    expect(completed?.status).toBe("review_ready");
    await vi.advanceTimersByTimeAsync(60_000);
    await t.finishInProgressScheduledFunctions();
    expect(await t.query(api.events.get, { eventId })).toEqual(completed);
    expect((await t.query(api.researchData.getByEvent, { eventId }))?.venues).toHaveLength(4);
    expect(providers.parse).not.toHaveBeenCalled();
    expect(providers.search).not.toHaveBeenCalled();
    expect(providers.send).not.toHaveBeenCalled();
  });

  it("persists a deadline failure while Firecrawl is hung and ignores its late result", async () => {
    let releaseSearch!: () => void;
    let signalSearchStarted!: () => void;
    const blockedSearch = new Promise<void>((resolve) => { releaseSearch = resolve; });
    const searchStarted = new Promise<void>((resolve) => { signalSearchStarted = resolve; });
    const search = providers.search.getMockImplementation()!;
    providers.search.mockImplementation(async (...args) => {
      signalSearchStarted();
      await blockedSearch;
      return search(...args);
    });
    const t = convexTest(schema, modules);
    const { eventId, sendToken } = await t.mutation(api.events.create, {
      brief, requestKey: "hung-firecrawl",
    });
    const research = t.action(api.research.generateForEvent, {
      eventId,
      sendToken,
      ...researchCredentials,
    });
    await searchStarted;
    try {
      await vi.advanceTimersByTimeAsync(RESEARCH_ACTION_DEADLINE_MS);
      const failed = await t.query(api.events.get, { eventId });
      expect(failed).toMatchObject({ status: "failed", researchStage: "failed" });
      expect(failed?.researchError).toContain("processing limit");
    } finally {
      // Release the provider even when the assertion fails so no scheduled action leaks.
      releaseSearch();
      await research;
      await t.finishInProgressScheduledFunctions();
    }
    expect((await t.query(api.events.get, { eventId }))?.status).toBe("failed");
    expect(await t.query(api.researchData.getByEvent, { eventId })).toEqual({
      venues: [], drafts: [], rejectedCandidates: [],
    });
    expect(providers.parse).toHaveBeenCalledTimes(1);
    expect(providers.send).not.toHaveBeenCalled();
  });

  it("runs the visitor-funded pipeline, persists results, and sends one authorized draft", async () => {
    const { t, eventId, sendToken } = await createAndResearch();
    const event = await t.query(api.events.get, { eventId });
    const research = await t.query(api.researchData.getByEvent, { eventId });

    expect(event).toMatchObject({
      title: plan.title,
      status: "review_ready",
      researchStage: "review_ready",
      agentTrace: ["planning", "discovering", "enriching", "synthesizing", "critiquing", "verifying"],
    });
    expect(event).not.toHaveProperty("sendToken");
    expect(event?.aiReview?.verification.length).toBeGreaterThan(0);
    expect(event?.aiReview?.verification.every((check) => check.passed)).toBe(true);
    expect(event?.activities.at(-1)?.state).toBe("approval_required");
    expect(research?.venues).toHaveLength(4);
    expect(research?.drafts).toHaveLength(4);
    expect(research?.drafts.every((draft) => draft.status === "draft")).toBe(true);
    expect(providers.parse).toHaveBeenCalledTimes(4);
    expect(providers.search).toHaveBeenCalledTimes(10);
    expect(providers.send).not.toHaveBeenCalled();

    const draftId = research!.drafts[0]._id;
    await expect(t.action(api.outreach.sendDraft, {
      eventId, draftId, sendToken: "wrong-token", ...outreachCredentials,
    })).rejects.toThrow("not authorized");
    expect(providers.send).not.toHaveBeenCalled();
    providers.send.mockResolvedValue(Response.json({
      message_id: "integration-message", thread_id: "integration-thread",
    }));
    const args = { eventId, draftId, sendToken, ...outreachCredentials };
    const sent = await t.action(api.outreach.sendDraft, args);
    expect(sent).toEqual({
      status: "sent", messageId: "integration-message", threadId: "integration-thread",
    });
    expect(await t.action(api.outreach.sendDraft, args)).toEqual(sent);
    expect(providers.send).toHaveBeenCalledTimes(1);
    const [url, request] = providers.send.mock.calls[0];
    expect(url).toBe("https://api.agentmail.to/v0/inboxes/gatherly%40agentmail.test/messages/send");
    expect(request.headers["Idempotency-Key"]).toBe(`gatherly.${draftId}`);
    expect(JSON.parse(request.body)).toMatchObject({
      to: [plan.venues[0].contact.value],
      subject: plan.venues[0].outreach.subject,
      text: plan.venues[0].outreach.body,
    });
    const persisted = await t.query(api.researchData.getByEvent, { eventId });
    expect(persisted?.drafts[0]).toMatchObject({
      status: "sent",
      agentMailMessageId: "integration-message",
      agentMailThreadId: "integration-thread",
    });
    expect(persisted?.drafts.slice(1).every((draft) => draft.status === "draft")).toBe(true);

    await t.action(api.research.generateForEvent, {
      eventId,
      sendToken,
      ...researchCredentials,
    });
    expect(providers.parse).toHaveBeenCalledTimes(4);
    expect((await t.query(api.researchData.getByEvent, { eventId }))?.venues).toHaveLength(4);
  });

  it("persists failed verification and publishes no drafts even when the critic approves", async () => {
    const respond = providers.parse.getMockImplementation()!;
    providers.parse.mockImplementation(async (request) => {
      const response = await respond(request);
      if (request.text.format.name === "venue_research_critique") {
        response.output_parsed.revisedPlan.venues[0].outreach.body =
          "We have booked the venue. Can you confirm the details?";
      }
      return response;
    });
    const { t, eventId } = await createAndResearch();
    const event = await t.query(api.events.get, { eventId });
    expect(event).toMatchObject({
      status: "failed", researchStage: "failed",
      researchError: "Final verification failed: outreach_safety.",
    });
    expect(event?.aiReview?.verification).toContainEqual(expect.objectContaining({
      key: "outreach_safety", passed: false,
    }));
    expect(await t.query(api.researchData.getByEvent, { eventId })).toEqual({
      venues: [], drafts: [], rejectedCandidates: [],
    });
    expect(providers.send).not.toHaveBeenCalled();
  });

  it.each(["OpenAI", "Firecrawl"])("persists a %s failure instead of leaving research running", async (provider) => {
    if (provider === "OpenAI") providers.parse.mockRejectedValue(new Error("OpenAI test outage"));
    else providers.search.mockRejectedValue(new Error("Firecrawl test outage"));
    const { t, eventId } = await createAndResearch();
    const event = await t.query(api.events.get, { eventId });
    expect(event).toMatchObject({
      status: "failed", researchStage: "failed", researchError: `${provider} test outage`,
    });
    expect(event?.activities.some((activity) => activity.state === "failed")).toBe(true);
    expect(await t.query(api.researchData.getByEvent, { eventId })).toEqual({
      venues: [], drafts: [], rejectedCandidates: [],
    });
    expect(providers.send).not.toHaveBeenCalled();
  });
});
