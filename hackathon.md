# Hackathon log

- **Project:** Gatherly
- **Event:** Convex All Gas Hackathon
- **What it does:** Crawls public venue, image, review, and contact evidence from an event brief, verifies a shortlist, and sends organizer-confirmed outreach through AgentMail.
- **Live app:** https://limitless-spaniel-248.convex.app
- **Repo:** private
- **Frontend:** Convex static hosting
- **Convex deployment:** https://limitless-spaniel-248.eu-west-1.convex.cloud
- **Components:** none
- **Convex features:** schema, tables, indexes, queries, mutations, actions, scheduled functions, realtime queries
- **Auth:** none
- **AI models:** gpt-5.4-mini-2026-03-17
- **Started:** 2026-09-21T17:53:21Z
- **Last updated:** 2026-09-22T15:41:19Z

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

### 2026-09-22 - edf2973
Replaced the research-phase workspace with a focused full-page live progress
view after “Find venues.” It names the Planner, Scout, Evidence agent,
Researcher, Critic, and Verifier; marks each handoff as done, working, waiting,
or stopped; highlights the exact current step; and keeps the detailed action
ledger and event brief visible (`src/components/gatherly/research-progress.tsx`).
The view uses the existing realtime Convex event state, adds no provider calls
or backend state, and automatically switches to the venue-results workspace
when review completes. Provider failures now show an actionable message without
an internal stack trace. Thirty-eight tests, lint, type checking, the production
build, and a local visual browser check pass. The production site was
republished and both live routes return HTTP 200. No outreach was sent.

### 2026-09-22 - working tree
Initially deployed a 90-second, one-retry OpenAI limit to development and
production with 39 passing tests. Subsequent QA replaced it with one shared
eight-minute deadline across OpenAI and Firecrawl waits, disabled OpenAI
retries, and proved that hung-provider results cannot publish late drafts
(`convex/research.ts`, `convex/research.integration.test.ts`). Discovery now
rejects unevidenced hosts before enrichment and preserves non-Latin names.
Closed a public creation-key leak that could recover the send capability;
bound contacts, media, reviews, and source claims to venue-associated evidence;
rejected empty delivery identifiers (`convex/events.ts`, `convex/schema.ts`,
`convex/lib/researchWorkflow.ts`, `convex/outreach.ts`). The UI now shows the
complete email before confirmation, blocks duplicate pending submissions,
restores send errors, and clearly labels disconnected replies and public demo
data (`src/components/gatherly`). Added source-backed README diagrams.
A second sweep closed subject-line booking-claim and city-substring handoff
gaps. Interrupted email sends now expose an explicitly confirmed same-draft
retry. A durable nine-minute Convex watchdog fails abandoned research, and
attempt-scoped writes prevent late workers or watchdogs from changing newer
runs (`convex/researchData.ts`, `convex/research.ts`). Existing pre-fix stuck
records are not migrated; those events need a new search. Provider configuration
is still checked before send preparation so missing settings cannot consume an
unused draft's retry window; persisted sent results remain visible in the UI.
All 72 tests, type checking, lint, and the static production build pass. The
scheduled research-to-confirmed-send flow and failure paths pass with mocked
providers; browser checks cover empty briefs and invalid links. Ten live
OpenAI-only baseline scenarios passed, followed by post-fix Austin and New York
smoke tests; all passed 14 verification checks using synthetic evidence. No Firecrawl
credits or real email were used. The combined fixes were pushed to development
only; production was not updated during QA. Live Firecrawl and actual delivery
remain unverified in this run. The build's external-lockfile warning and the
Convex optional AI-files notice are non-blocking and outside this change.
Replaced deployment-owned provider credentials with per-tab bring-your-own-key
onboarding for OpenAI, Firecrawl, and AgentMail. Live research cannot start
until all four required values are present; credentials stay in browser session
storage, never in event records or event URLs, and the capability token is
validated before research or delivery (`src/components/gatherly/event-brief-form.tsx`,
`src/lib/provider-credentials.ts`, `convex/research.ts`, `convex/outreach.ts`).
Added a read-only Bengaluru demo that reuses the completed event without making
provider calls or enabling email delivery. Removed the registered Firecrawl
component in favor of the visitor-supplied API call (`convex/convex.config.ts`).
The completed Bengaluru result was copied to production as a read-only demo
with four venues and four unsent drafts. Static route handling now opens that
demo directly on Convex hosting, including after a fresh page load
(`next.config.ts`, `src/lib/event-navigation.ts`). The backend independently
rejects delivery from demo events. All 79 tests, type checking, lint, the
production build, both production deployments, and live browser checks pass.
No provider call or outreach was sent.
Added a directly linkable, read-only outreach inbox demonstration for the
Bengaluru event. It shows four venue threads, delivery and reply status,
organizer summaries, unanswered requirements, simulated conversations, and an
approval-gated next draft while clearly stating that no email was sent
(`src/app/demo/outreach/page.tsx`,
`src/components/gatherly/demo-outreach-inbox.tsx`). Linked it from the landing
page and completed event workspace. All 81 tests, type checking, lint, the
static production build, and live browser verification pass; the production
site was republished without calling a provider or sending outreach.
Added copyable event IDs to active research, venue results, and inbox views.
Convex static hosting now resolves each event at `/event/<eventId>` and its
outreach view at `/event/<eventId>/inbox`; the ID is a read-only locator and the
separate capability token remains required to send (`src/lib/event-navigation.ts`,
`src/components/gatherly/hosted-route.tsx`). Live inboxes use the event's actual
agent activity and outreach drafts, while the Bengaluru inbox remains clearly
simulated. All 86 tests, type checking, lint, the production build, and direct
browser checks of both hosted paths pass. The site was republished without a
provider call or outreach send.
