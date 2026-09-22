// Keeps visitor-owned provider credentials in the current browser session only.
export type ProviderCredentials = {
  openaiApiKey: string;
  firecrawlApiKey: string;
  agentMailApiKey: string;
  agentMailInboxId: string;
};

const storageKey = (eventId: string) => `gatherly:provider-credentials:${eventId}`;

export function saveProviderCredentials(
  eventId: string,
  credentials: ProviderCredentials,
) {
  sessionStorage.setItem(storageKey(eventId), JSON.stringify(credentials));
}

export function providerCredentialsSnapshot(eventId: string) {
  return sessionStorage.getItem(storageKey(eventId)) ?? "";
}

export function parseProviderCredentials(stored: string) {
  try {
    if (!stored) return null;
    const credentials = JSON.parse(stored) as Partial<ProviderCredentials>;
    if (
      !credentials.openaiApiKey?.trim() ||
      !credentials.firecrawlApiKey?.trim() ||
      !credentials.agentMailApiKey?.trim() ||
      !credentials.agentMailInboxId?.trim()
    ) {
      return null;
    }
    return credentials as ProviderCredentials;
  } catch {
    return null;
  }
}
