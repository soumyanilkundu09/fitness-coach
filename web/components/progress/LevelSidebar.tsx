import { LEVEL_NAMES } from "@/lib/progress";
import type { Progress } from "@/lib/types";

interface LevelSidebarProps {
  progress: Progress;
  /** Changes when a set closes; pulses the current row once. */
  levelUpToken: number;
}

/**
 * The whole ladder, always visible — not just the current rung. Reached and
 * current levels carry the one indigo accent (leading numeral, current row's
 * left rule); everything ahead stays dim. No cards: rows separated by a
 * hairline, the grid gap doing the work a border would otherwise do.
 */
export function LevelSidebar({ progress, levelUpToken }: LevelSidebarProps) {
  const displayLevel = Math.min(progress.level, LEVEL_NAMES.length);
  const overflow = progress.level - LEVEL_NAMES.length;

  return (
    <div>
      <p className="mono-label text-muted">Progress</p>

      <div className="mt-5 flex flex-col">
        {LEVEL_NAMES.map((name, idx) => {
          const levelNum = idx + 1;
          const isCurrent = levelNum === displayLevel;
          const isReached = levelNum <= displayLevel;

          return (
            <div
              // Current row is keyed on the level-up token so it replays its
              // pulse once per level-up; other rows just key on their name.
              key={isCurrent ? `${name}-${levelUpToken}` : name}
              className={`flex items-center gap-3 border-t border-l-2 border-white/10 py-3 pl-3 first:border-t-0 ${
                isCurrent
                  ? "border-l-indigo"
                  : "border-l-transparent"
              } ${isCurrent && levelUpToken > 0 ? "animate-set-close" : ""}`}
            >
              <span
                className={`font-data tnum text-[11px] font-light ${
                  isReached ? "text-indigo" : "text-muted/50"
                }`}
              >
                {String(levelNum).padStart(2, "0")}
              </span>

              <span
                className={`flex-1 text-[14px] font-light ${
                  isCurrent
                    ? "text-ink"
                    : isReached
                      ? "text-muted"
                      : "text-muted/40"
                }`}
              >
                {name}
                {isCurrent && overflow > 0 && levelNum === LEVEL_NAMES.length
                  ? ` +${overflow}`
                  : ""}
              </span>

              {isCurrent && (
                <div className="flex items-center gap-[3px]" aria-hidden="true">
                  {Array.from({ length: progress.repsPerSet }, (_, i) => (
                    <span
                      key={
                        i === progress.repsInSet - 1
                          ? `rep-${i}-${progress.repsInSet}`
                          : `rep-${i}`
                      }
                      className={`block h-[9px] w-[2px] ${
                        i < progress.repsInSet
                          ? "animate-rep-fill bg-indigo"
                          : "bg-white/15"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* The ladder is decorative; this is the same information in words. */}
      <p className="sr-only" aria-live="polite">
        {`Level ${progress.level}, ${progress.name}. ${progress.repsInSet} of ${progress.repsPerSet} messages toward the next level.`}
      </p>
    </div>
  );
}
