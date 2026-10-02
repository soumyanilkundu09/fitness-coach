"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sendMessage } from "@/lib/chat-client";
import { deriveProgress, didLevelUp } from "@/lib/progress";
import { createSessionId, randomId } from "@/lib/session";
import {
  emptyState,
  localProgressStore,
  type ProgressStore,
} from "@/lib/storage";
import type { ChatError, Message, PersistedState, Progress } from "@/lib/types";

/**
 * Owns the whole conversation: transcript, session id and rep count live in one
 * record because they are only meaningful together. Deliberately a single hook —
 * splitting chat from progress would mean two writers on one storage key.
 */
export interface CoachSession {
  /** False until the browser store has been read; render nothing stateful yet. */
  ready: boolean;
  messages: Message[];
  progress: Progress;
  sending: boolean;
  error: ChatError | null;
  /** Bumped when a set closes, so the view can play the level-up once. */
  levelUpToken: number;
  send: (text: string) => void;
  retryLast: () => void;
  newChat: () => void;
  dismissError: () => void;
}

export function useCoachSession(
  store: ProgressStore = localProgressStore,
): CoachSession {
  const [state, setState] = useState<PersistedState>(() => ({
    version: 1,
    sessionId: "",
    totalUserMessages: 0,
    transcript: [],
    updatedAt: 0,
  }));
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [levelUpToken, setLevelUpToken] = useState(0);

  // One request at a time. Two in flight on the same sessionId would interleave
  // writes into the agent's memory buffer.
  const inFlight = useRef(false);

  // Hydrate after mount, never during render — localStorage does not exist on
  // the server, and reading it in render would desync the first paint.
  useEffect(() => {
    let cancelled = false;
    store
      .load()
      .then((loaded) => {
        if (cancelled) return;
        setState(loaded);
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setState(emptyState());
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [store]);

  useEffect(() => {
    if (!ready) return;
    void store.save(state);
  }, [ready, state, store]);

  // Watched here rather than inside a state updater: React can invoke an updater
  // twice in development, which would fire the celebration twice.
  const prevTotal = useRef<number | null>(null);
  useEffect(() => {
    if (!ready) return;
    const previous = prevTotal.current;
    prevTotal.current = state.totalUserMessages;
    // First run is hydration, not an achievement.
    if (previous === null) return;
    if (didLevelUp(previous, state.totalUserMessages)) {
      setLevelUpToken((t) => t + 1);
    }
  }, [ready, state.totalUserMessages]);

  const deliver = useCallback(
    async (text: string, pendingId: string) => {
      const sessionId = state.sessionId;
      const result = await sendMessage(text, sessionId);
      inFlight.current = false;
      setSending(false);

      if (!result.ok) {
        setError(result.error);
        setState((prev) => ({
          ...prev,
          transcript: prev.transcript.map((m) =>
            m.id === pendingId ? { ...m, status: "failed" } : m,
          ),
        }));
        return;
      }

      setState((prev) => {
        return {
          ...prev,
          totalUserMessages: prev.totalUserMessages + 1,
          transcript: [
            ...prev.transcript.map((m) =>
              m.id === pendingId ? { ...m, status: "sent" as const } : m,
            ),
            {
              id: randomId(),
              role: "coach" as const,
              text: result.response,
              status: "sent" as const,
              at: Date.now(),
            },
          ],
        };
      });
    },
    [state.sessionId],
  );

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!ready || inFlight.current || text.length === 0) return;

      inFlight.current = true;
      setSending(true);
      setError(null);

      const pendingId = randomId();
      setState((prev) => ({
        ...prev,
        transcript: [
          ...prev.transcript,
          {
            id: pendingId,
            role: "user",
            text,
            status: "pending",
            at: Date.now(),
          },
        ],
      }));

      void deliver(text, pendingId);
    },
    [ready, deliver],
  );

  /** Re-sends the last message that failed, in place. */
  const retryLast = useCallback(() => {
    if (!ready || inFlight.current) return;

    const failed = [...state.transcript]
      .reverse()
      .find((m) => m.role === "user" && m.status === "failed");
    if (!failed) return;

    inFlight.current = true;
    setSending(true);
    setError(null);
    setState((prev) => ({
      ...prev,
      transcript: prev.transcript.map((m) =>
        m.id === failed.id ? { ...m, status: "pending" } : m,
      ),
    }));

    void deliver(failed.text, failed.id);
  }, [ready, state.transcript, deliver]);

  /**
   * A new session id is the whole reset: the agent keys memory on it, so a new
   * id is a coach who has never met you. Progress is intentionally kept.
   */
  const newChat = useCallback(() => {
    if (inFlight.current) return;
    setError(null);
    setState((prev) => ({
      ...prev,
      sessionId: createSessionId(),
      transcript: [],
    }));
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  return {
    ready,
    messages: state.transcript,
    progress: deriveProgress(state.totalUserMessages),
    sending,
    error,
    levelUpToken,
    send,
    retryLast,
    newChat,
    dismissError,
  };
}
