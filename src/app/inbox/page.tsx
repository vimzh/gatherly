// Statically exports the event inbox shell while resolving its event in the browser.
import { Suspense } from "react";
import { EventInboxPageClient } from "@/components/gatherly/event-inbox-page-client";
import { EventWorkspaceLoading } from "@/components/gatherly/event-page-client";

export default function InboxPage() {
  return (
    <Suspense fallback={<EventWorkspaceLoading />}>
      <EventInboxPageClient />
    </Suspense>
  );
}
