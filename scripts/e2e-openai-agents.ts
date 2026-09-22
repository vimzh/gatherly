// Runs the real OpenAI agent pipeline against controlled evidence without web or email side effects.
import OpenAI from "openai";
import {
  OPENAI_MODEL,
  critiqueResearch,
  discoverCandidates,
  planVenueSearch,
  researchBrief,
} from "../convex/research";
import type { FirecrawlEvidence } from "../convex/lib/firecrawlEvidence";
import { runResearchWorkflow } from "../convex/lib/researchWorkflow";

const scenarios = [
  [
    "Austin technology conference",
    "Austin",
    350,
    "A technology conference for 350 attendees in Austin with a keynote stage, reliable Wi-Fi, and at least three breakout rooms.",
  ],
  [
    "Bengaluru developer meetup",
    "Bengaluru",
    200,
    "An evening developer meetup for 200 people in Bengaluru with projection, public-transit access, and vegetarian catering options.",
  ],
  [
    "New York product launch",
    "New York",
    500,
    "A product launch for 500 guests in New York with a stage, loading access, strong production capabilities, and room for a branded installation.",
  ],
  [
    "Amsterdam design workshop",
    "Amsterdam",
    60,
    "A two-day design workshop for 60 people in Amsterdam with natural light, movable furniture, breakout space, and step-free access.",
  ],
  [
    "Singapore wedding reception",
    "Singapore",
    280,
    "A wedding reception for 280 guests in Singapore with a ballroom, in-house catering, parking, and a dance floor.",
  ],
  [
    "Sydney esports tournament",
    "Sydney",
    600,
    "An esports tournament for 600 spectators in Sydney with high-capacity internet, substantial power, a competition stage, and loading access.",
  ],
  [
    "Dubai awards dinner",
    "Dubai",
    450,
    "A formal awards dinner for 450 guests in Dubai with a ballroom, stage production, accessible entry, and nearby prayer facilities.",
  ],
  [
    "Chicago trade show",
    "Chicago",
    800,
    "A trade show for 800 attendees in Chicago with exhibition floor space, loading docks, catering, and public-transit access.",
  ],
  [
    "Lisbon music showcase",
    "Lisbon",
    220,
    "A live music showcase for 220 guests in Lisbon with a stage, suitable acoustics, backstage space, and late-evening operation.",
  ],
  [
    "Tokyo startup summit",
    "Tokyo",
    350,
    "A bilingual startup summit for 350 attendees in Tokyo with interpretation support, a keynote stage, breakout rooms, and convenient rail access.",
  ],
] as const;

function makeEvidence(label: string, location: string, attendeeCount: number) {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const pages: FirecrawlEvidence["pages"] = [];
  const images: FirecrawlEvidence["images"] = [];

  const venueTypes = [
    "Convention Hall",
    "Civic Pavilion",
    "Exchange Centre",
    "Grand Assembly",
    "Riverside Forum",
    "Central Auditorium",
  ];
  for (let number = 1; number <= 4; number += 1) {
    const name = `${location} ${venueTypes[number - 1]}`;
    const root = `https://${slug}-${number}.example.com`;
    const email = `events@${slug}-${number}.example.com`;
    const imageUrl = `${root}/images/main-hall.jpg`;
    pages.push({
      purpose: "venue",
      title: `${name} official venue hire`,
      url: root,
      description: `${name} is a physical event venue in ${location}.`,
      summary: `Official venue information lists capacity for ${attendeeCount + number * 100} guests, event Wi-Fi, staging, catering options, accessible entry, and flexible rooms. Pricing and availability require confirmation.`,
      markdown: `Maximum event capacity: ${attendeeCount + number * 100}. Public venue hire email: ${email}. The venue publishes event Wi-Fi, staging, catering options, accessible entry, and flexible rooms.`,
      emails: [email],
      links: [`${root}/capacity`, `${root}/contact`, `${root}/venue-hire`],
      images: [imageUrl],
    });
    pages.push({
      purpose: "review",
      title: `${name} public reviews`,
      url: `https://reviews.example.com/${slug}-${number}`,
      description: `Public review profile for ${name}.`,
      summary: `Rated ${4.1 + number / 10} out of 5 from ${80 + number * 25} reviews. Reviews commonly mention professional staff, transport access, and clean event spaces.`,
      markdown: `Public rating: ${4.1 + number / 10} out of 5 from ${80 + number * 25} reviews.`,
      emails: [],
      links: [],
      images: [],
    });
    images.push({ url: imageUrl, sourceUrl: root, title: `${name} main hall` });
  }

  return { pages, images } satisfies FirecrawlEvidence;
}

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("OPENAI_API_KEY is missing.");
const client = new OpenAI({ apiKey, maxRetries: 1, timeout: 120_000 });
const results: string[] = [];

for (const [index, [label, location, attendeeCount, brief]] of scenarios.entries()) {
  console.log(`\n[${index + 1}/${scenarios.length}] ${label}`);
  try {
    const searchPlan = await planVenueSearch(client, brief);
    if (searchPlan.location.toLowerCase() !== location.toLowerCase()) {
      throw new Error(`Planner changed location to ${searchPlan.location}.`);
    }
    if (searchPlan.attendeeCount !== attendeeCount) {
      throw new Error(`Planner changed attendance to ${searchPlan.attendeeCount}.`);
    }

    const evidence = makeEvidence(label, location, attendeeCount);
    const candidates = await discoverCandidates(client, brief, searchPlan, evidence);
    const result = await runResearchWorkflow(
      brief,
      evidence,
      {
        research: (eventBrief, sources) =>
          researchBrief(client, eventBrief, searchPlan, candidates, sources),
        critique: (eventBrief, plan, sources) =>
          critiqueResearch(
            client,
            eventBrief,
            searchPlan,
            candidates,
            plan,
            sources,
          ),
      },
      searchPlan,
    );

    if (candidates.length !== 4) throw new Error("Scout did not return four candidates.");
    if (result.verification.length !== 14 || result.verification.some((check) => !check.passed)) {
      throw new Error(
        `Verifier failed: ${result.verification.filter((check) => !check.passed).map((check) => check.key).join(", ")}`,
      );
    }
    if (result.plan.venues.length < 2 || result.plan.venues.length > 5) {
      throw new Error(`Researcher returned ${result.plan.venues.length} venues.`);
    }
    if (result.plan.venues.some((venue) => !venue.outreach.body.includes("?"))) {
      throw new Error("A draft did not ask an explicit question.");
    }

    const top = result.plan.venues[0];
    console.log(
      `  planner: ${searchPlan.location} | ${searchPlan.attendeeCount} | ${searchPlan.eventType}`,
    );
    console.log(`  scout: ${candidates.length} candidates`);
    console.log(
      `  result: ${result.plan.venues.length} venues | top score ${top.recommendationScore}/100 | verifier 14/14 | outreach draft-only`,
    );
    results.push(`${index + 1}. PASS — ${label}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown failure";
    console.log(`  failure: ${message}`);
    results.push(`${index + 1}. FAIL — ${label} — ${message}`);
  }
}

console.log(`\n${results.join("\n")}`);
if (results.some((result) => result.includes("FAIL"))) {
  throw new Error("One or more OpenAI agent scenarios failed.");
}

console.log(`\nModel: ${OPENAI_MODEL}. No web search or outreach was performed.`);
