// Exercises the research, critic, and verification pipeline across representative event briefs.
import { describe, expect, it, vi } from "vitest";
import {
  ResearchReviewError,
  runResearchWorkflow,
  verifyResearchPlan,
  type ResearchPlan,
} from "./researchWorkflow";
import type { FirecrawlEvidence } from "./firecrawlEvidence";
import {
  buildBroadVenueDiscoveryQuery,
  buildFirecrawlQuery,
  buildVenueDiscoveryQuery,
  buildVenueEnrichmentQuery,
  mergeFirecrawlEvidence,
  normalizeFirecrawlEvidence,
} from "./firecrawlEvidence";

type Scenario = readonly [
  label: string,
  location: string,
  attendeeCount: number,
  eventType: string,
  mustHave: string,
];

const scenarios: readonly Scenario[] = [
  ["London hackathon", "London", 300, "hackathon", "overnight access"],
  ["Berlin gallery show", "Berlin", 180, "creative showcase", "a stage"],
  ["San Francisco offsite", "San Francisco", 120, "company offsite", "catering"],
  ["Manchester charity dinner", "Manchester", 250, "charity dinner", "step-free access"],
  ["Paris fashion show", "Paris", 400, "fashion show", "backstage space"],
  ["Bengaluru meetup", "Bengaluru", 80, "community meetup", "a projector"],
  ["New York launch", "New York", 500, "product launch", "loading access"],
  ["Amsterdam workshop", "Amsterdam", 60, "workshop", "breakout rooms"],
];

function makePlan(
  [label, location, attendeeCount, eventType, mustHave]: Scenario,
  unsafe = false,
): ResearchPlan {
  return {
    title: label,
    requirements: {
      location,
      attendeeCount,
      dateOrWindow: "October 2026",
      eventType,
      mustHaves: [mustHave],
      missingDetails: ["Exact date", "Budget"],
    },
    venues: [1, 2].map((number) => ({
      name: `${label} Venue ${number}`,
      location,
      websiteUrl: `https://venue-${number}.example.com`,
      address: `${number} Example Street, ${location}`,
      fitSummary: `A possible ${eventType} venue with ${mustHave}.`,
      recommendationScore: 90 - number * 5,
      recommendationReason: `Strong sourced fit for ${eventType}; confirm final availability.`,
      amenities: [mustHave, "Wi-Fi"],
      accessibilityNotes: "Step-free details are published by the venue.",
      pricingNotes: "Pricing requires an enquiry.",
      capacity: {
        maximum: attendeeCount + number * 100,
        notes: "Published maximum standing capacity.",
        sourceUrl: `https://venue-${number}.example.com/capacity`,
      },
      contact: {
        type: "email" as const,
        value: `events@venue-${number}.example.com`,
        sourceUrl: `https://venue-${number}.example.com/contact`,
      },
      evidence: [
        {
          claim: `The venue publishes information about ${mustHave}.`,
          sourceTitle: `${label} Venue ${number} events page`,
          sourceUrl: `https://venue-${number}.example.com/events`,
        },
      ],
      images: [
        {
          url: `https://images.example.com/${number}.jpg`,
          sourceUrl: `https://venue-${number}.example.com`,
          alt: `${label} Venue ${number}`,
        },
      ],
      reviews: [
        {
          sourceName: "Example Reviews",
          rating: 4.2,
          reviewCount: 120,
          summary: "Public reviews commonly mention helpful staff and a convenient location.",
          sourceUrl: `https://reviews.example.com/venue-${number}`,
        },
      ],
      outreach: {
        subject: `Enquiry: ${label}`,
        body: unsafe
          ? "Your booking is confirmed. Can you share the price?"
          : `Hello, we are considering ${label} Venue ${number}. Is the space available, and can you confirm capacity, pricing, restrictions, and ${mustHave}?`,
      },
    })),
  };
}

function makeEvidence(count = 2): FirecrawlEvidence {
  const venueNumbers = Array.from({ length: count }, (_, index) => index + 1);
  return {
    pages: venueNumbers.flatMap((number) => [
      {
        purpose: "venue" as const,
        title: `Venue ${number}`,
        url: `https://venue-${number}.example.com`,
        description: "Venue page",
        summary: "Venue summary",
        markdown: `Capacity, amenities, accessibility, and email events@venue-${number}.example.com.`,
        emails: [`events@venue-${number}.example.com`],
        links: [
          `https://venue-${number}.example.com/capacity`,
          `https://venue-${number}.example.com/contact`,
          `https://venue-${number}.example.com/events`,
        ],
        images: [`https://images.example.com/${number}.jpg`],
      },
      {
        purpose: "review" as const,
        title: `Venue ${number} reviews`,
        url: `https://reviews.example.com/venue-${number}`,
        description: "Public reviews",
        summary: "Review summary",
        markdown: "Rated 4.2 out of 5 from 120 public reviews.",
        emails: [],
        links: [],
        images: [],
      },
    ]),
    images: venueNumbers.map((number) => ({
      url: `https://images.example.com/${number}.jpg`,
      sourceUrl: `https://venue-${number}.example.com`,
      title: `Venue ${number}`,
    })),
  };
}

describe("research workflow scenarios", () => {
  it("keeps Firecrawl pages, images, and review provenance in a bounded bundle", () => {
    const evidence = normalizeFirecrawlEvidence(
      {
        web: [
          {
            markdown: `![unstructured](https://venue.example/unstructured.jpg)\n${"x".repeat(4_000)} events@venue.example.com`,
            links: ["https://venue.example/contact", "http://unsafe.example"],
            images: ["https://venue.example/room.jpg"],
            metadata: {
              title: "Venue",
              sourceURL: "https://venue.example",
            },
          },
        ],
        images: [
          {
            title: "Main hall",
            imageUrl: "https://cdn.example/hall.jpg",
            url: "https://venue.example/gallery",
          },
        ],
      },
      {
        web: [
          {
            title: "Venue reviews",
            url: "https://reviews.example/venue",
            description: "Public review profile",
          },
        ],
      },
    );

    expect(evidence.pages).toHaveLength(2);
    expect(evidence.pages[0].markdown).toHaveLength(3_000);
    expect(evidence.pages[0].markdown).not.toContain("unstructured.jpg");
    expect(evidence.pages[0].emails).toEqual(["events@venue.example.com"]);
    expect(evidence.pages[0].links).toEqual(["https://venue.example/contact"]);
    expect(evidence.images).toContainEqual({
      url: "https://cdn.example/hall.jpg",
      sourceUrl: "https://venue.example/gallery",
      title: "Main hall",
    });
    const query = buildFirecrawlQuery("x".repeat(600), "venue");
    expect(query.length).toBeLessThanOrEqual(500);
    expect(query).toContain("official capacity");
    expect(buildVenueDiscoveryQuery("London", 300, "hackathon")).toBe(
      '"London" hackathon venue 300 attendees capacity official contact email',
    );
    const broadQuery = buildBroadVenueDiscoveryQuery("London");
    expect(broadQuery).toContain("event venue event space venue hire");
    expect(broadQuery).not.toContain("300");

    const enrichmentQuery = buildVenueEnrichmentQuery(
      "Example Hall",
      "details",
      "London",
      "https://www.example.com/events",
    );
    expect(enrichmentQuery).toContain('"Example Hall"');
    expect(enrichmentQuery).toContain("site:example.com");
    expect(enrichmentQuery).toContain("contact email");
    expect(enrichmentQuery.length).toBeLessThanOrEqual(500);
    expect(buildVenueEnrichmentQuery("Example Hall", "review", "London")).toBe(
      '"Example Hall" London venue customer reviews ratings',
    );

    const merged = mergeFirecrawlEvidence(evidence, evidence);
    expect(merged.pages).toHaveLength(evidence.pages.length);
    expect(merged.images).toHaveLength(evidence.images.length);
  });

  it.each(scenarios)("reviews and verifies %s", async (...scenario) => {
    const draft = makePlan(scenario, true);
    const revisedPlan = makePlan(scenario);
    const evidence = makeEvidence();
    const research = vi.fn().mockResolvedValue(draft);
    const critique = vi.fn().mockResolvedValue({
      approved: true,
      summary: "Removed unsupported booking language and retained sourced candidates.",
      issues: [
        {
          severity: "blocker",
          venueName: null,
          field: "outreach.body",
          message: "The first draft falsely claimed a confirmed booking.",
        },
      ],
      revisedPlan,
    });

    const result = await runResearchWorkflow(
      scenario[0],
      evidence,
      { research, critique },
      {
        location: scenario[1],
        attendeeCount: scenario[2],
        eventType: scenario[3],
      },
    );

    expect(research).toHaveBeenCalledOnce();
    expect(critique).toHaveBeenCalledWith(scenario[0], draft, evidence);
    expect(result.verification).toHaveLength(14);
    expect(result.verification.every((check) => check.passed)).toBe(true);
    expect(result.plan.venues.every((venue) => !venue.outreach.body.includes("confirmed"))).toBe(
      true,
    );
    expect(result.plan.venues.map((venue) => venue.recommendationScore)).toEqual([85, 80]);
  });

  it("moves a weak candidate out when the remaining shortlist still verifies", async () => {
    const draft = makePlan(scenarios[0]);
    const weakVenue = structuredClone(draft.venues[1]);
    weakVenue.name = "London hackathon Venue 3";
    weakVenue.websiteUrl = "https://venue-3.example.com";
    weakVenue.recommendationScore = 20;
    weakVenue.capacity.sourceUrl = "https://venue-3.example.com/capacity";
    weakVenue.contact.value = "events@venue-3.example.com";
    weakVenue.contact.sourceUrl = "https://venue-3.example.com/contact";
    weakVenue.evidence[0].sourceUrl = "https://venue-3.example.com/events";
    weakVenue.images[0].url = "https://images.example.com/3.jpg";
    weakVenue.images[0].sourceUrl = "https://venue-3.example.com";
    weakVenue.reviews[0].sourceUrl = "https://reviews.example.com/venue-3";
    draft.venues.push(weakVenue);
    const result = await runResearchWorkflow(
      scenarios[0][0],
      makeEvidence(3),
      {
        research: async () => draft,
        critique: async () => ({
          approved: true,
          summary: "Two strong candidates remain after review.",
          issues: [
            {
              severity: "warning",
              venueName: draft.venues[2].name,
              field: "fit",
              message: "The evidence does not support the event requirements.",
            },
          ],
          revisedPlan: draft,
        }),
      },
    );

    expect(result.draft.venues).toHaveLength(3);
    expect(result.plan.venues.map((venue) => venue.recommendationScore)).toEqual([85, 80]);
    expect(result.verification.every((check) => check.passed)).toBe(true);
  });

  it("stops when the independent critic does not approve the revision", async () => {
    const plan = makePlan(scenarios[0]);
    await expect(
      runResearchWorkflow(scenarios[0][0], makeEvidence(), {
        research: async () => plan,
        critique: async () => ({
          approved: false,
          summary: "Capacity could not be independently verified.",
          issues: [
            {
              severity: "blocker",
              venueName: plan.venues[0].name,
              field: "capacity",
              message: "The cited page did not support the numeric capacity.",
            },
          ],
          revisedPlan: plan,
        }),
      }),
    ).rejects.toBeInstanceOf(ResearchReviewError);
  });

  it("stops when deterministic checks catch an unsafe revised plan", async () => {
    const plan = makePlan(scenarios[0]);
    plan.venues[0].capacity.maximum = 100;

    await expect(
      runResearchWorkflow(scenarios[0][0], makeEvidence(), {
        research: async () => plan,
        critique: async () => ({
          approved: true,
          summary: "Approved in error.",
          issues: [],
          revisedPlan: plan,
        }),
      }),
    ).rejects.toThrow("capacity_fit");
  });

  it("preserves the planner requirements when the critic drifts", async () => {
    const plan = makePlan(scenarios[0]);
    const revisedPlan = structuredClone(plan);
    revisedPlan.requirements.location = "Paris";
    revisedPlan.requirements.attendeeCount = 40;
    revisedPlan.requirements.eventType = "dinner";

    const result = await runResearchWorkflow(
      scenarios[0][0],
      makeEvidence(),
      {
        research: async () => plan,
        critique: async () => ({
          approved: true,
          summary: "The venue evidence is safe.",
          issues: [],
          revisedPlan,
        }),
      },
      {
        location: "London",
        attendeeCount: 300,
        eventType: "hackathon",
      },
    );

    expect(result.plan.requirements).toEqual(plan.requirements);
    expect(result.verification.find((check) => check.key === "agent_handoff")?.passed).toBe(
      true,
    );
  });

  it("grounds official website paths and removes duplicate properties", async () => {
    const plan = makePlan(scenarios[0]);
    plan.venues[0].websiteUrl = "https://venue-1.example.com/invented-path";
    plan.venues[0].contact.sourceUrl =
      "https://venue-1.example.com/invented-contact-path";
    plan.venues.push({
      ...structuredClone(plan.venues[1]),
      name: "Duplicate hotel sub-venue",
      recommendationScore: 20,
    });

    const result = await runResearchWorkflow(scenarios[0][0], makeEvidence(), {
      research: async () => plan,
      critique: async () => ({
        approved: true,
        summary: "The evidence is safe after deterministic normalization.",
        issues: [],
        revisedPlan: plan,
      }),
    });

    expect(result.plan.venues).toHaveLength(2);
    expect(result.plan.venues[0].websiteUrl).toBe("https://venue-1.example.com");
    expect(result.plan.venues[0].contact.sourceUrl).toBe(
      "https://venue-1.example.com",
    );
  });

  it("rejects employee-review pages as property reviews", () => {
    const plan = makePlan(scenarios[0]);
    plan.venues[0].reviews[0].sourceUrl = "https://www.glassdoor.com/Reviews/venue";
    const evidence = makeEvidence();
    evidence.pages.push({
      purpose: "review",
      title: "Employee reviews",
      url: "https://www.glassdoor.com/Reviews/venue",
      description: "Employee reviews",
      summary: "Workplace feedback",
      markdown: "Employee feedback",
      emails: [],
      links: [],
      images: [],
    });

    expect(
      verifyResearchPlan(plan, evidence).find(
        (check) => check.key === "property_profile",
      )?.passed,
    ).toBe(false);
  });

  it("keeps extra grounded venues when two profiles have full media and review evidence", () => {
    const plan = makePlan(scenarios[0]);
    plan.venues.push({
      ...structuredClone(plan.venues[1]),
      name: "Additional grounded venue",
      websiteUrl: "https://venue-3.example.com",
      images: [],
      reviews: [],
    });

    const profileCheck = () =>
      verifyResearchPlan(plan, makeEvidence()).find(
        (check) => check.key === "property_profile",
      )?.passed;

    expect(profileCheck()).toBe(true);
    plan.venues[1].reviews = [];
    expect(profileCheck()).toBe(false);
  });

  it("requires at least one AgentMail-ready venue", () => {
    const plan = makePlan(scenarios[0]);
    for (const [index, venue] of plan.venues.entries()) {
      venue.contact = {
        type: "contact_form",
        value: `https://venue-${index + 1}.example.com/contact`,
        sourceUrl: `https://venue-${index + 1}.example.com/contact`,
      };
    }

    const checks = verifyResearchPlan(plan, makeEvidence());
    expect(checks.find((check) => check.key === "agentmail_ready")?.passed).toBe(false);
    expect(checks.find((check) => check.key === "email_grounding")?.passed).toBe(true);
  });

  it("normalizes safe declarative outreach into an explicit question", async () => {
    const plan = makePlan(scenarios[0]);
    plan.venues[0].contact = {
      type: "contact_form",
      value: "Official contact form on the venue page",
      sourceUrl: "https://venue-1.example.com/contact",
    };
    for (const venue of plan.venues) {
      venue.outreach.body = "Please confirm availability, capacity, and pricing.";
    }

    const result = await runResearchWorkflow(scenarios[0][0], makeEvidence(), {
      research: async () => plan,
      critique: async () => ({
        approved: true,
        summary: "The evidence and outreach are safe.",
        issues: [],
        revisedPlan: plan,
      }),
    });

    expect(result.plan.venues.every((venue) => venue.outreach.body.includes("?"))).toBe(
      true,
    );
    expect(result.plan.venues[0].contact.value).toBe(
      "https://venue-1.example.com/contact",
    );
  });
});
