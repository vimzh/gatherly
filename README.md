# AI Venue Sourcing Workspace

A Next.js frontend for the Convex All Gas Hackathon. The product helps event organizers research venues, prepare human-approved outreach, track replies, and compare options.

## Getting Started

Install dependencies and run the development server:

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The app uses the Next.js App Router, TypeScript, Tailwind CSS, and shadcn/ui. Product scope and assumptions live in [`docs/idea.md`](docs/idea.md).

## Verify

```bash
bunx tsc --noEmit
bun run lint
bun run build
```

The production build is a static export in `dist/` for deployment through Convex Static Hosting at a `convex.site` URL.
