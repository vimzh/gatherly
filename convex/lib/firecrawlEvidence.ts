// Compacts Firecrawl search responses into a bounded, source-verifiable AI input.
import type { SearchResponse } from "@firecrawl/firecrawl-convex";

export type EvidencePage = {
  purpose: "venue" | "review";
  title: string;
  url: string;
  description: string;
  summary: string;
  markdown: string;
  emails: string[];
  links: string[];
  images: string[];
};

export type EvidenceImage = {
  url: string;
  sourceUrl: string | null;
  title: string;
};

export type FirecrawlEvidence = {
  pages: EvidencePage[];
  images: EvidenceImage[];
};

type LooseResult = Record<string, unknown>;

const HTTPS_URL = /^https:\/\//i;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function urls(value: unknown, limit: number) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string" && HTTPS_URL.test(item))
        .slice(0, limit)
    : [];
}

function emails(...values: unknown[]) {
  const content = values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string => typeof value === "string")
    .join("\n");
  return [...new Set(content.match(EMAIL_PATTERN) ?? [])].slice(0, 8);
}

function page(result: LooseResult, purpose: EvidencePage["purpose"]): EvidencePage | null {
  const metadata =
    typeof result.metadata === "object" && result.metadata !== null
      ? (result.metadata as LooseResult)
      : {};
  const url = text(result.url, 500) || text(metadata.sourceURL, 500) || text(metadata.url, 500);
  if (!HTTPS_URL.test(url)) return null;
  const markdown = text(result.markdown, 10_000);

  return {
    purpose,
    title: text(result.title, 200) || text(metadata.title, 200) || url,
    url,
    description: text(result.description, 600) || text(metadata.description, 600),
    summary: text(result.summary, 1_200),
    markdown: markdown.replace(/!\[[^\]]*\]\([^)]+\)/g, "").trim().slice(0, 3_000),
    emails: emails(
      result.description,
      result.summary,
      markdown,
      result.links,
      metadata.description,
    ),
    links: urls(result.links, 30),
    images: urls(result.images, 12),
  };
}

function image(result: LooseResult): EvidenceImage | null {
  const imageUrl = text(result.imageUrl, 500);
  const resultUrl = text(result.url, 500);
  const url = imageUrl || resultUrl;
  if (!HTTPS_URL.test(url)) return null;

  const sourceUrl = imageUrl && HTTPS_URL.test(resultUrl) ? resultUrl : text(result.sourceUrl, 500);
  return {
    url,
    sourceUrl: HTTPS_URL.test(sourceUrl) ? sourceUrl : null,
    title: text(result.title, 200),
  };
}

function uniqueByUrl<T extends { url: string }>(items: T[], limit: number) {
  return [...new Map(items.map((item) => [item.url, item])).values()].slice(0, limit);
}

export function buildFirecrawlQuery(brief: string, purpose: "venue" | "review") {
  const suffix =
    purpose === "venue"
      ? "event venues official capacity amenities accessibility pricing email contact photos"
      : "event venue ratings reviews public feedback";
  return `${brief.trim().slice(0, 380)} ${suffix}`.slice(0, 500);
}

export function buildVenueDiscoveryQuery(
  location: string,
  attendeeCount: number | null,
  eventType: string,
) {
  return [
    `"${location.trim().slice(0, 160)}"`,
    eventType.trim().slice(0, 120),
    "venue",
    attendeeCount ? `${attendeeCount} attendees capacity` : "",
    "official contact email",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 500);
}

export function buildBroadVenueDiscoveryQuery(
  location: string,
  attendeeCount: number | null,
) {
  return [
    `"${location.trim().slice(0, 160)}"`,
    "event venue event space venue hire",
    attendeeCount ? `${attendeeCount} guests capacity` : "",
    "official hire contact",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 500);
}

export function buildVenueEnrichmentQuery(
  venueName: string,
  purpose: "details" | "review",
  location?: string,
  websiteUrl?: string,
) {
  const name = `"${venueName.trim().slice(0, 140)}"`;
  let officialSite = "";
  try {
    officialSite = websiteUrl
      ? `site:${new URL(websiteUrl).hostname.replace(/^www\./, "")}`
      : "";
  } catch {
    officialSite = "";
  }
  return purpose === "details"
    ? `${name} ${location?.trim().slice(0, 120) ?? ""} ${officialSite} event capacity contact email accessibility pricing photos`
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 500)
    : `${name} ${location?.trim().slice(0, 120) ?? ""} venue customer reviews ratings`
        .trim()
        .slice(0, 500);
}

export function normalizeFirecrawlEvidence(
  venueSearch: SearchResponse,
  reviewSearch: SearchResponse,
): FirecrawlEvidence {
  const venuePages = (venueSearch.web ?? [])
    .map((result) => page(result as LooseResult, "venue"))
    .filter((item): item is EvidencePage => item !== null);
  const reviewPages = (reviewSearch.web ?? [])
    .map((result) => page(result as LooseResult, "review"))
    .filter((item): item is EvidencePage => item !== null);
  const searchedImages = (venueSearch.images ?? [])
    .map((result) => image(result as LooseResult))
    .filter((item): item is EvidenceImage => item !== null);
  const scrapedImages = venuePages.flatMap((result) =>
    result.images.map((url) => ({ url, sourceUrl: result.url, title: result.title })),
  );

  return {
    pages: uniqueByUrl([...venuePages, ...reviewPages], 16),
    images: uniqueByUrl([...searchedImages, ...scrapedImages], 30),
  };
}

export function mergeFirecrawlEvidence(...bundles: FirecrawlEvidence[]): FirecrawlEvidence {
  return {
    pages: uniqueByUrl(bundles.flatMap((bundle) => bundle.pages), 64),
    images: uniqueByUrl(bundles.flatMap((bundle) => bundle.images), 60),
  };
}

export function firecrawlEvidenceUrls(evidence: FirecrawlEvidence) {
  return new Set(
    evidence.pages
      .flatMap((page) => [page.url, ...page.links, ...page.images])
      .concat(evidence.images.flatMap((image) => [image.url, image.sourceUrl ?? ""]))
      .filter(Boolean),
  );
}
