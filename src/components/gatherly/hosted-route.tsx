// Resolves pretty event URLs when the static host serves the root export as a fallback.
"use client";

import { Suspense, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { parseHostedEventPath } from "@/lib/event-navigation";
import { EventInboxPageClient } from "./event-inbox-page-client";
import { EventPageClient, EventWorkspaceLoading } from "./event-page-client";

const subscribe = () => () => undefined;

export function HostedRoute({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const location = useSyncExternalStore(
    subscribe,
    () => `${window.location.pathname}${window.location.search}`,
    () => "/",
  );
  const url = new URL(location, "https://gatherly.local");
  const route = parseHostedEventPath(pathname ?? url.pathname);

  if (!route) return children;

  const sendToken = url.searchParams.get("token")?.trim() || null;

  return (
    <Suspense fallback={<EventWorkspaceLoading />}>
      {route.view === "inbox" ? (
        <EventInboxPageClient eventId={route.eventId} sendToken={sendToken} />
      ) : (
        <EventPageClient
          eventId={route.eventId}
          sendToken={sendToken}
          replayDemo={url.searchParams.get("demo") === "agents"}
        />
      )}
    </Suspense>
  );
}
