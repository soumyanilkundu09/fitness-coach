"use client";

import { useEffect, useRef, useState } from "react";

export const MAX_MESSAGE_LENGTH = 2000;

interface ComposerProps {
  onSend: (text: string) => void;
  disabled: boolean;
}

export function Composer({ onSend, disabled }: ComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Grow with the content up to a ceiling, then scroll inside.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value]);

  const tooLong = value.length > MAX_MESSAGE_LENGTH;
  const canSend = !disabled && value.trim().length > 0 && !tooLong;
  // Stays quiet until the limit is actually in sight.
  const showCount = value.length > MAX_MESSAGE_LENGTH - 400;

  function submit() {
    if (!canSend) return;
    onSend(value);
    setValue("");
  }

  return (
    <div className="border-t border-white/10 bg-ground pt-4 pb-5">
      <div
        className={`border bg-ground-raised transition-colors ${
          tooLong ? "border-ink" : "border-white/10 focus-within:border-indigo"
        }`}
      >
        <label htmlFor="composer" className="sr-only">
          Message the coach
        </label>
        <textarea
          id="composer"
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder="Ask about training, form, recovery, or staying consistent"
          className="block w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-[15px] font-light leading-relaxed text-ink placeholder:text-muted/70 focus:outline-none"
        />

        <div className="flex items-center justify-between gap-3 px-3 pb-3">
          <span
            className={`font-data tnum text-[11px] ${tooLong ? "font-normal text-ink" : "text-muted"}`}
          >
            {showCount
              ? `${value.length} / ${MAX_MESSAGE_LENGTH}`
              : ""}
          </span>

          <div className="flex items-center gap-3">
            <span className="mono-label hidden text-muted sm:inline">
              Enter to send
            </span>
            <button
              type="button"
              onClick={submit}
              disabled={!canSend}
              className="bg-indigo px-4 py-2 text-[13px] font-normal text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-panel disabled:text-muted"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {tooLong && (
        <p className="mt-2 text-[12px] font-light text-muted">
          <span className="mono-label mr-1 text-ink">Over limit</span>
          That&rsquo;s {value.length} characters. Trim it to {MAX_MESSAGE_LENGTH}{" "}
          or fewer to send.
        </p>
      )}
    </div>
  );
}
