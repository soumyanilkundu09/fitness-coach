import type { Progress } from "./types";

/** Five reps closes a set, and a closed set is a level. */
export const REPS_PER_SET = 5;

/**
 * Training-phase vernacular rather than invented tiers, so the label says
 * something true about where you are instead of just counting up.
 */
export const LEVEL_NAMES = [
  "Warm-up",
  "Form",
  "Tempo",
  "Base",
  "Threshold",
  "Peak",
] as const;

export function levelName(level: number): string {
  if (level < 1) return LEVEL_NAMES[0];
  if (level <= LEVEL_NAMES.length) return LEVEL_NAMES[level - 1];
  return `Peak +${level - LEVEL_NAMES.length}`;
}

export function deriveProgress(totalUserMessages: number): Progress {
  const total =
    Number.isFinite(totalUserMessages) && totalUserMessages > 0
      ? Math.floor(totalUserMessages)
      : 0;
  const level = Math.floor(total / REPS_PER_SET) + 1;

  return {
    level,
    name: levelName(level),
    repsInSet: total % REPS_PER_SET,
    repsPerSet: REPS_PER_SET,
    totalUserMessages: total,
  };
}

export function didLevelUp(before: number, after: number): boolean {
  return deriveProgress(after).level > deriveProgress(before).level;
}
