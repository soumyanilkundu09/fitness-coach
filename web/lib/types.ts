export type Role = "user" | "coach";

/** A user message is optimistic: it renders before the webhook answers. */
export type MessageStatus = "sent" | "pending" | "failed";

export interface Message {
  id: string;
  role: Role;
  text: string;
  status: MessageStatus;
  at: number;
}

export type ChatErrorKind =
  | "validation"
  | "upstream"
  | "timeout"
  | "network"
  | "unknown";

export interface ChatError {
  kind: ChatErrorKind;
  /** Display-ready text, written for the person reading it. */
  message: string;
  retryable: boolean;
}

/**
 * Everything we keep between visits. Transcript and sessionId live together on
 * purpose: a transcript restored next to a different sessionId would show a
 * conversation the agent has no memory of.
 */
export interface PersistedState {
  version: 1;
  sessionId: string;
  totalUserMessages: number;
  transcript: Message[];
  updatedAt: number;
}

/** Derived from totalUserMessages, never stored — storing it invites drift. */
export interface Progress {
  level: number;
  name: string;
  repsInSet: number;
  repsPerSet: number;
  totalUserMessages: number;
}
