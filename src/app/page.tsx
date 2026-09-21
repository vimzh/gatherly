import { EventBriefForm } from "@/components/gatherly/event-brief-form";

export default function Home() {
  return (
    <main className="min-h-svh px-5 py-6 sm:px-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <span className="text-sm font-semibold tracking-[-0.02em]">Gatherly</span>
        <span className="text-xs text-muted-foreground">Venue sourcing workspace</span>
      </header>

      <section className="mx-auto flex min-h-[calc(100svh-6rem)] max-w-3xl flex-col items-center justify-center py-16 text-center">
        <p className="mb-5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="size-1.5 rounded-full bg-clay" aria-hidden="true" />
          Research, shortlist, and prepare outreach
        </p>
        <h1 className="text-5xl font-semibold tracking-[-0.055em] sm:text-7xl">
          Gatherly
        </h1>
        <p className="mt-5 max-w-xl text-balance text-base leading-7 text-muted-foreground sm:text-lg">
          Tell us what you are planning. Gatherly finds credible venues, checks the
          details, and prepares the outreach for your approval.
        </p>
        <EventBriefForm />
      </section>
    </main>
  );
}
