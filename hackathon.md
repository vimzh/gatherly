# Hackathon log

- **Project:** Gatherly
- **Event:** Convex All Gas Hackathon
- **What it does:** Turns an event brief into a persistent venue-sourcing workspace with visible research stages and human-approved outreach.
- **Live app:** not deployed
- **Repo:** none
- **Frontend:** Convex static hosting
- **Convex deployment:** not deployed
- **Components:** none
- **Convex features:** schema, tables, indexes, queries, mutations, realtime queries
- **Auth:** none
- **AI models:** none
- **Started:** 2026-09-21T17:53:21Z
- **Last updated:** 2026-09-21T19:24:57Z

## Log

### 2026-09-21 - a3fbed0
Initialized the Git repository and selected Convex static hosting for the
frontend. Defined the initial product as an evidence-backed venue sourcing
workspace with human-approved email outreach, reply tracking, comparison, and
handoff (`docs/idea.md`). Scaffolded a statically exported Next.js frontend and
installed the initial shadcn/ui primitives for its chat and outreach interface
(`src/app`, `src/components/ui`, `next.config.ts`). Added project guidance to
keep this build log current (`AGENTS.md`).

### 2026-09-21 - 852d482
Added idempotent event creation and safe lookup on local Convex, backed by an
indexed request key and in-memory contract tests (`convex/schema.ts`,
`convex/events.ts`). Built the focused Gatherly brief composer and persistent
`/event?id=<eventId>` workspace with reactive loading, recovery states, visible
demo research stages, responsive layouts, and an explicit email approval gate
(`src/app`, `src/components/gatherly`). Validation returns keyboard focus to
the brief, and the unauthenticated form now warns users to enter demo details
only. Live venue research and outreach remain unconnected.
