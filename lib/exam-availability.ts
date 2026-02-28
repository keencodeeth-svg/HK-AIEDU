export type ExamAvailabilityStage = "upcoming" | "open" | "ended" | "closed";

type ResolveExamAvailabilityInput = {
  status: "published" | "closed";
  startAt?: string;
  endAt: string;
};

function toTimestamp(value: string | undefined) {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
}

export function resolveExamAvailability(
  input: ResolveExamAvailabilityInput,
  nowMs: number = Date.now()
) {
  const startAtMs = toTimestamp(input.startAt);
  const endAtMs = toTimestamp(input.endAt);

  if (input.status === "closed") {
    return {
      stage: "closed" as ExamAvailabilityStage,
      canEnter: false,
      canSubmit: false,
      lockReason: "考试已关闭",
      startsInMs: startAtMs !== null ? Math.max(0, startAtMs - nowMs) : 0,
      endsInMs: endAtMs !== null ? Math.max(0, endAtMs - nowMs) : 0
    };
  }

  if (startAtMs !== null && startAtMs > nowMs) {
    return {
      stage: "upcoming" as ExamAvailabilityStage,
      canEnter: false,
      canSubmit: false,
      lockReason: "考试尚未开始",
      startsInMs: startAtMs - nowMs,
      endsInMs: endAtMs !== null ? Math.max(0, endAtMs - nowMs) : 0
    };
  }

  if (endAtMs !== null && endAtMs <= nowMs) {
    return {
      stage: "ended" as ExamAvailabilityStage,
      canEnter: false,
      canSubmit: false,
      lockReason: "考试已截止",
      startsInMs: startAtMs !== null ? Math.max(0, startAtMs - nowMs) : 0,
      endsInMs: 0
    };
  }

  return {
    stage: "open" as ExamAvailabilityStage,
    canEnter: true,
    canSubmit: true,
    lockReason: null,
    startsInMs: startAtMs !== null ? Math.max(0, startAtMs - nowMs) : 0,
    endsInMs: endAtMs !== null ? Math.max(0, endAtMs - nowMs) : 0
  };
}
