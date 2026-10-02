import type { Message as ChatMessage } from "@/lib/types";
import { Message } from "./Message";
import { TypingDots } from "./TypingDots";

interface MessageListProps {
  messages: ChatMessage[];
  sending: boolean;
  onRetry: () => void;
}

export function MessageList({ messages, sending, onRetry }: MessageListProps) {
  return (
    <ol className="list-none">
      {messages.map((message, i) => {
        // A hairline only where a new exchange begins; spacing carries the rest.
        const startsExchange = message.role === "user" && i > 0;

        return (
          <li
            key={message.id}
            className={
              startsExchange
                ? "mt-9 border-t border-white/10 pt-9"
                : i > 0
                  ? "mt-5"
                  : ""
            }
          >
            <Message message={message} onRetry={onRetry} />
          </li>
        );
      })}

      {sending && (
        <li className="mt-5">
          <TypingDots />
        </li>
      )}
    </ol>
  );
}
