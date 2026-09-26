export const MAX_SCORE = 10_500;
export const ENDINGS = ["compromise", "clown", "viral", "committee"] as const;
export const MASKS = ["n95", "cloth", "novelty", "none"] as const;

export type ScoreSubmission = {
  submissionId: string;
  initials: string;
  score: number;
  ending: (typeof ENDINGS)[number];
  mask: (typeof MASKS)[number];
};

const BLOCKED_INITIALS = new Set([
  "ASS",
  "FUK",
  "FUC",
  "FCK",
  "FAG",
  "NIG",
  "KKK",
  "CUM",
  "CNT",
  "DCK",
  "SHT",
  "KYS",
]);
const FIELDS = ["submissionId", "initials", "score", "ending", "mask"];

export function validateSubmission(value: unknown): ScoreSubmission | null {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null;
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).length !== FIELDS.length ||
    FIELDS.some((key) => !(key in input))
  )
    return null;
  if (
    typeof input.submissionId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.submissionId,
    )
  )
    return null;
  if (typeof input.initials !== "string" || !/^[a-z]{3}$/i.test(input.initials))
    return null;
  if (
    typeof input.score !== "number" ||
    !Number.isSafeInteger(input.score) ||
    input.score < 0 ||
    input.score > MAX_SCORE
  )
    return null;
  if (
    !ENDINGS.some((ending) => ending === input.ending) ||
    !MASKS.some((mask) => mask === input.mask)
  )
    return null;
  const initials = input.initials.toUpperCase();
  return {
    submissionId: input.submissionId.toLowerCase(),
    initials: BLOCKED_INITIALS.has(initials) ? "???" : initials,
    score: input.score,
    ending: input.ending as ScoreSubmission["ending"],
    mask: input.mask as ScoreSubmission["mask"],
  };
}
