import type { Message, PersistedState } from "./types";
import { createSessionId } from "./session";

const KEY = "fitness-coach.state.v1";

/**
 * The seam. Progress lives in the browser today; pointing it at an n8n Data
 * Table later means writing one more implementation of this and nothing else.
 * Async even though localStorage is synchronous, so that swap stays local.
 */
export interface ProgressStore {
  load(): Promise<PersistedState>;
  save(state: PersistedState): Promise<void>;
  clear(): Promise<void>;
}

export function emptyState(): PersistedState {
  return {
    version: 1,
    sessionId: createSessionId(),
    totalUserMessages: 0,
    transcript: [],
    updatedAt: Date.now(),
  };
}

function isMessage(v: unknown): v is Message {
  if (typeof v !== "object" || v === null) return false;
  const m = v as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    (m.role === "user" || m.role === "coach") &&
    typeof m.text === "string" &&
    (m.status === "sent" || m.status === "pending" || m.status === "failed") &&
    typeof m.at === "number"
  );
}

/**
 * Anything that fails validation is discarded rather than patched. A corrupt
 * blob is rare; a half-trusted one that crashes on render is worse.
 */
function parse(raw: string): PersistedState | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;

  const s = data as Record<string, unknown>;
  if (s.version !== 1) return null;
  if (typeof s.sessionId !== "string" || s.sessionId.length === 0) return null;
  if (typeof s.totalUserMessages !== "number" || !Number.isFinite(s.totalUserMessages)) {
    return null;
  }
  if (!Array.isArray(s.transcript)) return null;

  // Drop a message left mid-flight by a tab closed during a request; it never
  // got an answer, so restoring it as pending would hang the UI forever.
  const transcript = s.transcript
    .filter(isMessage)
    .map((m) => (m.status === "pending" ? { ...m, status: "failed" as const } : m));

  return {
    version: 1,
    sessionId: s.sessionId,
    totalUserMessages: Math.max(0, Math.floor(s.totalUserMessages)),
    transcript,
    updatedAt: typeof s.updatedAt === "number" ? s.updatedAt : Date.now(),
  };
}

/**
 * Every access is wrapped: localStorage throws outright in some private modes
 * and when site data is blocked, and the app has to keep working without it.
 */
export const localProgressStore: ProgressStore = {
  async load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return emptyState();
      return parse(raw) ?? emptyState();
    } catch {
      return emptyState();
    }
  },

  async save(state) {
    try {
      window.localStorage.setItem(
        KEY,
        JSON.stringify({ ...state, updatedAt: Date.now() }),
      );
    } catch {
      // Out of quota or storage blocked. The session continues in memory.
    }
  },

  async clear() {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      // Nothing to do; the caller is resetting in-memory state regardless.
    }
  },
};
