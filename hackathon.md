# Hackathon log

- **Project:** Gatherly
- **Event:** Convex All Gas Hackathon
- **What it does:** Crawls public venue, image, review, and contact evidence from an event brief, verifies a shortlist, and sends organizer-confirmed outreach through AgentMail.
- **Live app:** https://limitless-spaniel-248.convex.app
- **Repo:** private
- **Frontend:** Convex static hosting
- **Convex deployment:** https://limitless-spaniel-248.eu-west-1.convex.cloud
- **Components:** @firecrawl/firecrawl-convex
- **Convex features:** schema, tables, indexes, queries, mutations, actions, scheduled functions, realtime queries
- **Auth:** none
- **AI models:** gpt-5.4-mini-2026-03-17
- **Started:** 2026-09-21T17:53:21Z
- **Last updated:** 2026-09-22T11:16:27Z

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

### 2026-09-22 - a1166e2
Connected event creation to a scheduled OpenAI Responses API research action,
an independent criticism pass, and 14 deterministic evidence, coordination, and
outreach-safety
checks. Registered the Firecrawl Convex component and added exact location and
capacity discovery, candidate-specific official-site, image, review, capacity,
and contact enrichment (`convex/convex.config.ts`, `convex/research.ts`,
`convex/lib`). Reviewed property profiles and approval-only drafts persist in
indexed tables and update the workspace reactively (`convex/researchData.ts`,
`src/components/gatherly`). The planner, discovery, enrichment, research,
criticism, and verification stages now have explicit ownership, live progress,
immutable requirement handoffs, and role-specific reasoning levels
(`convex/research.ts`, `convex/researchData.ts`). Added organizer-confirmed AgentMail delivery with
capability-protected send links, provider idempotency, and persisted delivery
state (`convex/outreach.ts`, `convex/outreachData.ts`). Added evidence-weighted
recommendation scores and rationales, ordered by fit and checked before storage
(`convex/lib/researchWorkflow.ts`, `src/components/gatherly/event-workspace.tsx`).
Expanded live retrieval with complementary focused and broad discovery while
staying within provider rate limits. Enrichment now targets official domains,
grounds email provenance, deduplicates physical properties, rejects employee,
social, operator, and unrelated reviews, and lowers scores when capacity or key
requirements are unknown (`convex/research.ts`, `convex/lib`). Broadened generic
discovery beyond hotel and conference-center categories and
kept up to four grounded, contactable options visible when secondary image or
review evidence is incomplete. The verifier still requires two fully enriched
profiles and rejects every invalid included review. A live Lisbon rerun retained
four options, passed all 14 checks, and left all four outreach drafts unsent
(`convex/research.ts`, `convex/lib`, `scripts/e2e-research.ts`). A ten-scenario
live matrix exposed and fixed retrieval, grounding, duplicate-property, review,
scoring, timeout, and transient-connection defects; every affected scenario
passed a targeted live rerun. The final ten-scenario OpenAI evaluation passed
all 14 checks across 40 model calls (`scripts/e2e-openai-agents.ts`). Thirty-five
tests, lint, type checking, code generation, and the production build pass. No
venue outreach was sent. One organizer-directed delivery test sent an existing
AI-generated draft through the configured AgentMail inbox; AgentMail accepted
the message, created a thread, and stored it as sent. The approval token,
provider-failure recovery, persisted sent state, and duplicate-send prevention
paths also pass their eleven focused tests (`convex/outreach.test.ts`,
`convex/events.test.ts`).

### 2026-09-22 - f0c49fe
Created persistent cloud development and production deployments, copied the
required integration configuration without exposing values, and deployed the
Convex schema, functions, indexes, and Firecrawl component to production.
Published the static Next.js export through Convex hosting and verified both the
landing page and event route return HTTP 200 (`next.config.ts`, `package.json`).

### 2026-09-22 - 58727eb
Added a view-only rejected-candidate audit trail without adding another
Firecrawl request. Discovery now preserves grounded alternatives from the
existing evidence bundle, including known below-capacity venues, and the final
workflow moves sub-50 candidates out only when the remaining shortlist still
passes all 14 deterministic checks (`convex/research.ts`,
`convex/lib/researchWorkflow.ts`). Rejected options persist in a new indexed
`rejectedVenues` table with their source, known capacity, and reason; they never
receive an outreach draft (`convex/schema.ts`, `convex/researchData.ts`). The
workspace exposes them behind a collapsed “View rejected candidates” control
with no send action (`src/components/gatherly/event-workspace.tsx`). Thirty-seven
tests, lint, type checking, and the production build pass. The production
backend and static site were redeployed, and both live routes return HTTP 200.
No outreach was sent. A final provider-backed rerun could not start because the
Firecrawl account returned `402 Insufficient credits`; earlier London runs in
this iteration completed the full pipeline with all 14 checks passing.
