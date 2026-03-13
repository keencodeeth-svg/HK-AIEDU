import { createAdminRoute } from "@/lib/api/domains";
import { assertAdminStepUp } from "@/lib/admin-step-up";
import { badRequest, notFound, unauthorized } from "@/lib/api/http";
import { updateAccountRecoveryRequest, type AccountRecoveryRequestStatus } from "@/lib/account-recovery";
import { v } from "@/lib/api/validation";

export const dynamic = "force-dynamic";

const paramsSchema = v.object<{ id: string }>(
  {
    id: v.string({ minLength: 1 })
  },
  { allowUnknown: true }
);

const actionBodySchema = v.object<{
  status: AccountRecoveryRequestStatus;
  adminNote?: string;
  confirmAction?: boolean;
}>(
  {
    status: v.enum(["pending", "in_progress", "resolved", "rejected"] as const),
    adminNote: v.optional(v.string({ allowEmpty: true })),
    confirmAction: v.optional(v.boolean())
  },
  { allowUnknown: false }
);

function getActionMessage(status: AccountRecoveryRequestStatus) {
  if (status === "pending") return "恢复工单已重新打开。";
  if (status === "in_progress") return "恢复工单已进入处理中。";
  if (status === "resolved") return "恢复工单已标记为已解决。";
  return "恢复工单已标记为无法核验。";
}

export const POST = createAdminRoute({
  role: "admin",
  cache: "private-realtime",
  params: paramsSchema,
  body: actionBodySchema,
  handler: async ({ params, body, user }) => {
    if (!user) {
      unauthorized();
    }
    assertAdminStepUp(user);
    if ((body.status === "resolved" || body.status === "rejected") && !body.confirmAction) {
      badRequest("confirmAction required");
    }
    if ((body.status === "resolved" || body.status === "rejected") && !body.adminNote?.trim()) {
      badRequest("adminNote required");
    }

    const item = await updateAccountRecoveryRequest({
      id: params.id,
      status: body.status,
      adminId: user.id,
      adminNote: body.adminNote
    });

    if (!item) {
      notFound("recovery request not found");
    }

    return {
      data: item,
      message: getActionMessage(body.status)
    };
  }
});
