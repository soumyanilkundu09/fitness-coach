import { NextResponse } from "next/server";

/**
 * The only place the n8n webhook URL exists. Keeping it server-side means the
 * browser never learns the endpoint, CORS never applies, and a shared secret
 * can be added here later without shipping it to the client.
 */

/**
 * Measured, not guessed: a full structured answer from the coach runs 10-12s,
 * and the Gemini sub-node retries up to 3 times on a transient failure.
 *
 * Deployed on Vercel Hobby (current plan), which hard-kills a function at 10s
 * regardless of what we ask for below — and does it ungracefully (a raw
 * platform error, not our JSON body). So on Hobby we deliberately time out
 * *ourselves* just under that wall, to return a clean "try again" instead.
 * This means a normal 10-12s reply will usually trip this, not rarely — it's
 * a real UX cost of staying on Hobby, not a safety margin for an edge case.
 *
 * On Vercel Pro (or any host without a 10s cap), raise both of these back up:
 * TIMEOUT_MS to 45_000 and maxDuration to 60. Also raise CLIENT_TIMEOUT_MS in
 * lib/chat-client.ts to 50_000 so the client doesn't abort before this does.
 */
const TIMEOUT_MS = 9_000;
const MAX_MESSAGE_LENGTH = 2000;

export const maxDuration = 10;

type CoachReply = { response?: unknown };

function fail(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

export async function POST(request: Request) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error("[chat] N8N_WEBHOOK_URL is not set");
    return fail(
      500,
      "configuration_error",
      "The coach isn't connected yet. Check the server configuration.",
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail(400, "validation_error", "Send a message to get started.");
  }

  const { message, sessionId } = (payload ?? {}) as {
    message?: unknown;
    sessionId?: unknown;
  };

  // Mirrors the workflow's own rules so the ordinary mistake never costs a
  // round trip. n8n still enforces them — this is a shortcut, not the gate.
  if (typeof message !== "string" || message.trim().length === 0) {
    return fail(400, "validation_error", "Write a message first.");
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return fail(
      400,
      "validation_error",
      `That's ${message.length} characters. Keep it under ${MAX_MESSAGE_LENGTH}.`,
    );
  }
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    return fail(400, "validation_error", "This conversation lost its place. Start a new chat.");
  }

  let upstream: Response;
  try {
    upstream = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, sessionId }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    // TimeoutError is what AbortSignal.timeout raises; anything else here means
    // n8n could not be reached at all.
    if (err instanceof Error && err.name === "TimeoutError") {
      console.error("[chat] upstream timed out after", TIMEOUT_MS, "ms");
      return fail(
        504,
        "upstream_timeout",
        "That took too long. Try sending it again.",
      );
    }
    console.error("[chat] could not reach n8n:", err);
    return fail(
      503,
      "service_unavailable",
      "The coach is offline right now. Try again in a moment.",
    );
  }

  const raw = await upstream.text();

  let parsed: unknown;
  try {
    parsed = raw.length > 0 ? JSON.parse(raw) : null;
  } catch {
    console.error("[chat] upstream returned non-JSON:", upstream.status, raw.slice(0, 500));
    return fail(502, "upstream_error", "The coach sent something unreadable. Try again.");
  }

  if (!upstream.ok) {
    // The workflow's own 400 carries copy worth showing. Everything else is our
    // problem, not the reader's, so it gets a generic message and a server log.
    const body = (parsed ?? {}) as { error?: unknown; message?: unknown };
    if (upstream.status === 400 && typeof body.message === "string") {
      return fail(400, "validation_error", body.message);
    }
    console.error("[chat] upstream error:", upstream.status, raw.slice(0, 500));
    return fail(502, "upstream_error", "The coach couldn't answer that. Try again.");
  }

  const reply = (parsed ?? {}) as CoachReply;
  if (typeof reply.response !== "string" || reply.response.trim().length === 0) {
    console.error("[chat] upstream 200 with no usable response:", raw.slice(0, 500));
    return fail(502, "upstream_error", "The coach came back empty. Try again.");
  }

  return NextResponse.json({ response: reply.response });
}
