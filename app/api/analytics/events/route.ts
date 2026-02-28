import { getCurrentUser } from "@/lib/auth";
import { badRequest } from "@/lib/api/http";
import {
  type AnalyticsEventRecord,
  appendAnalyticsEvents,
  buildAnalyticsContext,
  buildAnalyticsEvent,
  normalizeBatchInput
} from "@/lib/analytics";
import { createLearningRoute } from "@/lib/api/domains";

export const POST = createLearningRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const rawBody = (await request.json().catch(() => null)) as unknown;
    if (!rawBody) {
      badRequest("invalid json body");
    }

    const normalized = normalizeBatchInput(rawBody);
    if (!normalized.ok) {
      badRequest(normalized.error);
    }

    const user = await getCurrentUser();
    const context = buildAnalyticsContext({
      userId: user?.id ?? null,
      role: user?.role ?? null,
      userAgent: request.headers.get("user-agent"),
      forwardedFor: request.headers.get("x-forwarded-for")
    });

    const events: AnalyticsEventRecord[] = [];
    const droppedReasons: string[] = [];
    let propsTruncated = 0;

    for (const rawEvent of normalized.events) {
      const built = buildAnalyticsEvent(rawEvent, context);
      if (!built.ok) {
        droppedReasons.push(built.reason);
        continue;
      }
      if (built.propsTruncated) {
        propsTruncated += 1;
      }
      events.push(built.event);
    }

    await appendAnalyticsEvents(events);

    return {
      accepted: events.length,
      dropped: droppedReasons.length,
      propsTruncated
    };
  }
});
