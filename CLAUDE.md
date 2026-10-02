# FitnessCoach — workflow contract

See the root [`CLAUDE.md`](../CLAUDE.md) (`n8n_claude_automation/CLAUDE.md`)
for the shared pipeline (the four phases), folder conventions, and
prerequisites — those apply to every workflow-app in this workspace and are
no longer duplicated here. This file holds only what's specific to Fitness
Coach: its workflow contract, its memory/session handling, and its status.

## Fitness Coach workflow contract (confirmed 2026-10-02)
- A **conversational JSON API**: generic `Webhook` in, plain-text answer out, with per-session conversation memory.
- Graph: `Webhook` → `Validate Input` (IF) → `AI Agent` (Google Gemini + Simple Memory) → `Respond - Success` | `Respond - Agent Error`; `Validate Input`'s false branch → `Respond - Invalid Input`.
- **Request:** `POST {N8N_WEBHOOK_URL}` with `{"message": "<user's turn>", "sessionId": "<stable per-conversation id>"}`
- **Success:** `200 {"response": "<assistant text>"}` — the text is **markdown** (the system prompt asks for bullet points and structure), so any caller must render it as such.
- **Failure:** missing/empty `message`, or `message` longer than **2000 characters** → `400 {"error":"validation_error","message":"..."}` (`Validate Input` checks both with an `and` combinator; the single 400 Respond node picks its wording by expression). Agent/Gemini call fails → `502 {"error":"upstream_error","message":"..."}` (via `onError: continueErrorOutput` on the AI Agent, wired to its own Respond node)
- **Latency:** a full structured answer takes **10–12s**. Any caller needs a timeout well above that, and any host needs a function limit above it (Vercel Hobby's 10s cap is *below* it).
- **Deploy target is Vercel Hobby (decided 2026-10-02), accepted with the latency mismatch open-eyed.** `TIMEOUT_MS` in `route.ts` and `maxDuration` were lowered to fail fast just under Hobby's 10s wall (clean JSON 504 instead of a raw platform timeout), not raised to ride it out — see the comment above `TIMEOUT_MS`. Since a normal reply runs 10-12s, this will trip on a *typical* exchange, not an outlier. Moving to Pro (or a streaming redesign) removes this; the exact numbers to change back are in that same comment.
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
- **Phase 4 blocker, partially resolved 2026-10-02:** the webhook lives on `localhost:5678` (local Docker n8n). A Cloudflare quick tunnel now exposes it publicly — `cloudflared tunnel --url http://localhost:5678`, running as a background process on the dev machine. That's a testing-grade fix, not a shipping one: quick tunnels have no uptime guarantee and Cloudflare's own terms say not to rely on them in production. The URL also changes every time the tunnel restarts, so it breaks silently if the process or machine goes down — whoever's on call for this needs to know a dead `N8N_WEBHOOK_URL` in Vercel looks like "the coach is offline," not an obvious tunnel failure. Before a real launch, replace it with a named Cloudflare Tunnel (`cloudflared tunnel login` + a fixed hostname) or move n8n to a hosted instance.
- **Verified 2026-10-02:** two calls sharing a `sessionId` → second recalled details from the first; a third call with a different `sessionId` correctly knew nothing; no `sessionId` → works, no recall; empty *and* missing `message` → `400` with the JSON error body.

## Status
- [x] Workflow audited
- [x] Front end scaffolded (`web/` — Next.js App Router chat UI with gamified progress, see `web/README.md`)
- [x] Locally tested (`npm run dev` + direct webhook calls — memory, 400s, the 502 path with Gemini deliberately disabled, and the empty-output fix all verified against the live instance 2026-10-02)
- [x] Pushed to GitHub (`github.com/soumyanilkundu09/fitness-coach`, private, root repo with `web/` as the Vercel Root Directory)
- [ ] Deployed to Vercel — project created 2026-10-02, Root Directory set to `web`; `N8N_WEBHOOK_URL` points at a Cloudflare quick tunnel (see the Phase 4 blocker note above for its caveats). Awaiting first deploy + smoke test.
