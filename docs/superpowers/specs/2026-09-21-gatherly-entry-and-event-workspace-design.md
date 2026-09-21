# Gatherly Entry and Event Workspace Design

## Purpose

Gatherly should move an event organizer from a plain-language venue brief into a persistent sourcing workspace with as little ceremony as possible. The root page is not a conventional marketing page. It is the product's empty state: a focused prompt composer that explains the value, establishes the human approval rule, and starts a venue search.

The first implementation succeeds when a user can enter an event brief, receive a persistent event URL, and see a clear workspace that reports sourcing progress and keeps every future venue result, outreach draft, and reply attached to that event.

## Scope

### Included

- A sparse Gatherly root page centered on the event-brief composer.
- Event creation from a non-empty plain-language prompt.
- A persistent event URL backed by a unique Convex event identifier.
- An event workspace with brief, activity, venue, outreach, and reply surfaces.
- Visible research stages that report completed, active, queued, failed, and approval-required work.
- A permanent reminder that no outbound email is sent without organizer approval.
- Responsive layouts for desktop and mobile.

### Deferred

- Authentication and multi-user access.
- Share links and collaborator permissions.
- Real venue research, email delivery, and reply ingestion.
- Booking, payment, contracts, and calendar coordination.
- Human-readable event slugs.
- A long-form marketing page, pricing, testimonials, analytics, or onboarding tours.

The unauthenticated hackathon build must use demonstration data only and must not claim that possession of an unguessable event URL provides real privacy. Authentication and event-level authorization are required before storing real organizer or email data.

## Experience

### Root page

The page uses the existing parchment-inspired theme and Manrope typography. A quiet header contains only the Gatherly wordmark and, once events can be revisited, a link to the user's events. The main content is vertically and horizontally centered within the viewport.

The content order is:

1. Large Gatherly wordmark.
2. Headline: “Find the right place for your event.”
3. One-sentence explanation that Gatherly researches venues, verifies useful details, and prepares outreach.
4. A large multiline composer with a concrete example prompt.
5. A clear `Find venues` action.
6. Three example prompts for a hackathon, creative event, and company gathering.
7. The trust statement: “You approve every email before it sends.”

The composer is the page's signature element. It should resemble a working desk rather than a generic chatbot bubble: paper-white surface, restrained border and shadow, generous internal spacing, and a compact action fixed to its lower-right edge. Clay is used only for a small live/status marker, never as a large decorative fill.

### Submission behavior

Submitting a non-empty brief creates an event record before navigation. The submit control shows a pending state and cannot be submitted twice. After Convex returns the event identifier, the app navigates to the event workspace.

This project is configured as a Next.js static export. Arbitrary dynamic routes cannot be generated at build time, so the initial persistent URL is:

```text
/event?id=<convex-event-id>
```

This preserves a unique, bookmarkable URL without changing the selected Convex static-hosting approach. A path such as `/events/[eventId]` can replace it only if hosting later supports a dynamic application route or an appropriate rewrite.

### Event workspace

On desktop, the workspace uses three regions:

- **Event rail:** event title, parsed requirements, and navigation for venues, outreach, and replies.
- **Activity stream:** the current sourcing stage and an ordered record of useful agent actions.
- **Result panel:** venue candidates and, later, the selected venue's evidence and conversation.

On smaller screens, these regions become a single column with tabs or segmented navigation. The activity stream remains the default while work is in progress; venue results become the default when research is complete.

Agent activity reports observable actions and outcomes, not hidden reasoning. The initial stage sequence is:

1. Understanding the brief.
2. Searching venue sources.
3. Checking capacity and requirements.
4. Finding public contact routes.
5. Building the shortlist.
6. Drafting outreach.
7. Waiting for organizer approval.

Each activity entry may contain a short description, timestamp, relevant source link, and one of these states: queued, active, completed, failed, or approval required. The interface must never imply that an email was sent when only a draft exists.

## Architecture

### Frontend boundaries

- `src/app/page.tsx` renders the Gatherly entry experience.
- `src/app/event/page.tsx` renders the static event route and reads the event identifier from the query string.
- A focused event-brief form component owns prompt input, validation, pending state, and event creation.
- A focused workspace component renders the event record, progress, and responsive panes.
- Existing shadcn primitives and global tokens are reused; no new UI dependency is needed.

The route pages remain thin. Product-specific components live outside `src/components/ui`; generated shadcn primitives remain unchanged.

### Convex contract

The first backend contract needs only an `events` table and two public functions:

- `events.create({ brief })` validates and stores the original brief, initializes the event status, and returns its identifier.
- `events.get({ eventId })` validates the identifier and returns the event or `null`.

The event record contains the original brief, a short display title, overall status, creation time, and activity entries. Venue candidates and outreach records should become separate tables only when those workflows are implemented; they are not pre-modeled for the shell.

Initial activity entries can be deterministic demonstration states so the event workspace can be designed and verified before external services are connected. They must be visibly labeled as demo behavior until backed by real work.

## Data Flow

1. The organizer writes an event brief on `/`.
2. The client rejects an empty or whitespace-only brief.
3. The client calls `events.create` and disables repeat submission.
4. Convex stores the event and returns its identifier.
5. The client navigates to `/event?id=<eventId>`.
6. The event page validates the query parameter and subscribes to `events.get`.
7. The workspace renders the event brief and activity states reactively.
8. Future research and outreach functions update the same event-linked records, allowing Convex subscriptions to update the workspace without polling.

## States and Errors

- **Empty brief:** keep focus in the composer and show an inline instruction.
- **Creation failure:** keep the brief intact and show a retryable error near the action.
- **Missing event ID:** explain that the link is incomplete and provide a `Start a new search` action.
- **Unknown event ID:** explain that the event could not be found; do not silently create a replacement.
- **Loading event:** show a restrained skeleton matching the workspace structure.
- **Failed activity:** identify the failed stage and offer a retry only when a real retry action exists.
- **No venue results:** say that no suitable venues have been found yet and keep the event brief available for refinement.

## Visual Direction

Reuse the existing global design system:

- Bone page background, paper-white working surfaces, carbon text, soft stone secondary surfaces, and restrained clay status accents.
- Manrope for branding, interface text, labels, and data.
- Eight-pixel controls, sixteen-pixel cards, and twenty-four-pixel elevated workspace surfaces.
- Borders and shadows remain subtle; there are no gradients, glass effects, decorative blobs, or ambient animation.

The single deliberate visual gesture is the large central composer transitioning into the activity stream: the place where the organizer writes the brief becomes the place where Gatherly reports what it is doing. Motion, if used, is limited to this transition and a reduced-motion-safe active-stage indicator.

## Accessibility

- The composer has a persistent accessible label even if the visual label is hidden.
- Submit works with keyboard controls without making plain Enter accidentally send a multiline prompt; the interface states the shortcut if one is added.
- Focus remains visible using the existing ring token.
- Status is communicated with text and icons, not color alone.
- Activity updates use a non-disruptive live region and do not repeatedly steal focus.
- Desktop panes collapse into a logical reading order on mobile.

## Verification

- Type checking, linting, and the production static-export build pass.
- The root layout remains usable at narrow mobile and wide desktop widths.
- Empty input cannot create an event.
- Repeated clicks while creation is pending create only one event.
- Successful creation produces a bookmarkable event URL.
- Refreshing that URL restores the same event from Convex.
- Missing and unknown identifiers show explicit recovery states.
- Every outbound message shown in the UI remains a draft until an organizer action changes its state.

## Decisions

- The root page is a product entry point, not a full marketing site.
- Event state lives on its own persistent route rather than being held on the root page.
- Static hosting is preserved, so the event ID initially lives in a query parameter.
- The first slice models only events; venue and outreach schemas wait for their corresponding workflows.
- Privacy is not simulated. Real user data waits for authentication and authorization.
