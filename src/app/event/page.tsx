// Statically exports the event shell while resolving its identifier in the browser.
import { Suspense } from "react";
import {
  EventPageClient,
  EventWorkspaceLoading,
} from "@/components/gatherly/event-page-client";

export default function EventPage() {
  return (
    <Suspense fallback={<EventWorkspaceLoading />}>
      <EventPageClient />
    </Suspense>
  );
}
