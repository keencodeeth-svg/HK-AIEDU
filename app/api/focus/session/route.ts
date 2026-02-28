import { getCurrentUser } from "@/lib/auth";
import { addFocusSession } from "@/lib/focus";
import { badRequest, unauthorized } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

const focusSessionBodySchema = v.object<{
  durationMinutes?: number;
  mode?: "focus" | "break";
  startedAt?: string;
  endedAt?: string;
}>(
  {
    durationMinutes: v.optional(v.number({ coerce: true, integer: true, min: 0 })),
    mode: v.optional(v.enum(["focus", "break"] as const)),
    startedAt: v.optional(v.string({ allowEmpty: true, trim: false })),
    endedAt: v.optional(v.string({ allowEmpty: true, trim: false }))
  },
  { allowUnknown: false }
);

export const POST = createLearningRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      unauthorized();
    }

    const body = await parseJson(request, focusSessionBodySchema);

    const duration = Math.max(1, Math.min(Number(body.durationMinutes) || 0, 180));
    const mode = body.mode === "break" ? "break" : "focus";

    if (!duration) {
      badRequest("invalid duration");
    }

    const record = await addFocusSession({
      userId: user.id,
      mode,
      durationMinutes: duration,
      startedAt: body.startedAt,
      endedAt: body.endedAt
    });

    return { data: record };
  }
});
