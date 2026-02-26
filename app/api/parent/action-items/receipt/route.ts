import { getCurrentUser } from "@/lib/auth";
import {
  listParentActionReceipts,
  upsertParentActionReceipt
} from "@/lib/parent-action-receipts";
import { badRequest, unauthorized, withApi } from "@/lib/api/http";
import { parseJson, parseSearchParams, v } from "@/lib/api/validation";

export const dynamic = "force-dynamic";

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
  return input === "assignment_plan" ? "assignment_plan" : "weekly_report";
}

function normalizeStatus(input?: string) {
  return input === "skipped" ? "skipped" : "done";
}

export const GET = withApi(async (request) => {
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
});

export const POST = withApi(async (request) => {
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
  const status = normalizeStatus(body.status);
  const estimatedMinutes = body.estimatedMinutes ?? 0;
  const effectScore = status === "done" ? Math.max(5, Math.min(30, Math.round(estimatedMinutes / 2))) : -5;

  const receipt = await upsertParentActionReceipt({
    parentId: user.id,
    studentId: user.studentId,
    source,
    actionItemId,
    status,
    note: body.note ?? undefined,
    estimatedMinutes,
    effectScore
  });

  return {
    data: receipt
  };
});
