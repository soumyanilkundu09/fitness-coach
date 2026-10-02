"use client";

import { useEffect, useRef } from "react";
import { useCoachSession } from "@/hooks/useCoachSession";
import { Navbar } from "../layout/Navbar";
import { LevelSidebar } from "../progress/LevelSidebar";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";

/** Written to show what the coach is actually for, not to fill the space. */
const STARTERS = [
  "Build me a 20-minute routine",
  "Is my squat form likely to be the problem?",
  "I lose motivation after week two",
];

export function ChatScreen() {
  const {
    ready,
    messages,
    progress,
    sending,
    error,
    levelUpToken,
    send,
    retryLast,
    newChat,
  } = useCoachSession();

  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "end",
    });
  }, [messages.length, sending]);

  const empty = ready && messages.length === 0;

  return (
    <div className="flex min-h-full flex-col bg-ground text-ink">
      <Navbar
        showNewChat={messages.length > 0}
        disabled={sending}
        onNewChat={newChat}
      />

      <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col lg:flex-row">
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="mx-auto w-full max-w-[680px] flex-1 px-5">
            {empty ? (
              <div className="pt-16 pb-10">
                <p className="coach-prose max-w-[38ch]">
                  Tell me what you&rsquo;re working on and I&rsquo;ll help you
                  build something you can actually keep up.
                </p>

                <div className="mt-7 flex flex-wrap gap-2">
                  {STARTERS.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => send(starter)}
                      className="border border-white/10 bg-ground-raised px-3 py-2 text-left text-[13px] font-light text-ink transition-colors hover:border-indigo hover:text-indigo"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="pt-8 pb-6" aria-live="polite" aria-atomic="false">
                <MessageList
                  messages={messages}
                  sending={sending}
                  onRetry={retryLast}
                />
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="sticky bottom-0 bg-ground">
            <div className="mx-auto w-full max-w-[680px] px-5">
              {error && (
                <div
                  role="status"
                  className="flex items-start gap-3 border-t border-white/10 py-3"
                >
                  <p className="flex-1 text-[12.5px] font-light text-muted">
                    <span className="mono-label mr-2 text-ink">Error</span>
                    {error.message}
                  </p>
                  {error.retryable && (
                    <button
                      type="button"
                      onClick={retryLast}
                      className="mono-label text-indigo hover:opacity-70"
                    >
                      Try again
                    </button>
                  )}
                </div>
              )}

              <Composer onSend={send} disabled={!ready || sending} />

              <p className="pb-4 text-[11px] font-light leading-relaxed text-muted">
                Guidance only, not medical advice. For pain or injury, see a
                qualified professional.
              </p>
            </div>
          </div>
        </main>

        <aside className="border-t border-white/10 px-5 py-8 lg:w-[280px] lg:shrink-0 lg:border-t-0 lg:border-l lg:px-6 lg:py-10">
          <LevelSidebar progress={progress} levelUpToken={levelUpToken} />
        </aside>
      </div>
    </div>
  );
}
