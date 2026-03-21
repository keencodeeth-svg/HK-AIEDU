import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "Playwright123!";

type ApiFailureRecord = {
  method: string;
  path: string;
  status: number;
  body: string | null;
};

type ExpectedApiFailure = {
  method?: string;
  path: string | RegExp;
  status: number;
  remaining: number;
};

const unexpectedApiFailuresByPage = new WeakMap<
  Page,
  {
    failures: ApiFailureRecord[];
    expectedFailures: ExpectedApiFailure[];
    pending: Set<Promise<void>>;
  }
>();

type ApiResult<T = unknown> = {
  ok: boolean;
  status: number;
  body: T;
};

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function postJson<T>(page: Page, url: string, body: unknown): Promise<ApiResult<T>> {
  return page.evaluate(
    async ({ nextUrl, nextBody }) => {
      const response = await fetch(nextUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-origin": window.location.origin
        },
        body: JSON.stringify(nextBody)
      });
      const payload = await response.json().catch(() => null);
      return {
        ok: response.ok,
        status: response.status,
        body: payload
      };
    },
    { nextUrl: url, nextBody: body }
  );
}

function expectApiOk(result: ApiResult, message: string) {
  expect(result.ok, `${message}: ${result.status} ${JSON.stringify(result.body)}`).toBe(true);
}

function formatUnexpectedApiFailures(failures: ApiFailureRecord[]) {
  return failures
    .map((failure) => {
      const body = failure.body ? ` ${failure.body}` : "";
      return `${failure.method} ${failure.path} -> ${failure.status}${body}`;
    })
    .join("\n");
}

function formatMissingExpectedApiFailures(failures: ExpectedApiFailure[]) {
  return failures
    .map((failure) => {
      const path = typeof failure.path === "string" ? failure.path : failure.path.toString();
      const method = failure.method ?? "*";
      return `${method} ${path} -> ${failure.status} (remaining: ${failure.remaining})`;
    })
    .join("\n");
}

function matchExpectedApiFailure(pathPattern: string | RegExp, actualPath: string) {
  if (typeof pathPattern === "string") {
    return pathPattern === actualPath;
  }

  pathPattern.lastIndex = 0;
  const matched = pathPattern.test(actualPath);
  pathPattern.lastIndex = 0;
  return matched;
}

function expectApiFailure(
  page: Page,
  failure: {
    method?: string;
    path: string | RegExp;
    status: number;
    count?: number;
  }
) {
  const state = unexpectedApiFailuresByPage.get(page);
  expect(state, "api failure tracker should be initialized in beforeEach").toBeTruthy();
  state?.expectedFailures.push({
    method: failure.method?.toUpperCase(),
    path: failure.path,
    status: failure.status,
    remaining: failure.count ?? 1
  });
}

async function registerStudent(page: Page, params: { email: string; name: string; grade?: string }) {
  const result = await postJson(page, "/api/auth/register", {
    role: "student",
    email: params.email,
    password: PASSWORD,
    name: params.name,
    grade: params.grade ?? "4"
  });
  expectApiOk(result, "student registration failed in local dev mode");
}

test.beforeEach(async ({ page, baseURL }) => {
  const baseOrigin = baseURL ? new URL(baseURL).origin : null;
  const state = {
    failures: [] as ApiFailureRecord[],
    expectedFailures: [] as ExpectedApiFailure[],
    pending: new Set<Promise<void>>()
  };
  unexpectedApiFailuresByPage.set(page, state);

  page.on("response", (response) => {
    const status = response.status();
    if (status < 400) {
      return;
    }

    const request = response.request();
    if (request.method() === "OPTIONS") {
      return;
    }

    let url: URL;
    try {
      url = new URL(response.url());
    } catch {
      return;
    }

    if (baseOrigin && url.origin !== baseOrigin) {
      return;
    }

    if (!url.pathname.startsWith("/api/")) {
      return;
    }

    const capture = (async () => {
      let body: string | null = null;
      try {
        const text = await response.text();
        body = text ? text.replace(/\s+/g, " ").trim().slice(0, 240) : null;
      } catch {
        body = null;
      }
      const failure = {
        method: request.method(),
        path: `${url.pathname}${url.search}`,
        status,
        body
      };

      const expectedFailure = state.expectedFailures.find(
        (candidate) =>
          candidate.remaining > 0 &&
          candidate.status === failure.status &&
          (!candidate.method || candidate.method === failure.method) &&
          matchExpectedApiFailure(candidate.path, failure.path)
      );

      if (expectedFailure) {
        expectedFailure.remaining -= 1;
        return;
      }

      state.failures.push(failure);
    })();

    state.pending.add(capture);
    void capture.finally(() => {
      state.pending.delete(capture);
    });
  });
});

test.afterEach(async ({ page }) => {
  const state = unexpectedApiFailuresByPage.get(page);
  if (!state) {
    return;
  }

  await Promise.all([...state.pending]);
  const missingExpectedFailures = state.expectedFailures.filter((failure) => failure.remaining > 0);
  expect(missingExpectedFailures, formatMissingExpectedApiFailures(missingExpectedFailures)).toEqual([]);
  expect(
    state.failures,
    formatUnexpectedApiFailures(state.failures)
  ).toEqual([]);
  unexpectedApiFailuresByPage.delete(page);
});

test("local dev demo login flow stays available without database", async ({ page }) => {
  await page.goto("/login?role=student");

  await expect(page.getByRole("heading", { name: "登录航科AI教育" })).toBeVisible();

  await page.getByRole("textbox", { name: "邮箱" }).fill("student@demo.com");
  await page.getByLabel("密码").fill("Student123");
  await page.getByRole("button", { name: "登录" }).click();

  await page.waitForURL("**/student");
  await expect(page).toHaveURL(/\/student$/);

  const me = await page.evaluate(async () => {
    const response = await fetch("/api/auth/me", {
      headers: {
        "x-test-origin": window.location.origin
      }
    });
    const payload = await response.json().catch(() => null);
    return {
      status: response.status,
      body: payload
    };
  });

  expect(me.status).toBe(200);
  expect(me.body?.user?.email ?? me.body?.data?.user?.email).toBe("student@demo.com");
});

test("local dev auth entry keeps lockout messaging and recovery handoff available without database", async ({
  page
}) => {
  const studentEmail = `${uniqueId("local-dev-lockout")}@local.test`;

  await page.goto("/login?role=student");
  await registerStudent(page, {
    email: studentEmail,
    name: "Local Dev Lockout Student"
  });

  await page.goto("/login?role=student");
  await page.getByLabel("邮箱").fill(studentEmail);

  expectApiFailure(page, {
    method: "POST",
    path: "/api/auth/login",
    status: 401,
    count: 4
  });
  expectApiFailure(page, {
    method: "POST",
    path: "/api/auth/login",
    status: 429,
    count: 2
  });

  const errorNote = page.locator(".status-note.error");
  const wrongPassword = "WrongPassword123!";

  for (const expectedMessage of [
    "邮箱或密码错误，还可再尝试 4 次。",
    "邮箱或密码错误，还可再尝试 3 次。",
    "邮箱或密码错误，还可再尝试 2 次。",
    "邮箱或密码错误，再错 1 次账号将被临时锁定。"
  ]) {
    await page.getByLabel("密码").fill(wrongPassword);
    await page.getByRole("button", { name: "登录" }).click();
    await expect(errorNote).toContainText(expectedMessage, { timeout: 15_000 });
  }

  await page.getByLabel("密码").fill(wrongPassword);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(errorNote).toContainText("登录失败次数过多，账号已临时锁定", { timeout: 15_000 });

  await page.getByLabel("密码").fill(PASSWORD);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(errorNote).toContainText("登录失败次数过多，账号已临时锁定", { timeout: 15_000 });

  await page.getByRole("link", { name: "去发起恢复请求" }).click();
  await page.waitForURL("**/recover");
  await expect(page.getByRole("heading", { name: "账号恢复" })).toBeVisible();

  await page.getByLabel("问题类型").selectOption("account_locked");
  await page.getByPlaceholder("请输入注册时使用的邮箱").fill(studentEmail);
  await page.getByPlaceholder("方便管理员快速核对").fill("Local Dev Lockout Student");
  await page.getByPlaceholder("例如：登录被锁定、换了设备、忘记使用哪个邮箱注册等").fill(
    "Playwright local-dev lockout recovery handoff."
  );
  await page.getByRole("button", { name: "提交恢复请求" }).click();

  await expect(page.getByText("恢复请求已受理")).toBeVisible({ timeout: 15_000 });
});
