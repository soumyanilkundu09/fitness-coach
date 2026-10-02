# Fitness Coach — web

Chat front end for the "Fitness Coach" n8n workflow. Next.js App Router, no database, no accounts.

## Running it

The n8n container must be running first — the app is useless without it.

```bash
cp .env.example .env.local   # then set N8N_WEBHOOK_URL
npm install
npm run dev                  # http://localhost:3000
```

## How it talks to n8n

The browser never calls n8n. It posts to `/api/chat`, and [that route handler](app/api/chat/route.ts) forwards to the webhook server-side. This keeps the webhook URL out of the client bundle, sidesteps CORS, and leaves room to add a shared secret without shipping it to the browser.

```
browser → POST /api/chat → N8N_WEBHOOK_URL → 200 { response }
```

`sessionId` is the one thing the client must get right: generated once per
conversation and resent on every turn, because the agent keys its memory on it.
A new id is a coach who has never met you — that is all "New chat" does.

Replies come back as **markdown** (the agent's prompt tells it to use lists and
bold), so they go through `react-markdown`. Raw HTML is disabled: the text comes
out of a language model.

## Progress

Five messages close a set and raise the level (Warm-up → Form → Tempo → Base →
Threshold → Peak). The rules are pure functions in [lib/progress.ts](lib/progress.ts).

State lives in `localStorage` behind the `ProgressStore` interface in
[lib/storage.ts](lib/storage.ts) — pointing it at an n8n Data Table later means
writing one more implementation of that interface and nothing else.

## Layout

```
app/        routes; api/chat is the only server code
components/ chat/ (transcript, composer) and progress/ (rep column, level)
hooks/      useCoachSession — owns transcript, session id and rep count together
lib/        types, pure progress math, storage, session ids, fetch client
```

## Notes before deploying

- `N8N_WEBHOOK_URL` must be publicly reachable. Vercel cannot see `localhost`, so
  this needs a tunnel to the local n8n or a hosted instance.
- A full answer takes **10–12s**. Vercel's Hobby plan caps a function at 10s,
  which is under that — Pro, or a streaming redesign, is required.
- The webhook has no auth. Add the shared-secret header before exposing it.
