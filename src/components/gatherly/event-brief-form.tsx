// Captures an event brief, creates its persistent Convex record, and opens it.
"use client";

import { useMutation } from "convex/react";
import { ArrowUpRight, BrainCircuit, Flame, KeyRound, LoaderCircle, Mail, Paperclip } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  eventHref,
  normalizeEventBrief,
  venueDemoHref,
} from "@/lib/event-navigation";
import {
  saveProviderCredentials,
  type ProviderCredentials,
} from "@/lib/provider-credentials";

const EXAMPLES = [
  {
    type: "Developer meetup",
    location: "Bengaluru",
    attendance: "200 guests",
    requirements: "Wi-Fi · Projection · Accessible entry",
    demo: true,
  },
  {
    type: "Creative showcase",
    location: "Berlin",
    attendance: "180 guests",
    requirements: "Stage · Late-evening access",
    prompt: "A creative showcase for 180 guests in Berlin with a stage and late-evening access",
    demo: false,
  },
  {
    type: "Company gathering",
    location: "Central London",
    attendance: "120 guests",
    requirements: "Catering · Breakout space",
    prompt: "A company gathering for 120 people near central London with catering and breakout space",
    demo: false,
  },
] as const;

const PROVIDERS = [
  { name: "OpenAI", detail: "Plans and reviews", icon: BrainCircuit },
  { name: "Firecrawl", detail: "Searches and verifies", icon: Flame },
  { name: "AgentMail", detail: "Drafts and sends", icon: Mail },
];

const emptyCredentials: ProviderCredentials = {
  openaiApiKey: "",
  firecrawlApiKey: "",
  agentMailApiKey: "",
  agentMailInboxId: "",
};

export function EventBriefForm() {
  const [brief, setBrief] = useState("");
  const [credentials, setCredentials] = useState(emptyCredentials);
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const [briefFileName, setBriefFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const briefRef = useRef<HTMLTextAreaElement>(null);
  const briefFileRef = useRef<HTMLInputElement>(null);
  const requestKeyRef = useRef<string | null>(null);
  const submittingRef = useRef(false);
  const createEvent = useMutation(api.events.create);
  const router = useRouter();
  const credentialsComplete = Object.values(credentials).every((value) => value.trim());

  function updateBrief(value: string) {
    if (submittingRef.current) return;
    setBrief(value);
    setBriefFileName(null);
    setError(null);
    requestKeyRef.current = null;
  }

  async function readBriefFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (!/\.(txt|md)$/i.test(file.name) || file.size > 16_000) {
        throw new Error("Choose a .txt or .md brief under 16 KB.");
      }
      const content = normalizeEventBrief(await file.text());
      if (!content) throw new Error("The selected brief is empty.");
      updateBrief(content);
      setBriefFileName(file.name);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read the brief file.");
    } finally {
      input.value = "";
    }
  }

  function updateCredential(key: keyof ProviderCredentials, value: string) {
    setCredentials((current) => ({ ...current, [key]: value }));
    setCredentialError(null);
  }

  function saveCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!credentialsComplete) {
      setCredentialError("Add all four provider credentials before saving.");
      return;
    }
    setCredentialError(null);
    setCredentialsOpen(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    try {
      const normalized = normalizeEventBrief(brief);
      if (!normalized) {
        setError("Describe the event before starting a search.");
        briefRef.current?.focus();
        return;
      }
      if (!credentialsComplete) {
        setCredentialError("Add all four provider credentials before starting a live search.");
        setCredentialsOpen(true);
        return;
      }

      submittingRef.current = true;
      setPending(true);
      setError(null);
      requestKeyRef.current ??= crypto.randomUUID();
      const created = await createEvent({
        brief: normalized,
        requestKey: requestKeyRef.current,
      });
      saveProviderCredentials(created.eventId, credentials);
      const href = eventHref(created.eventId, created.sendToken);
      if (process.env.NODE_ENV === "production") window.location.assign(href);
      else router.push(href);
    } catch (caughtError) {
      briefRef.current?.focus();
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Gatherly could not create this event. Try again.",
      );
      submittingRef.current = false;
      setPending(false);
    }
  }

  return (
    <div className="mt-7 w-full">
      <form
        onSubmit={handleSubmit}
        noValidate
        className="rounded border border-border bg-card p-3 text-left sm:p-4"
      >
        <label htmlFor="event-brief" className="sr-only">
          Describe your event and venue requirements
        </label>
        <Textarea
          ref={briefRef}
          id="event-brief"
          value={brief}
          readOnly={pending}
          onChange={(event) => updateBrief(event.target.value)}
          placeholder="I need a London venue for a 300-person creative showcase in October, with a stage and late access…"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "event-brief-error" : "event-brief-help"}
          className="min-h-28 resize-none border-0 bg-transparent px-3 py-3 text-base leading-7 shadow-none focus-visible:border-transparent focus-visible:ring-0 md:text-base"
        />
        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border px-2 pt-3">
          <p id="event-brief-help" className="hidden text-xs text-muted-foreground sm:block">
            Include location, guest count, dates, and must-haves.
          </p>
          <div className="ml-auto flex items-center gap-2">
            <Dialog open={credentialsOpen} onOpenChange={setCredentialsOpen}>
              <DialogTrigger
                render={
                  <Button type="button" size="lg" variant="outline" disabled={pending} className="h-10 rounded px-4" />
                }
              >
                <KeyRound aria-hidden="true" />
                {credentialsComplete ? "Keys configured" : "Configure keys"}
              </DialogTrigger>
              <DialogContent className="gap-0 rounded border border-border p-0 sm:max-w-xl">
                <div className="border-b border-border p-5 pr-12">
                  <DialogTitle>Configure provider keys</DialogTitle>
                  <DialogDescription className="mt-2 leading-5">
                    Used only for your live search and kept in this tab&apos;s session storage.
                  </DialogDescription>
                </div>
                <form onSubmit={saveCredentials} noValidate>
                  <div className="grid gap-4 p-5 sm:grid-cols-2">
                    <label className="text-xs font-medium">
                      OpenAI API key
                      <Input
                        required
                        type="password"
                        maxLength={512}
                        autoComplete="off"
                        spellCheck={false}
                        value={credentials.openaiApiKey}
                        onChange={(event) => updateCredential("openaiApiKey", event.target.value)}
                        placeholder="sk-…"
                        className="mt-1 bg-card"
                      />
                    </label>
                    <label className="text-xs font-medium">
                      Firecrawl API key
                      <Input
                        required
                        type="password"
                        maxLength={512}
                        autoComplete="off"
                        spellCheck={false}
                        value={credentials.firecrawlApiKey}
                        onChange={(event) => updateCredential("firecrawlApiKey", event.target.value)}
                        placeholder="fc-…"
                        className="mt-1 bg-card"
                      />
                    </label>
                    <label className="text-xs font-medium">
                      AgentMail API key
                      <Input
                        required
                        type="password"
                        maxLength={512}
                        autoComplete="off"
                        spellCheck={false}
                        value={credentials.agentMailApiKey}
                        onChange={(event) => updateCredential("agentMailApiKey", event.target.value)}
                        placeholder="am-…"
                        className="mt-1 bg-card"
                      />
                    </label>
                    <label className="text-xs font-medium">
                      AgentMail inbox ID
                      <Input
                        required
                        type="text"
                        maxLength={320}
                        autoComplete="off"
                        spellCheck={false}
                        value={credentials.agentMailInboxId}
                        onChange={(event) => updateCredential("agentMailInboxId", event.target.value)}
                        placeholder="name@agentmail.to"
                        className="mt-1 bg-card"
                      />
                    </label>
                  </div>
                  {credentialError ? (
                    <p role="alert" className="px-5 pb-4 text-xs text-destructive">
                      {credentialError}
                    </p>
                  ) : null}
                  <div className="flex justify-end gap-2 border-t border-border p-4">
                    <DialogClose render={<Button type="button" variant="outline" />}>
                      Cancel
                    </DialogClose>
                    <Button type="submit">Save keys</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            <Button
              type="submit"
              size="lg"
              disabled={pending}
              className="h-10 rounded px-4"
            >
              {pending ? (
                <LoaderCircle className="animate-spin motion-reduce:animate-none" />
              ) : (
                <ArrowUpRight />
              )}
              {pending ? "Creating event" : "Find venues"}
            </Button>
          </div>
        </div>
      </form>

      <div className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span>or</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          aria-label={briefFileName ? `Replace brief file: ${briefFileName}` : "Upload text brief"}
          className="h-8 max-w-full rounded"
          onClick={() => briefFileRef.current?.click()}
        >
          <Paperclip aria-hidden="true" />
          <span className="max-w-56 truncate">{briefFileName ?? "Upload text brief"}</span>
        </Button>
        <input
          ref={briefFileRef}
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          disabled={pending}
          className="sr-only"
          aria-label="Choose brief file"
          onChange={readBriefFile}
        />
      </div>

      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        Live searches use your credentials. Event data is public in this prototype.
      </p>

      {error ? (
        <p id="event-brief-error" role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid grid-cols-3 gap-2" aria-label="Example events">
        {EXAMPLES.map((example) => {
          const content = (
            <>
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {example.type}
              </span>
              <span className="mt-4 text-sm font-semibold tracking-[-0.015em]">
                {example.location}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                {example.attendance}
              </span>
              <span className="mt-auto border-t border-border pt-3 text-[0.68rem] leading-4 text-muted-foreground group-hover:text-foreground sm:text-xs sm:leading-5">
                {example.requirements}
              </span>
            </>
          );
          const className = "group flex min-h-40 min-w-0 flex-col rounded border border-border bg-card p-3 text-left transition-colors hover:border-input hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:border-foreground/40 aria-pressed:bg-secondary/60 sm:p-4";

          return example.demo ? (
            <a
              key={example.type}
              href={venueDemoHref()}
              className={`${className} border-[#b8cdaa] bg-[#edf4e9] ${pending ? "pointer-events-none opacity-50" : ""}`}
            >
              {content}
            </a>
          ) : (
            <button
              key={example.type}
              type="button"
              disabled={pending}
              onClick={() => updateBrief(example.prompt)}
              aria-pressed={brief === example.prompt}
              className={className}
            >
              {content}
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-3 divide-x divide-border border-y border-border py-3 text-left">
        {PROVIDERS.map(({ name, detail, icon: Icon }) => (
          <div key={name} className="min-w-0 px-3 first:pl-0 last:pr-0">
            <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 text-xs font-semibold">{name}</p>
            <p className="mt-0.5 text-[0.68rem] leading-4 text-muted-foreground">
              {detail}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
