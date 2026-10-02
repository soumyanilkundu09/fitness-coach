import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message as ChatMessage } from "@/lib/types";

interface MessageProps {
  message: ChatMessage;
  onRetry?: () => void;
}

/**
 * Reads as a transcript, not a chat app: one column, no bubbles. A single
 * typeface carries both voices, so a mono eyebrow marks who's speaking
 * instead — "Coach" above the reply, "You" above your own line.
 */
export function Message({ message, onRetry }: MessageProps) {
  if (message.role === "coach") {
    return (
      <div className="animate-rise">
        <p className="mono-label mb-1.5 text-muted">Coach</p>
        {/* Raw HTML stays disabled: this text comes out of a language model. */}
        <div className="coach-prose">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
        </div>
      </div>
    );
  }

  const failed = message.status === "failed";

  return (
    <div className="animate-rise">
      <div className="mb-1.5 flex items-center gap-2">
        <span className={`mono-label ${failed ? "text-ink" : "text-muted"}`}>
          {failed ? "You / not sent" : "You"}
        </span>
        {failed && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mono-label text-indigo hover:opacity-70"
          >
            Try again
          </button>
        )}
      </div>
      <p
        className={`text-[15px] font-light leading-relaxed whitespace-pre-wrap ${
          message.status === "pending" ? "text-muted" : "text-ink"
        }`}
      >
        {message.text}
      </p>
    </div>
  );
}
