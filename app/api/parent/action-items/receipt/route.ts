import { getCurrentUser } from "@/lib/auth";
import {
  listParentActionReceipts,
  upsertParentActionReceipt
} from "@/lib/parent-action-receipts";
import { badRequest, unauthorized } from "@/lib/api/http";
import { parseJson, parseSearchParams, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const bodySchema = v.object<{
  source?: string;
  actionItemId?: string;
  status?: string;
  note?: string;
  estimatedMinutes?: number;
}>(
  {
    source: v.optional(v.string({ minLength: 1 })),
    actionItemId: v.optional(v.string({ minLength: 1 })),
    status: v.optional(v.string({ minLength: 1 })),
    note: v.optional(v.string({ allowEmpty: true })),
    estimatedMinutes: v.optional(v.number({ integer: true, min: 0, max: 240, coerce: true }))
  },
  { allowUnknown: false }
);

const querySchema = v.object<{ source?: string }>(
  {
    source: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: true }
);

function normalizeSource(input?: string) {
  const value = (input ?? "weekly_report").trim();
  if (value === "weekly_report" || value === "assignment_plan") {
    return value;
  }
  badRequest("invalid source");
}

function normalizeStatus(input?: string) {
  const value = (input ?? "done").trim();
  if (value === "done" || value === "skipped") {
    return value;
  }
  badRequest("invalid status");
}

function isKnownActionItemId(source: "weekly_report" | "assignment_plan", actionItemId: string) {
  if (source === "weekly_report") {
    const weeklySet = new Set(["daily-practice", "keep-strength", "wrong-review", "advance-practice"]);
    if (weeklySet.has(actionItemId)) return true;
    return /^weak-[a-z0-9-]+$/i.test(actionItemId);
  }
  const assignmentSet = new Set([
    "clear-overdue",
    "due-soon",
    "daily-checklist",
    "review-today",
    "stable-rhythm"
  ]);
  return assignmentSet.has(actionItemId);
}

function calculateEffectScore(input: { status: "done" | "skipped"; estimatedMinutes: number }) {
  if (input.status === "done") {
    return Math.max(5, Math.min(30, Math.round(input.estimatedMinutes / 2)));
  }
  return -Math.max(3, Math.min(20, Math.round(input.estimatedMinutes / 4)));
}

export const GET = createLearningRoute({
  role: "parent",
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "parent") {
      unauthorized();
    }
    if (!user.studentId) {
      badRequest("missing student");
    }

    const query = parseSearchParams(request, querySchema);
    const source = query.source ? normalizeSource(query.source) : undefined;
    const receipts = await listParentActionReceipts({
      parentId: user.id,
      studentId: user.studentId,
      source
    });

    return {
      data: receipts
    };
  }
});

export const POST = createLearningRoute({
  role: "parent",
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "parent") {
      unauthorized();
    }
    if (!user.studentId) {
      badRequest("missing student");
    }

    const body = await parseJson(request, bodySchema);
    const actionItemId = body.actionItemId?.trim();
    if (!actionItemId) {
      badRequest("actionItemId required");
    }

    const source = normalizeSource(body.source);
    if (!isKnownActionItemId(source, actionItemId)) {
      badRequest("invalid actionItemId for source");
    }
    const status = normalizeStatus(body.status);
    const estimatedMinutes = body.estimatedMinutes ?? 0;
    const note = body.note?.trim() ?? "";
    if (status === "skipped" && note.length < 2) {
      badRequest("skipped status requires note");
    }
    const effectScore = calculateEffectScore({ status, estimatedMinutes });
    // Effect score is heuristic and intended for trend tracking, not grading.

    const receipt = await upsertParentActionReceipt({
      parentId: user.id,
      studentId: user.studentId,
      source,
      actionItemId,
      status,
      note: note || undefined,
      estimatedMinutes,
      effectScore
    });

    return {
      data: receipt
    };
  }
});
