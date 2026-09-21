// Normalizes event briefs and constructs bookmarkable static event URLs.
export function normalizeEventBrief(value: string) {
  const brief = value.trim();
  if (!brief) return null;
  if (brief.length > 4000) {
    throw new Error("Event briefs must be 4,000 characters or fewer.");
  }
  return brief;
}

export function eventHref(eventId: string) {
  return `/event?id=${encodeURIComponent(eventId)}`;
}
