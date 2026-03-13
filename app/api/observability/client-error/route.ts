import { getCurrentUser } from "@/lib/auth";
import { createLearningRoute } from "@/lib/api/domains";
import { v } from "@/lib/api/validation";
import { getErrorTrackingStatus, reportClientRenderError } from "@/lib/error-tracker";

const bodySchema = v.object<{
  component?: string;
  pathname?: string;
  message: string;
  stack?: string;
  digest?: string;
  traceId?: string;
}>(
  {
    component: v.optional(v.string({ maxLength: 120 })),
    pathname: v.optional(v.string({ maxLength: 240 })),
    message: v.string({ minLength: 1, maxLength: 400 }),
    stack: v.optional(v.string({ maxLength: 4000 })),
    digest: v.optional(v.string({ maxLength: 120 })),
    traceId: v.optional(v.string({ maxLength: 120 }))
  },
  { allowUnknown: false }
);

export const dynamic = "force-dynamic";

export const POST = createLearningRoute({
  sameOrigin: "always",
  cache: "private-realtime",
  body: bodySchema,
  handler: async ({ body, meta }) => {
    const currentUser = await getCurrentUser();
    const report = await reportClientRenderError({
      component: body.component,
      pathname: body.pathname,
      message: body.message,
      stack: body.stack,
      digest: body.digest,
      requestId: meta.requestId,
      traceId: body.traceId || meta.traceId,
      userId: currentUser?.id,
      userRole: currentUser?.role
    });

    return {
      data: {
        accepted: true,
        reported: report.reported,
        traceId: report.traceId ?? meta.traceId,
        reporter: getErrorTrackingStatus()
      }
    };
  }
});
