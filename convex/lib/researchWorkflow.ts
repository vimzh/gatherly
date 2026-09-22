// Defines the typed AI research contract and the deterministic final verification gate.
import { z } from "zod";
import {
  firecrawlEvidenceUrls,
  type FirecrawlEvidence,
} from "./firecrawlEvidence";

export const ResearchPlanSchema = z.object({
  title: z.string().min(1).max(120),
  requirements: z.object({
    location: z.string().min(1).max(160),
    attendeeCount: z.number().int().positive().max(100_000).nullable(),
    dateOrWindow: z.string().max(160).nullable(),
    eventType: z.string().min(1).max(120),
    mustHaves: z.array(z.string().min(1).max(160)).max(12),
    missingDetails: z.array(z.string().min(1).max(160)).max(8),
  }),
  venues: z
    .array(
      z.object({
        name: z.string().min(1).max(160),
        location: z.string().min(1).max(200),
        websiteUrl: z.string().min(1).max(500),
        address: z.string().max(300).nullable(),
        fitSummary: z.string().min(1).max(800),
        recommendationScore: z.number().int().min(0).max(100),
        recommendationReason: z.string().min(1).max(500),
        amenities: z.array(z.string().min(1).max(120)).max(12),
        accessibilityNotes: z.string().max(500).nullable(),
        pricingNotes: z.string().max(500).nullable(),
        capacity: z.object({
          maximum: z.number().int().positive().max(1_000_000).nullable(),
          notes: z.string().min(1).max(500),
          sourceUrl: z.string().max(500).nullable(),
        }),
        contact: z.object({
          type: z.enum(["email", "contact_form", "phone"]),
          value: z.string().min(1).max(500),
          sourceUrl: z.string().min(1).max(500),
        }),
        evidence: z
          .array(
            z.object({
              claim: z.string().min(1).max(500),
              sourceTitle: z.string().min(1).max(200),
              sourceUrl: z.string().min(1).max(500),
            }),
          )
          .min(1)
          .max(8),
        images: z
          .array(
            z.object({
              url: z.string().min(1).max(500),
              sourceUrl: z.string().min(1).max(500),
              alt: z.string().min(1).max(200),
            }),
          )
          .max(4),
        reviews: z
          .array(
            z.object({
              sourceName: z.string().min(1).max(120),
              rating: z.number().min(0).max(5).nullable(),
              reviewCount: z.number().int().nonnegative().nullable(),
              summary: z.string().min(1).max(500),
              sourceUrl: z.string().min(1).max(500),
            }),
          )
          .max(4),
        outreach: z.object({
          subject: z.string().min(1).max(180),
          body: z.string().min(1).max(4_000),
        }),
      }),
    )
    .min(2)
    .max(5),
});

export const CritiqueSchema = z.object({
  approved: z.boolean(),
  summary: z.string().min(1).max(800),
  issues: z
    .array(
      z.object({
        severity: z.enum(["warning", "blocker"]),
        venueName: z.string().max(160).nullable(),
        field: z.string().min(1).max(80),
        message: z.string().min(1).max(500),
      }),
    )
    .max(20),
  revisedPlan: ResearchPlanSchema,
});

export type ResearchPlan = z.infer<typeof ResearchPlanSchema>;
export type Critique = z.infer<typeof CritiqueSchema>;
export type VerificationCheck = {
  key: string;
  passed: boolean;
  detail: string;
};
export type ExpectedRequirements = Pick<
  ResearchPlan["requirements"],
  "location" | "attendeeCount" | "eventType"
>;

type ResearchCalls = {
  research: (brief: string, evidence: FirecrawlEvidence) => Promise<ResearchPlan>;
  critique: (
    brief: string,
    plan: ResearchPlan,
    evidence: FirecrawlEvidence,
  ) => Promise<Critique>;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UNSAFE_OUTREACH_PATTERN =
  /\b(booking is confirmed|venue is reserved|we have booked|availability is guaranteed|price is confirmed)\b/i;

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function normalizedUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value;
  }
}

function urlHost(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function normalizedPhrase(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function verifyResearchPlan(
  plan: ResearchPlan,
  evidence: FirecrawlEvidence,
  expectedRequirements?: ExpectedRequirements,
): VerificationCheck[] {
  const urls = plan.venues.flatMap((venue) => [
    venue.websiteUrl,
    venue.contact.sourceUrl,
    ...(venue.contact.type === "contact_form" ? [venue.contact.value] : []),
    ...(venue.capacity.sourceUrl ? [venue.capacity.sourceUrl] : []),
    ...venue.evidence.map((item) => item.sourceUrl),
    ...venue.images.flatMap((item) => [item.url, item.sourceUrl]),
    ...venue.reviews.map((item) => item.sourceUrl),
  ]);
  const allowedUrls = new Set(
    [...firecrawlEvidenceUrls(evidence)].map(normalizedUrl),
  );
  const ungroundedUrls = [
    ...new Set(
      urls
        .map(normalizedUrl)
        .filter((url) => !allowedUrls.has(url)),
    ),
  ];
  const normalizedNames = plan.venues.map((venue) => venue.name.trim().toLowerCase());
  const normalizedWebsites = plan.venues.map((venue) => venue.websiteUrl.trim().toLowerCase());
  const evidenceText = evidence.pages
    .flatMap((page) => [page.description, page.summary, page.markdown, ...page.emails])
    .join("\n")
    .toLowerCase();
  const reviewPageUrls = new Set(
    evidence.pages
      .filter((page) => page.purpose === "review")
      .map((page) => normalizedUrl(page.url)),
  );
  const blockedReviewHosts = [
    "facebook.com",
    "glassdoor.com",
    "indeed.com",
    "instagram.com",
    "linkedin.com",
    "tiktok.com",
    "twitter.com",
    "x.com",
  ];

  const contactsValid = plan.venues.every((venue) => {
    if (!isHttpsUrl(venue.contact.sourceUrl)) return false;
    if (venue.contact.type === "email") return EMAIL_PATTERN.test(venue.contact.value);
    if (venue.contact.type === "contact_form") return isHttpsUrl(venue.contact.value);
    return venue.contact.value.trim().length >= 7;
  });
  const capacityClaimsSourced = plan.venues.every(
    (venue) => venue.capacity.maximum === null || isHttpsUrl(venue.capacity.sourceUrl ?? ""),
  );
  const capacityFits = plan.venues.every(
    (venue) =>
      plan.requirements.attendeeCount === null ||
      venue.capacity.maximum === null ||
      venue.capacity.maximum >= plan.requirements.attendeeCount,
  );
  const outreachSafe = plan.venues.every(
    (venue) =>
      venue.outreach.body.includes("?") &&
      !UNSAFE_OUTREACH_PATTERN.test(venue.outreach.body),
  );
  const emailsGrounded = plan.venues.every(
    (venue) =>
      venue.contact.type !== "email" ||
      evidenceText.includes(venue.contact.value.trim().toLowerCase()),
  );
  const actualLocation = normalizedPhrase(plan.requirements.location);
  const expectedLocation = normalizedPhrase(expectedRequirements?.location ?? "");
  const handoffAligned =
    !expectedRequirements ||
    ((actualLocation.includes(expectedLocation) || expectedLocation.includes(actualLocation)) &&
      plan.requirements.attendeeCount === expectedRequirements.attendeeCount &&
      normalizedPhrase(plan.requirements.eventType) ===
        normalizedPhrase(expectedRequirements.eventType));
  const recommendationsOrdered = plan.venues.every(
    (venue, index) =>
      venue.recommendationReason.trim().length > 0 &&
      (index === 0 ||
        plan.venues[index - 1].recommendationScore >= venue.recommendationScore),
  );
  const profiles = plan.venues.map((venue) => {
    const websiteHost = urlHost(venue.websiteUrl);
    const reviewsValid = venue.reviews.every((review) => {
      const reviewHost = urlHost(review.sourceUrl);
      return (
        reviewPageUrls.has(normalizedUrl(review.sourceUrl)) &&
        reviewHost !== websiteHost &&
        !blockedReviewHosts.some(
          (host) => reviewHost === host || reviewHost.endsWith(`.${host}`),
        )
      );
    });
    return {
      complete: venue.images.length > 0 && venue.reviews.length > 0,
      reviewsValid,
    };
  });
  const propertyProfilesValid =
    profiles.every((profile) => profile.reviewsValid) &&
    profiles.filter((profile) => profile.complete).length >=
      Math.min(2, plan.venues.length);

  return [
    {
      key: "agent_handoff",
      passed: handoffAligned,
      detail: "The researcher and critic preserved the planner's location, attendance, and event type.",
    },
    {
      key: "recommendation_order",
      passed: recommendationsOrdered,
      detail: "Every venue has a recommendation rationale and the shortlist is ordered by score.",
    },
    {
      key: "venue_count",
      passed: plan.venues.length >= 2 && plan.venues.length <= 5,
      detail: "The shortlist contains between two and five venues.",
    },
    {
      key: "unique_venues",
      passed:
        new Set(normalizedNames).size === normalizedNames.length &&
        new Set(normalizedWebsites).size === normalizedWebsites.length,
      detail: "Venue names and official website URLs are unique.",
    },
    {
      key: "https_sources",
      passed: urls.every(isHttpsUrl),
      detail: "Every website, evidence, image, review, capacity, and contact URL uses HTTPS.",
    },
    {
      key: "evidence_present",
      passed: plan.venues.every((venue) => venue.evidence.length > 0),
      detail: "Every venue has at least one cited public source.",
    },
    {
      key: "firecrawl_grounding",
      passed: ungroundedUrls.length === 0,
      detail:
        ungroundedUrls.length === 0
          ? "Every output URL was present in the Firecrawl evidence bundle."
          : `URLs missing from Firecrawl evidence: ${ungroundedUrls.slice(0, 3).join(", ")}`,
    },
    {
      key: "property_profile",
      passed: propertyProfilesValid,
      detail:
        "At least two venues include a sourced image and independent review; every included review is valid.",
    },
    {
      key: "capacity_sourced",
      passed: capacityClaimsSourced,
      detail: "Every numeric capacity claim has a public source URL.",
    },
    {
      key: "capacity_fit",
      passed: capacityFits,
      detail: "No known capacity is below the requested attendee count.",
    },
    {
      key: "contact_route",
      passed: contactsValid,
      detail: "Every contact route is valid and linked to its public source.",
    },
    {
      key: "agentmail_ready",
      passed: plan.venues.some((venue) => venue.contact.type === "email"),
      detail: "At least one venue has a public email address for AgentMail outreach.",
    },
    {
      key: "email_grounding",
      passed: emailsGrounded,
      detail: "Every included outreach email address appears in the Firecrawl evidence text.",
    },
    {
      key: "outreach_safety",
      passed: outreachSafe,
      detail: "Drafts ask questions and make no confirmed booking, price, or availability claims.",
    },
  ];
}

export class ResearchReviewError extends Error {
  constructor(
    message: string,
    readonly critique: Critique,
    readonly verification: VerificationCheck[],
  ) {
    super(message);
  }
}

export async function runResearchWorkflow(
  brief: string,
  evidence: FirecrawlEvidence,
  calls: ResearchCalls,
  expectedRequirements?: ExpectedRequirements,
) {
  const draft = ResearchPlanSchema.parse(await calls.research(brief, evidence));
  const critique = CritiqueSchema.parse(await calls.critique(brief, draft, evidence));
  const allowedUrls = new Set([...firecrawlEvidenceUrls(evidence)].map(normalizedUrl));
  const normalizedVenues = critique.revisedPlan.venues
    .map((venue) => {
      const websiteUrl = allowedUrls.has(normalizedUrl(venue.websiteUrl))
        ? venue.websiteUrl
        : (evidence.pages.find(
            (page) =>
              page.purpose === "venue" &&
              urlHost(page.url) === urlHost(venue.websiteUrl),
          )?.url ?? venue.websiteUrl);
      const groundedEmailSource =
        venue.contact.type === "email" &&
        !allowedUrls.has(normalizedUrl(venue.contact.sourceUrl))
          ? evidence.pages.find((page) =>
              page.emails.some(
                (email) =>
                  email.trim().toLowerCase() ===
                  venue.contact.value.trim().toLowerCase(),
              ),
            )?.url
          : undefined;
      return {
        ...venue,
        websiteUrl,
        contact: {
          ...venue.contact,
          sourceUrl: groundedEmailSource ?? venue.contact.sourceUrl,
          value:
            venue.contact.type === "contact_form" && !isHttpsUrl(venue.contact.value)
              ? venue.contact.sourceUrl
              : venue.contact.value,
        },
        outreach: {
          ...venue.outreach,
          body: venue.outreach.body.includes("?")
            ? venue.outreach.body
            : `${venue.outreach.body.trim().slice(0, 3_960)}\n\nCould you confirm these details?`,
        },
      };
    })
    .sort(
      (left, right) =>
        right.recommendationScore - left.recommendationScore ||
        left.name.localeCompare(right.name),
    );
  const seenNames = new Set<string>();
  const seenWebsites = new Set<string>();
  const reviewedPlan = ResearchPlanSchema.parse({
    ...critique.revisedPlan,
    requirements: draft.requirements,
    venues: normalizedVenues.filter((venue) => {
      const name = normalizedPhrase(venue.name);
      const website = normalizedUrl(venue.websiteUrl);
      if (seenNames.has(name) || seenWebsites.has(website)) return false;
      seenNames.add(name);
      seenWebsites.add(website);
      return true;
    }),
  });
  const strongVenues = reviewedPlan.venues.filter(
    (venue) => venue.recommendationScore >= 50,
  );
  const strongPlan =
    strongVenues.length >= 2
      ? ResearchPlanSchema.parse({ ...reviewedPlan, venues: strongVenues })
      : null;
  let plan = reviewedPlan;
  let verification = verifyResearchPlan(reviewedPlan, evidence, expectedRequirements);
  if (strongPlan) {
    const strongVerification = verifyResearchPlan(
      strongPlan,
      evidence,
      expectedRequirements,
    );
    if (strongVerification.every((check) => check.passed)) {
      plan = strongPlan;
      verification = strongVerification;
    }
  }
  const failedChecks = verification.filter((check) => !check.passed);

  if (!critique.approved || failedChecks.length > 0) {
    throw new ResearchReviewError(
      !critique.approved
        ? "The independent critic did not approve the revised research."
        : `Final verification failed: ${failedChecks.map((check) => check.key).join(", ")}.`,
      critique,
      verification,
    );
  }

  return { draft, plan, critique, verification };
}
