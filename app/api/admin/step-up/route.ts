import { getUserById, verifyPassword } from "@/lib/auth";
import { issueAdminStepUp } from "@/lib/admin-step-up";
import { addAdminLog } from "@/lib/admin-log";
import { apiSuccess, unauthorized } from "@/lib/api/http";
import { createAdminRoute } from "@/lib/api/domains";
import { v } from "@/lib/api/validation";

const bodySchema = v.object<{ password: string }>(
  {
    password: v.string({ minLength: 1 })
  },
  { allowUnknown: false }
);

export const POST = createAdminRoute({
  role: "admin",
  cache: "private-realtime",
  body: bodySchema,
  handler: async ({ body, user, meta }) => {
    if (!user || user.role !== "admin") {
      unauthorized();
    }

    const storedUser = await getUserById(user.id);
    if (!storedUser || storedUser.role !== "admin" || !verifyPassword(body.password, storedUser.password)) {
      unauthorized("current password incorrect");
    }

    const response = apiSuccess(
      { ok: true },
      {
        requestId: meta.requestId,
        message: "管理员二次验证已通过"
      }
    );
    const grant = issueAdminStepUp(response, user.id);

    await addAdminLog({
      adminId: user.id,
      action: "admin_step_up",
      entityType: "auth",
      entityId: user.id,
      detail: JSON.stringify({
        verifiedUntil: grant.expiresAt
      })
    });

    return response;
  }
});
