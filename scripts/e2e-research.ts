// Runs selectable live research scenarios and grades every stage without sending outreach.
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { buildVenueEnrichmentQuery } from "../convex/lib/firecrawlEvidence";

const scenarios = [
  {
    label: "London hackathon",
    location: "London",
    attendeeCount: 300,
    brief:
      "A 300-person hackathon in London in October with overnight access, strong Wi-Fi, and step-free entry.",
  },
  {
    label: "Berlin creative showcase",
    location: "Berlin",
    attendeeCount: 180,
    brief:
      "A creative showcase for 180 guests in Berlin with a stage, projection, and late-evening access.",
  },
  {
    label: "San Francisco offsite",
    location: "San Francisco",
    attendeeCount: 120,
    brief:
      "A company offsite for 120 people in San Francisco with catering, natural light, and breakout rooms.",
  },
  {
    label: "Manchester charity dinner",
    location: "Manchester",
    attendeeCount: 250,
    brief:
      "A charity dinner for 250 guests in Manchester with wheelchair access and an in-house kitchen.",
  },
  {
    label: "Paris fashion show",
    location: "Paris",
    attendeeCount: 400,
    brief:
      "A fashion show for 400 people in Paris with a runway, backstage rooms, and loading access.",
  },
  {
    label: "Austin technology conference",
    location: "Austin",
    attendeeCount: 350,
    brief:
      "A technology conference for 350 attendees in Austin with a keynote stage, reliable Wi-Fi, and at least three breakout rooms.",
  },
  {
    label: "Bengaluru developer meetup",
    location: "Bengaluru",
    attendeeCount: 200,
    brief:
      "An evening developer meetup for 200 people in Bengaluru with projection, public-transit access, and vegetarian catering options.",
  },
  {
    label: "New York product launch",
    location: "New York",
    attendeeCount: 500,
    brief:
      "A product launch for 500 guests in New York with a stage, loading access, strong production capabilities, and room for a branded installation.",
  },
  {
    label: "Amsterdam design workshop",
    location: "Amsterdam",
    attendeeCount: 60,
    brief:
      "A two-day design workshop for 60 people in Amsterdam with natural light, movable furniture, breakout space, and step-free access.",
  },
  {
    label: "Singapore wedding reception",
    location: "Singapore",
    attendeeCount: 280,
    brief:
      "A wedding reception for 280 guests in Singapore with a ballroom, in-house catering, parking, and a dance floor.",
  },
  {
    label: "Sydney esports tournament",
    location: "Sydney",
    attendeeCount: 600,
    brief:
      "An esports tournament for 600 spectators in Sydney with high-capacity internet, substantial power, a competition stage, and loading access.",
  },
  {
    label: "Dubai awards dinner",
    location: "Dubai",
    attendeeCount: 450,
    brief:
      "A formal awards dinner for 450 guests in Dubai with a ballroom, stage production, accessible entry, and nearby prayer facilities.",
  },
  {
    label: "Chicago trade show",
    location: "Chicago",
    attendeeCount: 800,
    brief:
      "A trade show for 800 attendees in Chicago with exhibition floor space, loading docks, catering, and public-transit access.",
  },
  {
    label: "Lisbon music showcase",
    location: "Lisbon",
    attendeeCount: 220,
    brief:
      "A live music showcase for 220 guests in Lisbon with a stage, suitable acoustics, backstage space, and late-evening operation.",
  },
  {
    label: "Tokyo startup summit",
    location: "Tokyo",
    attendeeCount: 350,
    brief:
      "A bilingual startup summit for 350 attendees in Tokyo with interpretation support, a keynote stage, breakout rooms, and convenient rail access.",
  },
] as const;

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL is missing.");
const scenarioStart = Number.parseInt(process.env.E2E_SCENARIO_START ?? "1", 10);
const scenarioLimit = Number.parseInt(process.env.E2E_SCENARIO_LIMIT ?? "5", 10);
if (!Number.isInteger(scenarioStart) || scenarioStart < 1 || scenarioStart > scenarios.length) {
  throw new Error(`E2E_SCENARIO_START must be between 1 and ${scenarios.length}.`);
}
const remainingScenarios = scenarios.length - scenarioStart + 1;
if (!Number.isInteger(scenarioLimit) || scenarioLimit < 1 || scenarioLimit > remainingScenarios) {
  throw new Error(`E2E_SCENARIO_LIMIT must be between 1 and ${remainingScenarios}.`);
}
const selectedScenarios = scenarios.slice(
  scenarioStart - 1,
  scenarioStart - 1 + scenarioLimit,
);

function sourceHost(url: string | null) {
  if (!url) return "none";
  try {
    return new URL(url).hostname;
  } catch {
    return "invalid";
  }
}

function redactEmails(value: string) {
  return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted email]");
}

const client = new ConvexHttpClient(convexUrl);
const runId = `${Date.now()}-${crypto.randomUUID()}`;
const results: string[] = [];

for (const [index, scenario] of selectedScenarios.entries()) {
  const scenarioNumber = scenarioStart + index;
  console.log(`\n[${index + 1}/${selectedScenarios.length}] ${scenario.label}`);

  const created = await client.mutation(api.events.create, {
    brief: scenario.brief,
    requestKey: `e2e-${runId}-${scenarioNumber}`,
  });
  const deadline = Date.now() + 8 * 60_000;
  let terminal = false;

  while (Date.now() < deadline) {
    const event = await client.query(api.events.get, { eventId: created.eventId });
    if (!event || !["review_ready", "failed"].includes(event.status)) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      continue;
    }
    terminal = true;
    const research = await client.query(api.researchData.getByEvent, {
      eventId: created.eventId,
    });
    const venues = research?.venues ?? [];
    const drafts = research?.drafts ?? [];
    const verification = event.aiReview?.verification ?? [];
    const checks = {
      completed: event.status === "review_ready",
      searchIntent:
        Boolean(event.researchQuery) &&
        event.researchQuery!.length <= 500 &&
        /venue|event space|hall hire/i.test(event.researchQuery!),
      venueCount: venues.length >= 2 && venues.length <= 5,
      openai: Boolean(event.aiReview?.model?.startsWith("gpt-")),
      coordination:
        event.agentTrace?.join(",") ===
        "planning,discovering,enriching,synthesizing,critiquing,verifying",
      verifier: verification.length === 14 && verification.every((check) => check.passed),
      profiles:
        venues.every((venue) => venue.evidence.length > 0) &&
        venues.filter(
          (venue) =>
            (venue.images?.length ?? 0) > 0 &&
            (venue.reviews?.length ?? 0) > 0,
        ).length >= Math.min(2, venues.length),
      emails: venues.some((venue) => venue.contactType === "email"),
      capacity: venues.every(
        (venue) =>
          venue.capacityMaximum === null || venue.capacityMaximum >= scenario.attendeeCount,
      ),
      details: venues.every(
        (venue) =>
          (venue.amenities?.length ?? 0) > 0 &&
          venue.accessibilityNotes !== undefined &&
          venue.pricingNotes !== undefined,
      ),
      recommendations:
        venues.every(
          (venue) =>
            Number.isInteger(venue.recommendationScore) &&
            venue.recommendationScore! >= 0 &&
            venue.recommendationScore! <= 100 &&
            Boolean(venue.recommendationReason?.trim()),
        ) &&
        venues.every(
          (venue, venueIndex) =>
            venueIndex === 0 ||
            venues[venueIndex - 1].recommendationScore! >= venue.recommendationScore!,
        ),
      draftsUnsent:
        drafts.length === venues.length && drafts.every((draft) => draft.status === "draft"),
    };
    const failed = Object.entries(checks)
      .filter(([, passed]) => !passed)
      .map(([name]) => name);

    console.log(
      `  research: ${event.status}; ${venues.length} venues; model ${event.aiReview?.model ?? "none"}`,
    );
    console.log(`  discovery search: ${event.researchQuery ?? "not recorded"}`);
    console.log(
      `  critic: ${event.aiReview?.summary ?? event.researchError ?? "no summary"}; ${event.aiReview?.issues.length ?? 0} issue(s)`,
    );
    for (const issue of event.aiReview?.issues ?? []) {
      console.log(
        `  issue: ${issue.venueName ?? "shortlist"} / ${issue.field} / ${redactEmails(issue.message)}`,
      );
    }
    console.log(
      `  verifier: ${verification.filter((check) => check.passed).length}/${verification.length} passed`,
    );
    for (const check of verification.filter((item) => !item.passed)) {
      console.log(`  failed check: ${check.key} / ${check.detail}`);
    }
    const searchedVenueNames = [
      ...new Set([
        ...venues.map((venue) => venue.name),
        ...(event.aiReview?.issues.flatMap((issue) =>
          issue.venueName ? [issue.venueName] : [],
        ) ?? []),
      ]),
    ];
    for (const venueName of searchedVenueNames) {
      console.log(
        `  detail search: ${buildVenueEnrichmentQuery(venueName, "details")}`,
      );
      console.log(
        `  venue review search: ${buildVenueEnrichmentQuery(venueName, "review", scenario.location)}`,
      );
    }
    for (const venue of venues) {
      console.log(
        `  venue: ${venue.name} | score ${venue.recommendationScore ?? "missing"}/100 | reason ${redactEmails(venue.recommendationReason ?? "missing")} | capacity ${venue.capacityMaximum ?? "unknown"} | images ${venue.images?.length ?? 0} | reviews ${venue.reviews?.length ?? 0} | evidence ${venue.evidence.length} | contact ${venue.contactType} | sources ${[sourceHost(venue.websiteUrl), sourceHost(venue.capacitySourceUrl), sourceHost(venue.reviews?.[0]?.sourceUrl ?? null)].join(", ")}`,
      );
    }
    console.log(`  outreach: ${drafts.map((draft) => draft.status).join(", ") || "none"}`);

    const passed = failed.length === 0;
    results.push(
      `${scenarioNumber}. ${passed ? "PASS" : "FAIL"} — ${scenario.label}${failed.length ? ` — ${failed.join(", ")}` : ""}`,
    );
    break;
  }

  if (!terminal) results.push(`${scenarioNumber}. TIMEOUT — ${scenario.label}`);
}

console.log(`\n${results.join("\n")}`);
if (results.some((result) => !result.includes("PASS"))) {
  throw new Error("One or more live research scenarios failed quality checks.");
}
