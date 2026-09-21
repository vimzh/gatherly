# AI Venue Sourcing Workspace

## In One Sentence

A chat-based workspace that helps event organizers find suitable venues, contact them, manage the resulting conversations, and compare viable options before taking over to finalize a booking.

## The Idea

An organizer describes the event in ordinary language, including its purpose, location, expected attendance, and any other constraints that matter. The product searches the public web for possible venues, checks the available evidence about each place, finds a public contact route, and starts the outreach process.

The organizer sees the search, candidates, outreach status, and venue conversations in one place. The product can continue the email discussion with each venue, gather missing details, and organize the replies into comparable options. Once a venue looks promising, the organizer takes over to make the final decision and complete the booking outside the product.

## The Problem

Finding an event venue often requires several disconnected tasks. An organizer searches across venue websites and directories, checks whether each place fits the event and audience size, finds contact details, sends similar enquiries, waits for replies, follows up, and compares answers that arrive in different formats.

Existing venue marketplaces can simplify discovery and enquiries within their own listings, while larger sourcing tools can manage formal requests for proposals. The remaining opportunity is a guided workspace that can research the wider public web and manage direct email conversations on the organizer's behalf.

## Who It Is For

The primary users are people organizing events who do not already have a reliable venue-sourcing process or venue network. This includes community and hackathon organizers, artists and performers, independent event producers, and teams planning meetings or gatherings.

The initial concept supports different event types rather than specializing in one category.

## Core Experience

1. The organizer opens a chat and describes the event and venue requirements.
2. The product asks for missing information that materially affects the search.
3. It searches the public web and builds an evidence-backed list of possible venues.
4. The organizer can review each candidate, including why it may fit and where the information came from.
5. The product drafts an email for each selected venue. The organizer reviews it and clicks Send before it leaves the system.
6. Incoming replies appear in the workspace. The product summarizes them, identifies missing answers, and drafts the next response. Every outbound reply requires the organizer to click Send.
7. The organizer compares the viable options and takes over when ready to negotiate personally, arrange a visit, or finalize the booking.

## Features

- A conversational event brief that turns an organizer's request into clear venue requirements.
- Open-web venue discovery rather than relying on a single marketplace catalog.
- Evidence-backed candidate profiles with capacity, fit, public contact information, and source links when available.
- A shortlist that the organizer can review before or during outreach.
- Email outreach to selected venues.
- An approval gate that prevents any email from being sent until the organizer reviews it and clicks Send.
- A sidebar or similar workspace showing every venue, its current status, and its conversation.
- Tracked back-and-forth conversations that retain the event brief and the history of each venue thread.
- Clear summaries of venue replies, unanswered questions, and next steps.
- A comparison view for the options that remain viable.
- A visible handoff that lets the organizer take control of a conversation and finish the process personally.

## Why It Matters

The product reduces the repetitive coordination between having an event idea and reaching a credible venue shortlist. It gives organizers one place to understand what has been found, who has been contacted, what each venue has said, and where human attention is needed.

## What Makes It Distinct

The product combines three activities that are usually separated: researching venues across the public web, conducting direct email conversations, and maintaining a live comparison workspace. It is not intended to be another closed venue directory. The organizer directs an active sourcing process and can see the evidence and communication behind every recommendation.

## Required Environment and Compatibility

The initial product is a web application for events whose possible venues have useful public information and can be contacted by email. It depends on venue information and contact routes being publicly available or supplied by the organizer.

## Scope

### Included

- Turning an event description into venue requirements.
- Finding, qualifying, and shortlisting possible venues.
- Contacting venues and tracking replies.
- Continuing venue conversations within organizer-defined boundaries.
- Comparing responses and supporting a human handoff.

### Not Included

- Completing payments or legally binding bookings.
- Signing contracts on the organizer's behalf.
- Replacing site visits or final human due diligence.
- Operating a marketplace of venues with its own inventory.
- Planning the rest of the event beyond venue sourcing.

## Success

The product succeeds when an organizer can move from a plain-language event brief to a credible, evidence-backed shortlist with active or completed venue conversations, understand the differences between the options, and take over without reconstructing the research or email history.

## Principles

- Keep the organizer informed about what the agent is doing and why.
- Never send an email without the organizer's explicit approval.
- Preserve the source and conversation history behind every important claim.
- Automate repetitive coordination while leaving consequential booking decisions to the organizer.
- Treat a venue reply as new evidence, not merely another chat message.

## Constraints and Assumptions

- Venue information may be incomplete, stale, or inconsistent across websites.
- Capacity alone does not prove that a venue is suitable for a particular event.
- The product should use public information responsibly and respect applicable site terms and outreach rules.
- The organizer remains responsible for the final choice, contract, payment, and on-site verification.

## Critical Assumptions to Prove

- Public web sources contain enough current information to produce useful venue candidates for the initial market.
- A reliable public contact route can be found for enough candidates to make the workflow valuable.
- Venue teams are willing to respond to clearly identified, agent-assisted enquiries and continue the conversation by email.
- Replies can be interpreted and normalized well enough to compare capacity, availability, pricing, restrictions, and other material terms without hiding uncertainty.
- Organizers will trust the product to research venues and draft useful outreach while they retain control over every message sent.
- The workflow can operate within the outreach, privacy, and website-use rules of the initial launch market.

## Open Questions

- Should the initial launch focus on London, another single city, or any location with sufficient public venue data?
- Should outreach identify itself as an automated assistant acting for the organizer, and how prominently?
- At what milestone should the default handoff happen: after a positive reply, after a complete quote, after a provisional hold, or only when the organizer chooses?
- Which requirements must be supplied before searching, and which can be discovered through venue conversations?
