# FitnessCoach — n8n Workflow → App

Turns a working n8n workflow into a deployed, testable web app. One pipeline, four phases — copy this file's pattern for the next workflow app too.

## Prerequisites (one-time)
- Connect the n8n MCP server (`/mcp` or `claude mcp add`) so workflows can be inspected and test-executed directly.
- Connect the GitHub MCP server for repo creation/push.
- Vercel account/CLI available for deployment (not MCP-based).

## Phases

### 1. Workflow audit (n8n MCP)
- Inspect the trigger node: confirm it's webhook-callable and document the exact expected input shape.
- Trace to the final node and document the exact output shape returned to the caller.
- Test-execute the workflow via n8n MCP with representative input; confirm success *and* failure responses are well-formed JSON.
- Fix issues in n8n itself, not by working around them in the front end.
- Don't move to Phase 2 until the webhook is reliable in both success and error cases.

### 2. Front end (Next.js)
- Scaffold with Next.js (App Router). Call the webhook from a **server route handler** (`app/api/chat/route.ts`), not from the browser.
  - *Revised 2026-10-02 — this replaced an earlier "call the webhook directly from the client, no backend proxy" rule.* The proxy keeps the webhook URL out of the client bundle, makes CORS irrelevant, lets a shared secret be added without shipping it to the browser, and at deploy time means only the server needs to reach the n8n tunnel rather than every visitor.
  - The env var therefore has **no** `NEXT_PUBLIC_` prefix. Never put secrets in `NEXT_PUBLIC_*` vars — anything so prefixed is in the bundle and public.
- Mirror the workflow's own input validation in the route handler so the ordinary mistake costs no round trip, but treat n8n as the real gate.
- Always set an explicit fetch timeout. Node's `fetch` has none, so without one a wedged upstream hangs the request forever. Measure a real response before picking the number.
- Scope the UI to: collect input → call webhook → render output → handle loading/error states. Don't build UI for data the workflow doesn't actually return yet.
- If the workflow is driven by an LLM, assume the response is **markdown** and render it as such — but with raw HTML disabled.
- Use the `frontend-design` skill for UI/aesthetic decisions rather than defaulting to generic styling.

### 3. Local testing
- Run `next dev` and test the full round trip against the real (or staging) n8n instance — no mocked responses.
- Explicitly test the failure path: workflow error, timeout, malformed input.

### 4. Ship (GitHub MCP + Vercel)
- `git init`, create the GitHub repo via GitHub MCP, push.
- Connect the repo to Vercel, set required env vars, deploy.
- Smoke-test the deployed URL against the live webhook before calling it done.

## Conventions
- Each workflow-app gets its own folder (this one: `FitnessCoach/`) with this same CLAUDE.md pattern.
- **Inside it, workflow concerns and app code stay separate:**
  - `<Name>/` — `CLAUDE.md`, and `.env` holding `N8N_API_URL` / `N8N_API_KEY` for MCP work only.
  - `<Name>/web/` — the Next.js app, with its own `.env.local` for runtime config and a committed `.env.example`. On Vercel, set Root Directory to `web`.
- Inside `web/`: `app/` routes, `components/<domain>/`, `hooks/`, `lib/` (pure logic — types, domain math, storage, fetch client). Keep domain rules in `lib/` as pure functions so they're readable and testable without a browser.
- Package manager: npm.

## Fitness Coach workflow contract (confirmed 2026-10-02)
- A **conversational JSON API**: generic `Webhook` in, plain-text answer out, with per-session conversation memory.
- Graph: `Webhook` → `Validate Input` (IF) → `AI Agent` (Google Gemini + Simple Memory) → `Respond - Success` | `Respond - Agent Error`; `Validate Input`'s false branch → `Respond - Invalid Input`.
- **Request:** `POST {N8N_WEBHOOK_URL}` with `{"message": "<user's turn>", "sessionId": "<stable per-conversation id>"}`
- **Success:** `200 {"response": "<assistant text>"}` — the text is **markdown** (the system prompt asks for bullet points and structure), so any caller must render it as such.
- **Failure:** missing/empty `message`, or `message` longer than **2000 characters** → `400 {"error":"validation_error","message":"..."}` (`Validate Input` checks both with an `and` combinator; the single 400 Respond node picks its wording by expression). Agent/Gemini call fails → `502 {"error":"upstream_error","message":"..."}` (via `onError: continueErrorOutput` on the AI Agent, wired to its own Respond node)
- **Latency:** a full structured answer takes **10–12s**. Any caller needs a timeout well above that, and any host needs a function limit above it (Vercel Hobby's 10s cap is *below* it).
- Graph (updated): `Webhook` → `Validate Input` (IF) → `AI Agent` → `Check Agent Output` (IF) → `Respond - Success` | `Respond - Agent Error`; `Validate Input`'s false branch and `AI Agent`'s `onError` error output both also land on the 400 / `Respond - Agent Error` nodes respectively.
- **Fixed 2026-10-02 — a 200 could carry no answer.** `Respond - Success` emits `{{ { "response": $json.output } }}` with no check that `output` exists. Found by testing the failure path directly: with the Gemini sub-node disabled, the webhook returned `200 {}` — the AI Agent's error output never fired (the node still "succeeded", it just produced nothing), so the 502 branch was silently bypassed. A direct caller reading only the status code would be misled into treating `{}` as a real answer. **Fix:** added `Check Agent Output` (IF node, `$json.output` not-empty) between `AI Agent` and `Respond - Success`; the empty case now routes to the existing `Respond - Agent Error` (502). Re-verified with the same disabled-Gemini test: now returns `502 {"error":"upstream_error",...}` correctly, both via the raw webhook and through the front end's `/api/chat`. Re-enabled Gemini and confirmed the success path still works and `n8n_validate_workflow` is clean (9/9 nodes enabled, 9/9 valid connections, 0 errors).
- No auth on the webhook. CORS confirmed working automatically (n8n reflects the request `Origin` on both preflight and the real response — no node config needed). Fine for local dev; revisit auth before a public deploy.

### Memory / `sessionId` (the front end's one obligation)
- `Simple Memory` (`memoryBufferWindow`, `contextWindowLength: 20`) is wired `ai_memory` → AI Agent, with `sessionIdType: customKey` and
  `sessionKey = {{ $('Fitness Coach Webhook').first().json.body.sessionId || 'anon-' + $execution.id }}`.
- **The front end must generate a `sessionId` once per conversation and send the same value on every turn.** Use `crypto.randomUUID()`, hold it in state (and `sessionStorage` if the chat should survive a refresh). A new id = a fresh conversation; "New chat" is just a new id.
- `sessionId` is **optional** — omit it and the fallback produces a per-execution key, i.e. the old stateless behaviour. So a caller that forgets it degrades silently into amnesia rather than erroring; that's deliberate, but it means a bug in the front end's id handling looks like "the bot forgot me", not like a crash.
- Memory is stored **inside the n8n instance**, not in the browser. It is not shared across workers — if n8n ever moves to Queue Mode / multi-main, swap in `memoryPostgresChat` or `memoryRedisChat`. Also note it holds raw conversation text in n8n's DB, so treat `sessionId`s as non-guessable (a UUID, never a user id or email).
- `Google Gemini Chat Model1` has `retryOnFail: true, maxTries: 3, waitBetweenTries: 2000` so transient Gemini 429/5xx retry instead of surfacing as a 502.
- **Design decision:** originally a LangChain Chat Trigger (chat-shaped, `{chatInput, sessionId}` → `{output}`, auto session memory). Moved to a generic `Webhook` + `Respond to Webhook` for full control over field names, response shape, and explicit 400 vs 502 codes. The cost is that the Chat Trigger's automatic prompt-input and session wiring is now manual — hence the explicit `promptType: "define"` / `text` expression on the Agent and the `sessionKey` expression above.
- **Phase 4 blocker to plan for:** the webhook only exists on `localhost:5678` (local Docker n8n). A Vercel-deployed front end can't reach it — will need either a tunnel (e.g. Cloudflare Tunnel/ngrok) to the local instance, or n8n deployed somewhere publicly reachable, before shipping.
- **Verified 2026-10-02:** two calls sharing a `sessionId` → second recalled details from the first; a third call with a different `sessionId` correctly knew nothing; no `sessionId` → works, no recall; empty *and* missing `message` → `400` with the JSON error body.

## Status
- [x] Workflow audited
- [x] Front end scaffolded (`web/` — Next.js App Router chat UI with gamified progress, see `web/README.md`)
- [x] Locally tested (`npm run dev` + direct webhook calls — memory, 400s, the 502 path with Gemini deliberately disabled, and the empty-output fix all verified against the live instance 2026-10-02)
- [ ] Pushed to GitHub
- [ ] Deployed to Vercel (blocked — see Phase 4 blocker above: needs a tunnel or hosted n8n, and a plan above Vercel Hobby's 10s function limit)
