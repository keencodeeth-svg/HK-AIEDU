import { createAuthRoute } from "@/lib/api/domains";
import { ApiError, apiSuccess, badRequest } from "@/lib/api/http";
import { parseJson, v } from "@/lib/api/validation";
import { createAccountRecoveryRequest } from "@/lib/account-recovery";

const recoveryRequestSchema = v.object<{
  role: "student" | "teacher" | "parent" | "admin" | "school_admin";
  email: string;
  name?: string;
  issueType: "forgot_password" | "forgot_account" | "account_locked";
  note?: string;
  studentEmail?: string;
  schoolName?: string;
}>(
  {
    role: v.enum(["student", "teacher", "parent", "admin", "school_admin"] as const),
    email: v.string({ allowEmpty: true }),
    name: v.optional(v.string({ allowEmpty: true })),
    issueType: v.enum(["forgot_password", "forgot_account", "account_locked"] as const),
    note: v.optional(v.string({ allowEmpty: true })),
    studentEmail: v.optional(v.string({ allowEmpty: true })),
    schoolName: v.optional(v.string({ allowEmpty: true }))
  },
  { allowUnknown: false }
);

export const POST = createAuthRoute({
  cache: "private-realtime",
  handler: async ({ request, meta }) => {
    const body = await parseJson(request, recoveryRequestSchema);
    if (!body.email.trim()) {
      badRequest("email required");
    }

    const result = await createAccountRecoveryRequest({
      role: body.role,
      email: body.email,
      name: body.name,
      issueType: body.issueType,
      note: body.note,
      studentEmail: body.studentEmail,
      schoolName: body.schoolName,
      requesterIp: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent")
    });

    if (result.rateLimited) {
      throw new ApiError(429, "恢复请求提交过于频繁，请稍后再试", {
        limitedBy: result.limitedBy,
        retryAt: result.retryAt,
        maxAttempts: result.maxAttempts,
        windowMinutes: result.windowMinutes
      });
    }

    return apiSuccess(
      {
        ok: true,
        ticketId: result.ticketId,
        submittedAt: result.submittedAt,
        duplicate: result.duplicate,
        serviceLevel: "1 个工作日内处理",
        nextSteps: [
          "保留请求编号，后续沟通时提供给管理员。",
          "如账号被临时锁定，也可稍后再试登录。",
          "密码恢复后，请使用新密码重新登录。"
        ]
      },
      {
        requestId: meta.requestId,
        message: result.duplicate
          ? "已收到相同恢复请求，请耐心等待处理。"
          : "如果账号信息匹配，我们已受理恢复请求。"
      }
    );
  }
});
