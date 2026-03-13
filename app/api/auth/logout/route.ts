import { cookies } from "next/headers";
import { clearSessionCookie, getSessionCookieName, removeSession } from "@/lib/auth";
import { clearAdminStepUpCookie } from "@/lib/admin-step-up";
import { apiSuccess } from "@/lib/api/http";
import { createAuthRoute } from "@/lib/api/domains";

export const POST = createAuthRoute({
  sameOrigin: "always",
  cache: "private-realtime",
  handler: async ({ meta }) => {
    const cookieStore = cookies();
    const token = cookieStore.get(getSessionCookieName())?.value;
    if (token) {
      await removeSession(token);
    }

    const response = apiSuccess(
      { ok: true },
      {
        requestId: meta.requestId,
        message: "已退出登录"
      }
    );
    clearAdminStepUpCookie(response);
    clearSessionCookie(response);
    return response;
  }
});
