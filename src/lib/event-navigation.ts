// Normalizes event briefs and constructs bookmarkable static event URLs.
export function normalizeEventBrief(value: string) {
  const brief = value.trim();
  if (!brief) return null;
  if (brief.length > 4000) {
    throw new Error("Event briefs must be 4,000 characters or fewer.");
  }
  return brief;
}

export const BENGALURU_DEMO_EVENT_ID = "j5772sbbtpkpyyx2gqz3c9f72d8ewfms";

export function venueDemoHref() {
  const href = eventHref(BENGALURU_DEMO_EVENT_ID);
  return `${href}${href.includes("?") ? "&" : "?"}demo=agents`;
}

export function outreachDemoHref() {
  return eventInboxHref(BENGALURU_DEMO_EVENT_ID);
}

export function eventHref(eventId: string, sendToken?: string | null) {
  const route =
    process.env.NODE_ENV === "production"
      ? `/event/${encodeURIComponent(eventId)}`
      : `/event/?id=${encodeURIComponent(eventId)}`;
  return sendToken
    ? `${route}${process.env.NODE_ENV === "production" ? "?" : "&"}token=${encodeURIComponent(sendToken)}`
    : route;
}

export function eventInboxHref(eventId: string, sendToken?: string | null) {
  const route =
    process.env.NODE_ENV === "production"
      ? `/event/${encodeURIComponent(eventId)}/inbox`
      : `/inbox/?id=${encodeURIComponent(eventId)}`;
  return sendToken
    ? `${route}${process.env.NODE_ENV === "production" ? "?" : "&"}token=${encodeURIComponent(sendToken)}`
    : route;
}

export function parseHostedEventPath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "event" || (parts.length !== 2 && parts.length !== 3)) {
    return null;
  }
  if (parts.length === 3 && parts[2] !== "inbox") return null;
  try {
    const eventId = decodeURIComponent(parts[1]).trim();
    if (!eventId) return null;
    return { eventId, view: parts.length === 3 ? ("inbox" as const) : ("event" as const) };
  } catch {
    return null;
  }
}
