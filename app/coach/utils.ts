import type { CoachResponse } from "./types";

export const COACH_FIELD_STYLE = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid var(--stroke)"
} as const;

export function getCoachHintCount({
  response,
  revealAnswer,
  studentAnswer
}: {
  response: CoachResponse | null | undefined;
  revealAnswer?: boolean;
  studentAnswer: string;
}) {
  const hints = response?.hints ?? [];
  if (revealAnswer) {
    return hints.length;
  }
  return Math.min(studentAnswer.trim() ? 2 : 1, hints.length);
}
