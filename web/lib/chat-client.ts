import type { ChatError, ChatErrorKind } from "./types";

/**
 * Sits just beyond the route handler's own TIMEOUT_MS, so its clearer 504
 * JSON usually wins over this one firing first. Keep these two in step —
 * see the comment above TIMEOUT_MS in app/api/chat/route.ts.
 */
const CLIENT_TIMEOUT_MS = 10_000;

export type SendResult =
  | { ok: true; response: string }
  | { ok: false; error: ChatError };

function kindFor(status: number): ChatErrorKind {
  if (status === 400) return "validation";
  if (status === 504) return "timeout";
  if (status === 502 || status === 503 || status === 500) return "upstream";
  return "unknown";
}

export async function sendMessage(
  message: string,
  sessionId: string,
): Promise<SendResult> {
  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, sessionId }),
      signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return {
        ok: false,
        error: {
          kind: "timeout",
          message: "That took too long. Try sending it again.",
          retryable: true,
        },
      };
    }
    return {
      ok: false,
      error: {
        kind: "network",
        message: "No connection. Check your network and try again.",
        retryable: true,
      },
    };
  }

  let body: { response?: unknown; message?: unknown } = {};
  try {
    body = await res.json();
  } catch {
    // Fall through to the status-based message below.
  }

  if (!res.ok) {
    const kind = kindFor(res.status);
    return {
      ok: false,
      error: {
        kind,
        message:
          typeof body.message === "string" && body.message.length > 0
            ? body.message
            : "Something went wrong. Try again.",
        retryable: kind !== "validation",
      },
    };
  }

  if (typeof body.response !== "string") {
    return {
      ok: false,
      error: {
        kind: "upstream",
        message: "The coach came back empty. Try again.",
        retryable: true,
      },
    };
  }

  return { ok: true, response: body.response };
}
