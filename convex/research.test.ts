// Guards the OpenAI runtime budget against Convex's ten-minute action limit.
import type OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import {
  beforeDeadline,
  discoverCandidates,
  OPENAI_REQUEST_OPTIONS,
  RESEARCH_ACTION_DEADLINE_MS,
} from "./research";
import type { FirecrawlEvidence } from "./lib/firecrawlEvidence";

describe("research runtime budget", () => {
  it("leaves time to persist a provider timeout as a failed run", () => {
    expect(OPENAI_REQUEST_OPTIONS.maxRetries).toBe(0);
    expect(RESEARCH_ACTION_DEADLINE_MS).toBeLessThan(10 * 60_000);
  });

  it("rejects hung provider work when the shared deadline aborts", async () => {
    const controller = new AbortController();
    const guarded = beforeDeadline(new Promise<never>(() => undefined), controller.signal);

    controller.abort();

    await expect(guarded).rejects.toThrow("Research deadline exceeded.");
  });

  it("rejects a candidate website absent from Firecrawl discovery", async () => {
    const candidates = [1, 2, 3, 4].map((number) => ({
      name: `Venue ${number}`,
      location: "Bengaluru",
      websiteUrl:
        number === 4
          ? "https://hallucinated.example.org"
          : `https://venue-${number}.example.com`,
    }));
    const client = {
      responses: {
        parse: vi.fn().mockResolvedValue({
          output_parsed: { candidates, rejectedCandidates: [] },
        }),
      },
    } as unknown as OpenAI;
    const evidence: FirecrawlEvidence = {
      pages: candidates.slice(0, 3).map((candidate) => ({
        purpose: "venue",
        title: candidate.name,
        url: candidate.websiteUrl,
        description: "Venue page",
        summary: "Venue summary",
        markdown: "Venue details",
        emails: [],
        links: [],
        images: [],
      })),
      images: [],
    };

    await expect(
      discoverCandidates(
        client,
        "Developer meetup for 200 people in Bengaluru",
        {
          location: "Bengaluru",
          attendeeCount: 200,
          eventType: "developer meetup",
        },
        evidence,
      ),
    ).rejects.toThrow("did not return four distinct HTTPS venue URLs");
  });

  it("keeps distinct non-Latin venue names", async () => {
    const names = ["東京会館", "渋谷ホール", "新宿文化センター", "浅草公会堂"];
    const candidates = names.map((name, index) => ({
      name,
      location: "東京",
      websiteUrl: `https://venue-${index + 1}.example.jp`,
    }));
    const client = {
      responses: {
        parse: vi.fn().mockResolvedValue({
          output_parsed: { candidates, rejectedCandidates: [] },
        }),
      },
    } as unknown as OpenAI;
    const evidence: FirecrawlEvidence = {
      pages: candidates.map((candidate) => ({
        purpose: "venue",
        title: candidate.name,
        url: candidate.websiteUrl,
        description: "Venue page",
        summary: "Venue summary",
        markdown: "Venue details",
        emails: [],
        links: [],
        images: [],
      })),
      images: [],
    };

    const result = await discoverCandidates(
      client,
      "東京で200人の開発者ミートアップ",
      { location: "東京", attendeeCount: 200, eventType: "ミートアップ" },
      evidence,
    );

    expect(result.candidates.map((candidate) => candidate.name)).toEqual(names);
  });
});
