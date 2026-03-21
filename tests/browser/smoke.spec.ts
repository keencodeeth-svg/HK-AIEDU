import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "Playwright123!";
const ADMIN_INVITE_CODE = "PW-ADMIN-2026";
const TEACHER_INVITE_CODE = "PW-TEACH-2026";

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

type SchoolSchedulesResponse = {
  data?: {
    sessions?: Array<{ id: string }>;
  };
};

type CurrentUserResponse = {
  user?: {
    id: string;
    role: "student" | "parent" | "teacher" | "admin" | "school_admin";
    schoolId?: string;
    email?: string;
    name?: string;
  } | null;
};

type StudentExamsResponse = {
  data?: Array<{
    id: string;
    status: "pending" | "in_progress" | "submitted";
    title: string;
  }>;
};

type LibraryListResponse = {
  data?: Array<{
    id: string;
    title: string;
    fileName?: string;
  }>;
};

type CourseFilesResponse = {
  data?: Array<{
    id: string;
    title: string;
    fileName?: string;
    folder?: string;
  }>;
};

type AnnouncementsResponse = {
  data?: Array<{
    id: string;
    classId: string;
    className?: string;
    title: string;
    content: string;
  }>;
};

type InboxThreadsResponse = {
  data?: Array<{
    id: string;
    subject: string;
    unreadCount: number;
    lastMessage?: {
      content: string;
      createdAt: string;
    } | null;
  }>;
};

type InboxThreadDetailResponse = {
  data?: {
    thread: {
      id: string;
      subject: string;
    };
    participants: Array<{
      id: string;
      name: string;
      role: string;
    }>;
    messages: Array<{
      id: string;
      senderId?: string;
      content: string;
      createdAt: string;
    }>;
  };
};

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function postJson<T>(page: Page, url: string, body: unknown): Promise<ApiResult<T>> {
  return page.evaluate(
    async ({ url: nextUrl, body: nextBody }) => {
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
    { url, body }
  );
}

async function getJson<T>(page: Page, url: string): Promise<ApiResult<T>> {
  return page.evaluate(async (nextUrl) => {
    const response = await fetch(nextUrl, {
      cache: "no-store",
      headers: {
        "x-test-origin": window.location.origin
      }
    });
    const payload = await response.json().catch(() => null);
    return {
      ok: response.ok,
      status: response.status,
      body: payload
    };
  }, url);
}

function expectApiOk(result: ApiResult, message: string) {
  expect(result.ok, `${message}: ${result.status} ${JSON.stringify(result.body)}`).toBe(true);
}

function expectApiError(result: ApiResult, expectedStatus: number, message: string) {
  expect(result.ok, `${message}: expected ${expectedStatus}, got ${result.status} ${JSON.stringify(result.body)}`).toBe(false);
  expect(result.status, `${message}: ${JSON.stringify(result.body)}`).toBe(expectedStatus);
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
  expect(state.failures, formatUnexpectedApiFailures(state.failures)).toEqual([]);
  unexpectedApiFailuresByPage.delete(page);
});

async function registerStudent(page: Page, params: { email: string; name: string; grade?: string }) {
  const result = await postJson(page, "/api/auth/register", {
    role: "student",
    email: params.email,
    password: PASSWORD,
    name: params.name,
    grade: params.grade ?? "4"
  });
  expectApiOk(result, "student registration failed");
}

async function registerParent(page: Page, params: { email: string; name: string; observerCode: string }) {
  const result = await postJson(page, "/api/auth/register", {
    role: "parent",
    email: params.email,
    password: PASSWORD,
    name: params.name,
    observerCode: params.observerCode
  });
  expectApiOk(result, "parent registration failed");
}

async function loginByApi(page: Page, params: { email: string; role: "student" | "parent" | "teacher" | "admin" | "school_admin" }) {
  const result = await postJson(page, "/api/auth/login", {
    email: params.email,
    password: PASSWORD,
    role: params.role
  });
  expectApiOk(result, `${params.role} login failed`);
}

async function registerSchoolAdminByApi(
  page: Page,
  params: { email: string; name: string; schoolName: string; schoolCode: string; inviteCode?: string }
) {
  const result = await postJson(page, "/api/auth/school-register", {
    email: params.email,
    password: PASSWORD,
    name: params.name,
    schoolName: params.schoolName,
    schoolCode: params.schoolCode,
    inviteCode: params.inviteCode ?? "PW-SCHOOL-2026"
  });
  expectApiOk(result, "school admin registration failed");
}

async function registerTeacherByApi(page: Page, params: { email: string; name: string; schoolCode?: string }) {
  const result = await postJson(page, "/api/auth/teacher-register", {
    email: params.email,
    password: PASSWORD,
    name: params.name,
    inviteCode: TEACHER_INVITE_CODE,
    schoolCode: params.schoolCode
  });
  expectApiOk(result, "teacher registration failed");
}

async function registerAdminByApi(page: Page, params: { email: string; name: string }) {
  const result = await postJson(page, "/api/auth/admin-register", {
    email: params.email,
    password: PASSWORD,
    name: params.name,
    inviteCode: ADMIN_INVITE_CODE
  });
  expectApiOk(result, "admin registration failed");
}

async function getCurrentUserByApi(page: Page) {
  const result = await getJson<CurrentUserResponse>(page, "/api/auth/me");
  expectApiOk(result, "current user fetch failed");
  const user = result.body?.user ?? null;
  expect(user, "current user should exist after authenticated setup").toBeTruthy();
  return user as NonNullable<CurrentUserResponse["user"]>;
}

async function getObserverCode(page: Page) {
  const result = await getJson<{ data?: { observerCode?: string } }>(page, "/api/student/profile");
  expectApiOk(result, "student profile fetch failed");
  const observerCode = result.body?.data?.observerCode;
  expect(observerCode, "observer code should exist after student profile bootstrap").toBeTruthy();
  return observerCode as string;
}

async function createClass(page: Page, params: { name: string; subject?: string; grade?: string }) {
  const result = await postJson<{ data?: { id?: string } }>(page, "/api/teacher/classes", {
    name: params.name,
    subject: params.subject ?? "math",
    grade: params.grade ?? "4"
  });
  expectApiOk(result, "class creation failed");
  const classId = result.body?.data?.id;
  expect(classId, "created class should expose id").toBeTruthy();
  return classId as string;
}

async function addStudentToClass(page: Page, params: { classId: string; email: string }) {
  const result = await postJson(page, `/api/teacher/classes/${params.classId}/students`, {
    email: params.email
  });
  expectApiOk(result, "adding student to class failed");
}

async function createAssignment(
  page: Page,
  params: {
    classId: string;
    title: string;
    submissionType?: "essay" | "upload";
    maxUploads?: number;
  }
) {
  const dueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const submissionType = params.submissionType ?? "essay";
  const result = await postJson<{ data?: { id?: string } }>(page, "/api/teacher/assignments", {
    classId: params.classId,
    title: params.title,
    dueDate,
    submissionType,
    maxUploads: params.maxUploads ?? 1,
    gradingFocus: "先确认是否按时完成，再看表达与步骤是否完整。"
  });
  expectApiOk(result, "assignment creation failed");
  const assignmentId = result.body?.data?.id;
  expect(assignmentId, "created assignment should expose id").toBeTruthy();
  return assignmentId as string;
}

async function createModule(
  page: Page,
  params: {
    classId: string;
    title: string;
    description?: string;
    orderIndex?: number;
  }
) {
  const result = await postJson<{ data?: { id?: string } }>(page, "/api/teacher/modules", {
    classId: params.classId,
    title: params.title,
    description: params.description ?? "",
    orderIndex: params.orderIndex ?? 0
  });
  expectApiOk(result, "module creation failed");
  const moduleId = result.body?.data?.id;
  expect(moduleId, "created module should expose id").toBeTruthy();
  return moduleId as string;
}

async function createExam(
  page: Page,
  params: {
    classId: string;
    title: string;
    studentIds?: string[];
    publishMode?: "teacher_assigned" | "targeted";
    antiCheatLevel?: "off" | "basic";
    questionCount?: number;
  }
) {
  const result = await postJson<{ data?: { id?: string } }>(page, "/api/teacher/exams", {
    classId: params.classId,
    title: params.title,
    publishMode: params.publishMode ?? "teacher_assigned",
    antiCheatLevel: params.antiCheatLevel ?? "off",
    studentIds: params.studentIds,
    endAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    questionCount: params.questionCount ?? 1
  });
  expectApiOk(result, "exam creation failed");
  const examId = result.body?.data?.id;
  expect(examId, "created exam should expose id").toBeTruthy();
  return examId as string;
}

async function createRecoveryRequest(
  page: Page,
  params: {
    role: "student" | "teacher" | "parent" | "admin" | "school_admin";
    email: string;
    issueType?: "forgot_password" | "forgot_account" | "account_locked";
    name?: string;
    note?: string;
  }
) {
  const result = await postJson(page, "/api/auth/recovery-request", {
    role: params.role,
    email: params.email,
    issueType: params.issueType ?? "forgot_password",
    name: params.name,
    note: params.note
  });
  expectApiOk(result, "recovery request creation failed");
}

async function getLibraryItemByTitle(page: Page, title: string) {
  const result = await getJson<LibraryListResponse>(
    page,
    `/api/library?keyword=${encodeURIComponent(title)}&page=1&pageSize=10`
  );
  expectApiOk(result, "library list fetch failed");
  const item = result.body?.data?.find((entry) => entry.title === title) ?? null;
  expect(item, "library item should exist after import").toBeTruthy();
  return item as NonNullable<LibraryListResponse["data"]>[number];
}

async function findLibraryItemIdByTitle(page: Page, title: string) {
  const result = await getJson<LibraryListResponse>(
    page,
    `/api/library?keyword=${encodeURIComponent(title)}&page=1&pageSize=10`
  );
  expectApiOk(result, "library list fetch failed while polling for imported item");
  return result.body?.data?.find((entry) => entry.title === title)?.id ?? "";
}

async function getSchoolScheduleSessionCount(page: Page) {
  const result = await getJson<SchoolSchedulesResponse>(page, "/api/school/schedules");
  expectApiOk(result, "school schedules fetch failed");
  return result.body?.data?.sessions?.length ?? 0;
}

test.describe("browser smoke", () => {
  test("student can log in and reach the execution-first dashboard", async ({ page }) => {
    const studentEmail = `${uniqueId("student")}@local.test`;

    await page.goto("/login?role=student");
    await registerStudent(page, {
      email: studentEmail,
      name: "Playwright Student"
    });

    await page.goto("/login?role=student");
    await page.getByLabel("邮箱").fill(studentEmail);
    await page.getByLabel("密码").fill(PASSWORD);
    await Promise.all([page.waitForURL("**/student"), page.getByRole("button", { name: "登录" }).click()]);

    await expect(page.getByRole("heading", { name: "学习控制台" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "现在直接开始" })).toBeVisible();
  });

  test("teacher can review class context and publish an assignment", async ({ page }) => {
    const studentEmail = `${uniqueId("class-student")}@local.test`;
    const teacherEmail = `${uniqueId("teacher")}@local.test`;
    const className = `PW Class ${uniqueId("grp")}`;
    const assignmentTitle = `PW Assignment ${uniqueId("asg")}`;
    await page.goto("/login");
    await registerStudent(page, {
      email: studentEmail,
      name: "Roster Student"
    });

    await page.goto("/login?role=teacher");
    await registerTeacherByApi(page, {
      email: teacherEmail,
      name: "Playwright Teacher"
    });
    await page.goto("/login?role=teacher");
    await page.getByLabel("邮箱").fill(teacherEmail);
    await page.getByLabel("密码").fill(PASSWORD);
    await Promise.all([page.waitForURL("**/teacher"), page.getByRole("button", { name: "登录" }).click()]);

    await expect(page.getByRole("button", { name: "刷新" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "教师工作台" })).toBeVisible();

    const classId = await createClass(page, {
      name: className
    });
    await page.reload();
    await expect(page.getByRole("button", { name: "刷新" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "教师工作台" })).toBeVisible();

    const classList = page.locator("#teacher-class-list");
    await expect(classList).toContainText(className, { timeout: 15_000 });

    await addStudentToClass(page, {
      classId,
      email: studentEmail
    });

    const assignmentCard = page.locator("#teacher-compose-assignment");
    await assignmentCard.getByLabel("作业标题").fill(assignmentTitle);
    await assignmentCard.getByLabel("截止日期").fill(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
    await assignmentCard.getByLabel("作业类型").selectOption("essay");
    await assignmentCard.getByLabel("最多上传").fill("1");
    await assignmentCard.getByRole("button", { name: "发布作业" }).click();

    await expect(page.locator("#teacher-assignment-list")).toContainText(assignmentTitle, { timeout: 15_000 });
    await expect(classList).toContainText("作业：1 份", { timeout: 15_000 });
  });

  test("parent can submit an assignment action receipt", async ({ page }) => {
    const studentEmail = `${uniqueId("receipt-student")}@local.test`;
    const teacherEmail = `${uniqueId("receipt-teacher")}@local.test`;
    const parentEmail = `${uniqueId("receipt-parent")}@local.test`;
    await page.goto("/login");
    await registerStudent(page, {
      email: studentEmail,
      name: "Receipt Student"
    });
    await loginByApi(page, {
      email: studentEmail,
      role: "student"
    });
    const observerCode = await getObserverCode(page);

    await page.goto("/register?role=parent");
    await registerParent(page, {
      email: parentEmail,
      name: "Receipt Parent",
      observerCode
    });

    await page.goto("/login?role=teacher");
    await registerTeacherByApi(page, {
      email: teacherEmail,
      name: "Receipt Teacher"
    });
    const classId = await createClass(page, {
      name: `PW Receipt Class ${uniqueId("cls")}`
    });
    await addStudentToClass(page, {
      classId,
      email: studentEmail
    });
    await createAssignment(page, {
      classId,
      title: `PW Receipt Assignment ${uniqueId("asg")}`
    });

    await page.goto("/login?role=parent");
    await page.getByLabel("邮箱").fill(parentEmail);
    await page.getByLabel("密码").fill(PASSWORD);
    await Promise.all([page.waitForURL("**/parent"), page.getByRole("button", { name: "登录" }).click()]);

    await expect(page.getByRole("heading", { name: "家长空间" })).toBeVisible();

    const firstActionItem = page.locator('[data-testid^="parent-action-item-assignment_plan-"]').first();
    await expect(firstActionItem).toBeVisible();

    const status = firstActionItem.locator('[data-testid^="parent-action-status-assignment_plan-"]');
    await expect(status).toContainText("未打卡");

    await firstActionItem.locator('[data-testid^="parent-action-done-assignment_plan-"]').click();

    await expect(status).toContainText("已打卡");
  });

  test("user can submit an account recovery request", async ({ page }) => {
    const studentEmail = `${uniqueId("recovery-student")}@local.test`;

    await page.goto("/register?role=student");
    await registerStudent(page, {
      email: studentEmail,
      name: "Recovery Student"
    });

    await page.goto("/recover");
    await expect(page.getByRole("heading", { name: "账号恢复" })).toBeVisible();

    await page.getByRole("textbox", { name: "注册邮箱" }).fill(studentEmail);
    await page.getByRole("textbox", { name: "姓名（建议填写）" }).fill("Recovery Student");
    await page
      .getByPlaceholder("例如：登录被锁定、换了设备、忘记使用哪个邮箱注册等")
      .fill("Playwright smoke: forgot password flow should create a recovery ticket.");
    await page.getByRole("button", { name: "提交恢复请求" }).click();

    await expect(page.getByText("恢复请求已受理", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("如果账号信息匹配，我们已受理恢复请求。")).toBeVisible();
    await expect(page.getByText(/请求编号：/)).toBeVisible();
    await expect(page.getByText(/服务时效：1 个工作日内处理/)).toBeVisible();
  });

  test("admin receives a security alert notification after suspicious login activity", async ({ page }) => {
    const adminEmail = `${uniqueId("admin-security")}@local.test`;

    await page.goto("/admin/register");
    await registerAdminByApi(page, {
      email: adminEmail,
      name: "Playwright Admin Alert"
    });

    await page.goto("/login?role=admin");
    await page.getByLabel("邮箱").fill(adminEmail);
    await page.getByLabel("密码").fill("WrongPassword123!");
    expectApiFailure(page, {
      method: "POST",
      path: "/api/auth/login",
      status: 401
    });
    await page.getByRole("button", { name: "登录" }).click();

    await expect(page.getByText(/邮箱或密码错误/)).toBeVisible({ timeout: 15_000 });

    await page.getByLabel("密码").fill(PASSWORD);
    await Promise.all([page.waitForURL("**/admin"), page.getByRole("button", { name: "登录" }).click()]);

    await page.goto("/notifications");
    await expect(page.getByRole("heading", { name: "通知中心" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("检测到异常登录").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/1 次失败尝试/).first()).toBeVisible({ timeout: 15_000 });
  });

  test("user sees a temporary lockout after repeated failed login attempts", async ({ page }) => {
    const studentEmail = `${uniqueId("student-lockout")}@local.test`;

    await page.goto("/register?role=student");
    await registerStudent(page, {
      email: studentEmail,
      name: "Lockout Student"
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
  });

  test("student can complete and submit a teacher-assigned exam", async ({ page }) => {
    const studentEmail = `${uniqueId("exam-student")}@local.test`;
    const teacherEmail = `${uniqueId("exam-teacher")}@local.test`;
    const className = `PW Exam Class ${uniqueId("cls")}`;
    const examTitle = `PW Exam ${uniqueId("exam")}`;

    await page.goto("/register?role=student");
    await registerStudent(page, {
      email: studentEmail,
      name: "Exam Student"
    });
    await loginByApi(page, {
      email: studentEmail,
      role: "student"
    });
    const studentUser = await getCurrentUserByApi(page);

    await page.goto("/login?role=teacher");
    await registerTeacherByApi(page, {
      email: teacherEmail,
      name: "Exam Teacher"
    });
    const classId = await createClass(page, {
      name: className
    });
    await addStudentToClass(page, {
      classId,
      email: studentEmail
    });
    const examId = await createExam(page, {
      classId,
      title: examTitle,
      publishMode: "targeted",
      studentIds: [studentUser.id],
      antiCheatLevel: "off",
      questionCount: 1
    });

    await page.goto("/login?role=student");
    await page.getByLabel("邮箱").fill(studentEmail);
    await page.getByLabel("密码").fill(PASSWORD);
    await Promise.all([page.waitForURL("**/student"), page.getByRole("button", { name: "登录" }).click()]);

    await page.goto(`/student/exams/${examId}`);
    await expect(page.getByRole("heading", { name: examTitle })).toBeVisible({ timeout: 15_000 });

    const questionCards = page.locator(".exam-question-card");
    const questionCount = await questionCards.count();
    expect(questionCount, "exam should include at least one question").toBeGreaterThan(0);
    for (let index = 0; index < questionCount; index += 1) {
      await questionCards.nth(index).getByRole("radio").first().check();
    }

    await page.getByRole("button", { name: "提交考试" }).click();
    await expect(page.getByText("考试已提交").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/你的成绩：\d+\/\d+/).first()).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () => {
        const result = await getJson<StudentExamsResponse>(page, "/api/student/exams");
        expectApiOk(result, "student exams fetch after exam submit failed");
        return result.body?.data?.find((item) => item.id === examId)?.status ?? null;
      }, {
        message: "student exam should be marked submitted after UI submit",
        timeout: 15_000
      })
      .toBe("submitted");

    await page.goto("/student/exams");
    await expect(page.getByRole("heading", { name: "在线考试" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /展开历史记录/ }).click();
    const examCard = page.locator(".exams-item-card", { hasText: examTitle }).first();
    await expect(examCard).toContainText("已提交");
  });

  test("student can upload assignment evidence and teacher can review/download it", async ({ page }) => {
    const studentEmail = `${uniqueId("assignment-upload-student")}@local.test`;
    const teacherEmail = `${uniqueId("assignment-upload-teacher")}@local.test`;
    const className = `PW Upload Class ${uniqueId("cls")}`;
    const assignmentTitle = `PW Upload Assignment ${uniqueId("asg")}`;
    const uploadFileName = `${assignmentTitle}.pdf`;
    const uploadBuffer = Buffer.from(
      "%PDF-1.4\n% Playwright assignment upload smoke\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF",
      "utf8"
    );

    await page.goto("/register?role=student");
    await registerStudent(page, {
      email: studentEmail,
      name: "Assignment Upload Student"
    });
    await loginByApi(page, {
      email: studentEmail,
      role: "student"
    });
    const studentUser = await getCurrentUserByApi(page);

    await page.goto("/login?role=teacher");
    await registerTeacherByApi(page, {
      email: teacherEmail,
      name: "Assignment Upload Teacher"
    });
    const classId = await createClass(page, {
      name: className
    });
    await addStudentToClass(page, {
      classId,
      email: studentEmail
    });
    const assignmentId = await createAssignment(page, {
      classId,
      title: assignmentTitle,
      submissionType: "upload",
      maxUploads: 1
    });

    await page.goto("/login?role=student");
    await page.getByLabel("邮箱").fill(studentEmail);
    await page.getByLabel("密码").fill(PASSWORD);
    await Promise.all([page.waitForURL("**/student"), page.getByRole("button", { name: "登录" }).click()]);

    await page.goto(`/student/assignments/${assignmentId}`);
    await expect(page.getByRole("heading", { name: "作业详情" })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("body")).toContainText(assignmentTitle);

    await page.locator('input[type="file"]').first().setInputFiles({
      name: uploadFileName,
      mimeType: "application/pdf",
      buffer: uploadBuffer
    });

    await expect(page.locator(".assignment-upload-card").first()).toContainText(uploadFileName, { timeout: 15_000 });
    await expect(page.locator("body")).toContainText("已上传 1/1 份", { timeout: 15_000 });

    await page.getByRole("button", { name: "提交作业" }).click();
    await expect(page.getByText("提交成功，已为你定位到下方结果与反馈区。")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("body")).toContainText("已提交作业", { timeout: 15_000 });
    await expect(page.locator("body")).toContainText(uploadFileName, { timeout: 15_000 });

    await page.goto("/login?role=teacher");
    await page.getByLabel("邮箱").fill(teacherEmail);
    await page.getByLabel("密码").fill(PASSWORD);
    await Promise.all([page.waitForURL("**/teacher"), page.getByRole("button", { name: "登录" }).click()]);

    await page.goto(`/teacher/assignments/${assignmentId}/reviews/${studentUser.id}`);
    await expect(page.getByRole("heading", { name: "作业批改" })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("body")).toContainText(uploadFileName, { timeout: 15_000 });

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "下载附件" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(uploadFileName);
  });

  test("teacher can upload a module resource and student can access it from module detail", async ({ page }) => {
    const studentEmail = `${uniqueId("module-resource-student")}@local.test`;
    const teacherEmail = `${uniqueId("module-resource-teacher")}@local.test`;
    const className = `PW Module Class ${uniqueId("cls")}`;
    const moduleTitle = `PW Module ${uniqueId("mod")}`;
    const resourceTitle = `PW Module Resource ${uniqueId("res")}`;
    const resourceFileName = `${resourceTitle}.pdf`;
    const resourceBuffer = Buffer.from(
      "%PDF-1.4\n% Playwright module resource smoke\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF",
      "utf8"
    );

    await page.goto("/register?role=student");
    await registerStudent(page, {
      email: studentEmail,
      name: "Module Resource Student"
    });

    await page.goto("/login?role=teacher");
    await registerTeacherByApi(page, {
      email: teacherEmail,
      name: "Module Resource Teacher"
    });
    const classId = await createClass(page, {
      name: className
    });
    await addStudentToClass(page, {
      classId,
      email: studentEmail
    });
    const moduleId = await createModule(page, {
      classId,
      title: moduleTitle,
      description: "Playwright module resource smoke."
    });

    await page.goto("/teacher/modules");
    await expect(page.getByRole("heading", { name: "课程模块管理" })).toBeVisible({ timeout: 15_000 });
    await page.getByLabel("班级").selectOption(classId);
    await expect(page.locator("body")).toContainText(moduleTitle, { timeout: 15_000 });

    await page.getByLabel("选择模块").selectOption(moduleId);
    await page.getByLabel("资源标题").fill(resourceTitle);
    await page.locator('input[type="file"]').first().setInputFiles({
      name: resourceFileName,
      mimeType: "application/pdf",
      buffer: resourceBuffer
    });
    await page.getByRole("button", { name: "添加资源" }).click();

    await expect(page.getByText("资源已添加").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("body")).toContainText(resourceTitle, { timeout: 15_000 });
    await expect(page.locator("body")).toContainText(resourceFileName, { timeout: 15_000 });

    await page.goto("/login?role=student");
    await page.getByLabel("邮箱").fill(studentEmail);
    await page.getByLabel("密码").fill(PASSWORD);
    await Promise.all([page.waitForURL("**/student"), page.getByRole("button", { name: "登录" }).click()]);

    await page.goto("/student/modules");
    await expect(page.getByRole("heading", { name: "课程模块" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "展开模块" }).first().click();

    const moduleCard = page.locator(".card", { hasText: moduleTitle }).first();
    await expect(moduleCard).toContainText(moduleTitle, { timeout: 15_000 });
    await moduleCard.getByRole("link", { name: "进入" }).click();

    await expect(page.getByRole("heading", { name: moduleTitle })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("body")).toContainText(resourceTitle, { timeout: 15_000 });
    await expect(page.locator("body")).toContainText(resourceFileName, { timeout: 15_000 });

    const downloadLink = page.getByRole("link", { name: "下载资料" }).first();
    await expect(downloadLink).toBeVisible({ timeout: 15_000 });
    await expect(downloadLink).toHaveAttribute("download", resourceFileName);
    const href = await downloadLink.getAttribute("href");
    expect(href, "module resource download href should exist").toBeTruthy();
    expect(href).toContain("data:application/pdf;base64,");
  });

  test("teacher can upload a course file and student can access it from files center", async ({ page }) => {
    const studentEmail = `${uniqueId("course-file-student")}@local.test`;
    const teacherEmail = `${uniqueId("course-file-teacher")}@local.test`;
    const className = `PW Course File Class ${uniqueId("cls")}`;
    const folderName = `第一单元/${uniqueId("folder")}`;
    const fileTitle = `PW Course File ${uniqueId("file")}`;
    const fileName = `${fileTitle}.pdf`;
    const fileBuffer = Buffer.from(
      "%PDF-1.4\n% Playwright course file smoke\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF",
      "utf8"
    );

    await page.goto("/register?role=student");
    await registerStudent(page, {
      email: studentEmail,
      name: "Course File Student"
    });

    await page.goto("/login?role=teacher");
    await registerTeacherByApi(page, {
      email: teacherEmail,
      name: "Course File Teacher"
    });
    const classId = await createClass(page, {
      name: className
    });
    await addStudentToClass(page, {
      classId,
      email: studentEmail
    });

    await page.goto("/files");
    await expect(page.getByRole("heading", { name: "课程文件中心" })).toBeVisible({ timeout: 15_000 });
    await page.getByLabel("选择班级").selectOption(classId);
    await page.getByLabel("文件夹（可选）").fill(folderName);
    await page.getByLabel("标题").fill(fileTitle);
    await page.getByLabel("选择文件").setInputFiles({
      name: fileName,
      mimeType: "application/pdf",
      buffer: fileBuffer
    });
    await page.getByRole("button", { name: "上传文件" }).click();

    await expect(page.getByText("文件已上传")).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => {
        const result = await getJson<CourseFilesResponse>(page, `/api/files?classId=${classId}`);
        return result.body?.data?.find((item) => item.title === fileTitle && item.fileName === fileName)?.fileName ?? null;
      }, {
        message: "teacher upload should become queryable from files API",
        timeout: 15_000
      })
      .toBe(fileName);

    await page.goto("/login?role=student");
    await page.getByLabel("邮箱").fill(studentEmail);
    await page.getByLabel("密码").fill(PASSWORD);
    await Promise.all([page.waitForURL("**/student"), page.getByRole("button", { name: "登录" }).click()]);

    await expect
      .poll(async () => {
        const result = await getJson<CourseFilesResponse>(page, `/api/files?classId=${classId}`);
        return result.body?.data?.find((item) => item.title === fileTitle)?.folder ?? null;
      }, {
        message: "student should be able to query uploaded course file",
        timeout: 15_000
      })
      .toBe(folderName);

    await page.goto("/files");
    await expect(page.getByRole("heading", { name: "课程文件中心" })).toBeVisible({ timeout: 15_000 });
    await page.getByLabel("选择班级").selectOption(classId);
    await expect(page.locator("body")).toContainText(folderName, { timeout: 15_000 });

    const fileCard = page.locator(".card", { hasText: fileTitle }).first();
    await expect(fileCard).toContainText(fileTitle, { timeout: 15_000 });

    const downloadLink = fileCard.getByRole("link", { name: "下载文件" });
    await expect(downloadLink).toBeVisible({ timeout: 15_000 });
    await expect(downloadLink).toHaveAttribute("download", fileName);
    const href = await downloadLink.getAttribute("href");
    expect(href, "course file download href should exist").toBeTruthy();
    expect(href).toContain("data:application/pdf;base64,");
  });

  test("teacher can publish an announcement and student can read it", async ({ page }) => {
    const studentEmail = `${uniqueId("announcement-student")}@local.test`;
    const teacherEmail = `${uniqueId("announcement-teacher")}@local.test`;
    const className = `PW Announcement Class ${uniqueId("cls")}`;
    const announcementTitle = `PW Announcement ${uniqueId("notice")}`;
    const announcementContent = `请完成公告回归验证：${uniqueId("content")}`;

    await page.goto("/register?role=student");
    await registerStudent(page, {
      email: studentEmail,
      name: "Announcement Student"
    });

    await page.goto("/login?role=teacher");
    await registerTeacherByApi(page, {
      email: teacherEmail,
      name: "Announcement Teacher"
    });
    const classId = await createClass(page, {
      name: className
    });
    await addStudentToClass(page, {
      classId,
      email: studentEmail
    });

    await page.goto("/announcements");
    await expect(page.getByRole("heading", { name: "班级公告" })).toBeVisible({ timeout: 15_000 });
    await page.getByLabel("选择班级").selectOption(classId);
    await page.getByLabel("公告标题").fill(announcementTitle);
    await page.getByLabel("公告内容").fill(announcementContent);
    await page.getByRole("button", { name: "发布公告" }).click();

    await expect(page.getByText("公告已发布").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".card", { hasText: announcementTitle }).first()).toContainText(
      announcementContent,
      { timeout: 15_000 }
    );

    await page.goto("/login?role=student");
    await page.getByLabel("邮箱").fill(studentEmail);
    await page.getByLabel("密码").fill(PASSWORD);
    await Promise.all([page.waitForURL("**/student"), page.getByRole("button", { name: "登录" }).click()]);

    await expect
      .poll(async () => {
        const result = await getJson<AnnouncementsResponse>(page, "/api/announcements");
        expectApiOk(result, "student announcements fetch failed");
        return (
          result.body?.data?.find(
            (item) =>
              item.classId === classId &&
              item.title === announcementTitle &&
              item.content === announcementContent
          )?.className ?? null
        );
      }, {
        message: "student should be able to query published announcement",
        timeout: 15_000
      })
      .toBe(className);

    await page.goto("/announcements");
    await expect(page.getByRole("heading", { name: "班级公告" })).toBeVisible({ timeout: 15_000 });

    const announcementCard = page.locator(".card", { hasText: announcementTitle }).first();
    await expect(announcementCard).toContainText(className, { timeout: 15_000 });
    await expect(announcementCard).toContainText(announcementContent, { timeout: 15_000 });
  });

  test("teacher can publish an announcement and parent can read it", async ({ page }) => {
    const studentEmail = `${uniqueId("announcement-parent-student")}@local.test`;
    const parentEmail = `${uniqueId("announcement-parent")}@local.test`;
    const teacherEmail = `${uniqueId("announcement-parent-teacher")}@local.test`;
    const className = `PW Parent Announcement Class ${uniqueId("cls")}`;
    const announcementTitle = `PW Parent Announcement ${uniqueId("notice")}`;
    const announcementContent = `请家长确认公告同步：${uniqueId("content")}`;

    await page.goto("/register?role=student");
    await registerStudent(page, {
      email: studentEmail,
      name: "Announcement Parent Student"
    });
    await loginByApi(page, {
      email: studentEmail,
      role: "student"
    });
    const observerCode = await getObserverCode(page);

    await page.goto("/register?role=parent");
    await registerParent(page, {
      email: parentEmail,
      name: "Announcement Parent",
      observerCode
    });

    await page.goto("/login?role=teacher");
    await registerTeacherByApi(page, {
      email: teacherEmail,
      name: "Announcement Parent Teacher"
    });
    const classId = await createClass(page, {
      name: className
    });
    await addStudentToClass(page, {
      classId,
      email: studentEmail
    });

    await page.goto("/announcements");
    await expect(page.getByRole("heading", { name: "班级公告" })).toBeVisible({ timeout: 15_000 });
    await page.getByLabel("选择班级").selectOption(classId);
    await page.getByLabel("公告标题").fill(announcementTitle);
    await page.getByLabel("公告内容").fill(announcementContent);
    await page.getByRole("button", { name: "发布公告" }).click();

    await expect(page.getByText("公告已发布").first()).toBeVisible({ timeout: 15_000 });

    await page.goto("/login?role=parent");
    await page.getByLabel("邮箱").fill(parentEmail);
    await page.getByLabel("密码").fill(PASSWORD);
    await Promise.all([page.waitForURL("**/parent"), page.getByRole("button", { name: "登录" }).click()]);

    await expect
      .poll(async () => {
        const result = await getJson<AnnouncementsResponse>(page, "/api/announcements");
        expectApiOk(result, "parent announcements fetch failed");
        return (
          result.body?.data?.find(
            (item) =>
              item.classId === classId &&
              item.title === announcementTitle &&
              item.content === announcementContent
          )?.className ?? null
        );
      }, {
        message: "parent should be able to query published announcement",
        timeout: 15_000
      })
      .toBe(className);

    await page.goto("/announcements");
    await expect(page.getByRole("heading", { name: "班级公告" })).toBeVisible({ timeout: 15_000 });

    const announcementCard = page.locator(".card", { hasText: announcementTitle }).first();
    await expect(announcementCard).toContainText(className, { timeout: 15_000 });
    await expect(announcementCard).toContainText(announcementContent, { timeout: 15_000 });
  });

  test("teacher can start an inbox thread and student can reply", async ({ page }) => {
    const studentEmail = `${uniqueId("inbox-student")}@local.test`;
    const teacherEmail = `${uniqueId("inbox-teacher")}@local.test`;
    const className = `PW Inbox Class ${uniqueId("cls")}`;
    const threadSubject = `PW Inbox Subject ${uniqueId("thread")}`;
    const teacherMessage = `请确认已收到课堂沟通：${uniqueId("teacher-msg")}`;
    const studentReply = `学生已收到并回复：${uniqueId("student-reply")}`;

    await page.goto("/register?role=student");
    await registerStudent(page, {
      email: studentEmail,
      name: "Inbox Student"
    });

    await page.goto("/login?role=teacher");
    await registerTeacherByApi(page, {
      email: teacherEmail,
      name: "Inbox Teacher"
    });
    const classId = await createClass(page, {
      name: className
    });
    await addStudentToClass(page, {
      classId,
      email: studentEmail
    });

    await page.goto("/inbox");
    await expect(page.getByRole("heading", { name: "收件箱" })).toBeVisible({ timeout: 15_000 });
    await page.getByLabel("选择班级").selectOption(classId);
    await page.getByLabel("主题").fill(threadSubject);
    await page.getByLabel("内容").fill(teacherMessage);
    await page.getByRole("button", { name: "发送消息" }).click();

    await expect(page.getByText("消息已发送").first()).toBeVisible({ timeout: 15_000 });

    let threadId = "";
    await expect
      .poll(async () => {
        const result = await getJson<InboxThreadsResponse>(page, "/api/inbox/threads");
        expectApiOk(result, "teacher inbox threads fetch failed");
        threadId = result.body?.data?.find((thread) => thread.subject === threadSubject)?.id ?? "";
        return threadId;
      }, {
        message: "teacher-created inbox thread should become queryable",
        timeout: 15_000
      })
      .not.toBe("");

    await page.goto("/login?role=student");
    await page.getByLabel("邮箱").fill(studentEmail);
    await page.getByLabel("密码").fill(PASSWORD);
    await Promise.all([page.waitForURL("**/student"), page.getByRole("button", { name: "登录" }).click()]);

    await expect
      .poll(async () => {
        const result = await getJson<InboxThreadsResponse>(page, "/api/inbox/threads");
        expectApiOk(result, "student inbox threads fetch failed");
        return result.body?.data?.find((thread) => thread.subject === threadSubject)?.unreadCount ?? null;
      }, {
        message: "student should see the teacher inbox thread as unread",
        timeout: 15_000
      })
      .toBeGreaterThan(0);

    await page.goto("/inbox");
    await expect(page.getByRole("heading", { name: "收件箱" })).toBeVisible({ timeout: 15_000 });
    const threadButton = page.locator(".inbox-thread-item", { hasText: threadSubject }).first();
    await expect(threadButton).toBeVisible({ timeout: 15_000 });
    await threadButton.click();

    await expect(page.locator(".inbox-message-list")).toContainText(teacherMessage, { timeout: 15_000 });
    await page.getByPlaceholder("输入回复...").fill(studentReply);
    await page.getByRole("button", { name: "发送回复" }).click();

    await expect(page.getByText("回复已发送").first()).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => {
        const result = await getJson<InboxThreadDetailResponse>(page, `/api/inbox/threads/${threadId}`);
        expectApiOk(result, "student inbox thread detail fetch failed");
        return result.body?.data?.messages?.some((message) => message.content === studentReply) ?? false;
      }, {
        message: "student reply should be persisted into inbox thread detail",
        timeout: 15_000
      })
      .toBe(true);

    await page.goto("/login?role=teacher");
    await page.getByLabel("邮箱").fill(teacherEmail);
    await page.getByLabel("密码").fill(PASSWORD);
    await Promise.all([page.waitForURL("**/teacher"), page.getByRole("button", { name: "登录" }).click()]);

    await expect
      .poll(async () => {
        const result = await getJson<InboxThreadDetailResponse>(page, `/api/inbox/threads/${threadId}`);
        expectApiOk(result, "teacher inbox thread detail fetch failed");
        return result.body?.data?.messages?.some((message) => message.content === studentReply) ?? false;
      }, {
        message: "teacher should be able to query the student reply",
        timeout: 15_000
      })
      .toBe(true);

    await page.goto("/inbox");
    await expect(page.getByRole("heading", { name: "收件箱" })).toBeVisible({ timeout: 15_000 });
    const teacherThreadButton = page.locator(".inbox-thread-item", { hasText: threadSubject }).first();
    await expect(teacherThreadButton).toBeVisible({ timeout: 15_000 });
    await teacherThreadButton.click();
    await expect(page.locator(".inbox-message-list")).toContainText(studentReply, { timeout: 15_000 });
  });

  test("teacher can start an inbox thread with parent copy and parent can reply", async ({ page }) => {
    const studentEmail = `${uniqueId("inbox-parent-student")}@local.test`;
    const parentEmail = `${uniqueId("inbox-parent")}@local.test`;
    const teacherEmail = `${uniqueId("inbox-parent-teacher")}@local.test`;
    const className = `PW Inbox Parent Class ${uniqueId("cls")}`;
    const threadSubject = `PW Parent Inbox Subject ${uniqueId("thread")}`;
    const teacherMessage = `请家长确认已收到沟通：${uniqueId("teacher-msg")}`;
    const parentReply = `家长已收到并回复：${uniqueId("parent-reply")}`;

    await page.goto("/register?role=student");
    await registerStudent(page, {
      email: studentEmail,
      name: "Inbox Parent Student"
    });
    await loginByApi(page, {
      email: studentEmail,
      role: "student"
    });
    const observerCode = await getObserverCode(page);

    await page.goto("/register?role=parent");
    await registerParent(page, {
      email: parentEmail,
      name: "Inbox Parent",
      observerCode
    });

    await page.goto("/login?role=teacher");
    await registerTeacherByApi(page, {
      email: teacherEmail,
      name: "Inbox Parent Teacher"
    });
    const classId = await createClass(page, {
      name: className
    });
    await addStudentToClass(page, {
      classId,
      email: studentEmail
    });

    await page.goto("/inbox");
    await expect(page.getByRole("heading", { name: "收件箱" })).toBeVisible({ timeout: 15_000 });
    await page.getByLabel("选择班级").selectOption(classId);
    await page.getByLabel("主题").fill(threadSubject);
    await page.getByLabel("内容").fill(teacherMessage);
    await page.getByLabel("同时抄送家长").check();
    await page.getByRole("button", { name: "发送消息" }).click();

    await expect(page.getByText("消息已发送").first()).toBeVisible({ timeout: 15_000 });

    let threadId = "";
    await expect
      .poll(async () => {
        const result = await getJson<InboxThreadsResponse>(page, "/api/inbox/threads");
        expectApiOk(result, "teacher inbox threads fetch for parent-copy flow failed");
        threadId = result.body?.data?.find((thread) => thread.subject === threadSubject)?.id ?? "";
        return threadId;
      }, {
        message: "teacher-created parent-copy inbox thread should become queryable",
        timeout: 15_000
      })
      .not.toBe("");

    await page.goto("/login?role=parent");
    await page.getByLabel("邮箱").fill(parentEmail);
    await page.getByLabel("密码").fill(PASSWORD);
    await Promise.all([page.waitForURL("**/parent"), page.getByRole("button", { name: "登录" }).click()]);

    await expect
      .poll(async () => {
        const result = await getJson<InboxThreadsResponse>(page, "/api/inbox/threads");
        expectApiOk(result, "parent inbox threads fetch failed");
        return result.body?.data?.find((thread) => thread.subject === threadSubject)?.unreadCount ?? null;
      }, {
        message: "parent should see the teacher inbox thread as unread",
        timeout: 15_000
      })
      .toBeGreaterThan(0);

    await page.goto("/inbox");
    await expect(page.getByRole("heading", { name: "收件箱" })).toBeVisible({ timeout: 15_000 });
    const parentThreadButton = page.locator(".inbox-thread-item", { hasText: threadSubject }).first();
    await expect(parentThreadButton).toBeVisible({ timeout: 15_000 });
    await parentThreadButton.click();

    await expect(page.locator(".inbox-message-list")).toContainText(teacherMessage, { timeout: 15_000 });
    await page.getByPlaceholder("输入回复...").fill(parentReply);
    await page.getByRole("button", { name: "发送回复" }).click();

    await expect(page.getByText("回复已发送").first()).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => {
        const result = await getJson<InboxThreadDetailResponse>(page, `/api/inbox/threads/${threadId}`);
        expectApiOk(result, "parent inbox thread detail fetch failed");
        return result.body?.data?.messages?.some((message) => message.content === parentReply) ?? false;
      }, {
        message: "parent reply should be persisted into inbox thread detail",
        timeout: 15_000
      })
      .toBe(true);

    await page.goto("/login?role=teacher");
    await page.getByLabel("邮箱").fill(teacherEmail);
    await page.getByLabel("密码").fill(PASSWORD);
    await Promise.all([page.waitForURL("**/teacher"), page.getByRole("button", { name: "登录" }).click()]);

    await expect
      .poll(async () => {
        const result = await getJson<InboxThreadDetailResponse>(page, `/api/inbox/threads/${threadId}`);
        expectApiOk(result, "teacher inbox thread detail fetch for parent reply failed");
        return result.body?.data?.messages?.some((message) => message.content === parentReply) ?? false;
      }, {
        message: "teacher should be able to query the parent reply",
        timeout: 15_000
      })
      .toBe(true);

    await page.goto("/inbox");
    await expect(page.getByRole("heading", { name: "收件箱" })).toBeVisible({ timeout: 15_000 });
    const teacherThreadButton = page.locator(".inbox-thread-item", { hasText: threadSubject }).first();
    await expect(teacherThreadButton).toBeVisible({ timeout: 15_000 });
    await teacherThreadButton.click();
    await expect(page.locator(".inbox-message-list")).toContainText(parentReply, { timeout: 15_000 });
  });

  test("admin can triage and resolve an account recovery request", async ({ page }) => {
    const adminEmail = `${uniqueId("recovery-admin")}@local.test`;
    const recoveryEmail = `${uniqueId("recovery-ticket")}@local.test`;

    await page.goto("/login");
    await createRecoveryRequest(page, {
      role: "student",
      email: recoveryEmail,
      name: "Recovery Ticket Student",
      note: "Playwright admin recovery triage smoke."
    });

    await page.goto("/admin/register");
    await registerAdminByApi(page, {
      email: adminEmail,
      name: "Playwright Recovery Admin"
    });
    await loginByApi(page, {
      email: adminEmail,
      role: "admin"
    });

    await page.goto("/admin/recovery-requests");
    await expect(page.getByRole("heading", { name: "账号恢复工单台" })).toBeVisible({ timeout: 15_000 });

    await page.getByPlaceholder("邮箱、姓名、学校、工单号").fill(recoveryEmail);
    await page.getByRole("button", { name: "搜索", exact: true }).click();
    const ticketButton = page.locator("button.card", { hasText: recoveryEmail }).first();
    await expect(ticketButton).toBeVisible({ timeout: 15_000 });
    await ticketButton.click();

    expectApiFailure(page, {
      method: "POST",
      path: /\/api\/admin\/recovery-requests\/.+/,
      status: 428
    });
    await page.getByRole("button", { name: "开始处理" }).click();

    const stepUpDialog = page.getByRole("dialog");
    await expect(stepUpDialog).toContainText("管理员二次验证");
    await stepUpDialog.getByPlaceholder("请输入当前登录密码").fill(PASSWORD);
    await stepUpDialog.getByRole("button", { name: "确认并继续" }).click();

    await expect(page.getByText("恢复工单已进入处理中。")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("body")).toContainText("处理中");

    await page.getByPlaceholder("记录核验结果、联系渠道、重置说明或驳回原因").fill("Playwright: account ownership verified and reset guidance sent.");
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "标记已解决" }).click();

    await expect(page.getByText("恢复工单已标记为已解决。")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("body")).toContainText("已解决");
  });

  test("admin can upload, download, and share a library file", async ({ page }) => {
    const adminEmail = `${uniqueId("library-admin")}@local.test`;
    const libraryTitle = `PW Library ${uniqueId("lib")}`;
    const fileName = `${libraryTitle}.txt`;
    const fileText = [
      "Playwright library smoke content.",
      "Uploaded file should remain downloadable and shareable."
    ].join("\n");

    await page.goto("/admin/register");
    await registerAdminByApi(page, {
      email: adminEmail,
      name: "Playwright Library Admin"
    });
    await loginByApi(page, {
      email: adminEmail,
      role: "admin"
    });

    await page.goto("/library");
    await expect(page.getByRole("heading", { name: "教材与课件资料库" })).toBeVisible({ timeout: 15_000 });

    await page.getByLabel("标题").fill(libraryTitle);
    await page.getByLabel("简介").fill("Playwright library upload smoke.");
    await page.locator('input[type="file"]').first().setInputFiles({
      name: fileName,
      mimeType: "text/plain",
      buffer: Buffer.from(fileText, "utf8")
    });

    expectApiFailure(page, {
      method: "POST",
      path: "/api/admin/library",
      status: 428
    });
    await page.getByRole("button", { name: "导入资料" }).click();

    const stepUpDialog = page.getByRole("dialog");
    await expect(stepUpDialog).toContainText("管理员二次验证");
    await stepUpDialog.getByPlaceholder("请输入当前登录密码").fill(PASSWORD);
    await stepUpDialog.getByRole("button", { name: "确认并继续" }).click();

    await expect(page.getByText("教材导入成功")).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () => findLibraryItemIdByTitle(page, libraryTitle), {
        message: "library item id should become queryable after upload",
        timeout: 15_000
      })
      .not.toBe("");
    const libraryId = (await getLibraryItemByTitle(page, libraryTitle)).id;

    await page.goto(`/library/${libraryId}`);
    await expect(page.getByRole("heading", { name: libraryTitle })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("body")).toContainText("Uploaded file should remain downloadable and shareable.");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "下载文件" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(fileName);

    await page.getByRole("button", { name: "生成分享链接" }).click();
    await expect(page.getByText("分享链接已生成")).toBeVisible({ timeout: 15_000 });
    const shareUrl = await page.getByRole("link", { name: "打开分享页" }).getAttribute("href");
    expect(shareUrl, "library share url should exist").toBeTruthy();
    expect(shareUrl).toContain("/library/shared/");

    const sharedPage = await page.context().newPage();
    await sharedPage.goto(shareUrl!);
    await expect(sharedPage.getByRole("heading", { name: libraryTitle })).toBeVisible({ timeout: 15_000 });
    await expect(sharedPage.locator("body")).toContainText("Uploaded file should remain downloadable and shareable.");
    await sharedPage.close();
  });

  test("school admin can preview, apply, and rollback AI schedule changes", async ({ page }) => {
    const schoolCode = `PWSC${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
    const schoolAdminEmail = `${uniqueId("school-admin")}@local.test`;
    const teacherEmail = `${uniqueId("school-teacher")}@local.test`;
    const className = `PW Schedule Class ${uniqueId("cls")}`;

    await page.goto("/school/register");
    await registerSchoolAdminByApi(page, {
      email: schoolAdminEmail,
      name: "Playwright School Admin",
      schoolName: `Playwright School ${schoolCode}`,
      schoolCode
    });

    await page.goto("/login?role=teacher");
    await registerTeacherByApi(page, {
      email: teacherEmail,
      name: "Playwright School Teacher",
      schoolCode
    });

    await createClass(page, {
      name: className
    });

    await loginByApi(page, {
      email: schoolAdminEmail,
      role: "school_admin"
    });

    await page.goto("/school/schedules");
    await expect(page.getByRole("heading", { name: "课程表管理" })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("div.section-title", { hasText: className }).first()).toBeVisible({ timeout: 15_000 });

    const initialSessionCount = await getSchoolScheduleSessionCount(page);
    const aiPanel = page.getByTestId("school-schedules-ai-panel");
    const previewButton = aiPanel.getByTestId("school-schedules-ai-preview");
    const applyButton = aiPanel.getByTestId("school-schedules-ai-apply");
    const rollbackButton = aiPanel.getByTestId("school-schedules-ai-rollback");

    await expect(previewButton).toBeEnabled();
    await previewButton.click();

    await expect(aiPanel.getByText("AI 预演完成", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(aiPanel.getByText(/预计新增 \d+ 个节次/)).toBeVisible({ timeout: 15_000 });
    await expect(applyButton).toBeEnabled();

    await applyButton.click();

    await expect(aiPanel.getByText("AI 排课已写入", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => getSchoolScheduleSessionCount(page), {
        message: "school schedule session count should increase after AI apply",
        timeout: 15_000
      })
      .toBeGreaterThan(initialSessionCount);
    const appliedSessionCount = await getSchoolScheduleSessionCount(page);

    await expect(rollbackButton).toBeEnabled();
    page.once("dialog", (dialog) => void dialog.accept());
    await rollbackButton.click();

    await expect(aiPanel.getByText(/已回滚最近一次 AI 排课/)).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => getSchoolScheduleSessionCount(page), {
        message: "school schedule session count should return to baseline after AI rollback",
        timeout: 15_000
      })
      .toBe(initialSessionCount);
    expect(appliedSessionCount).toBeGreaterThan(initialSessionCount);
  });

  test("school admin stays scoped to its own school classes", async ({ page }) => {
    const schoolCodeA = `PWSC${Date.now().toString(36)}A${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
    const schoolCodeB = `PWSC${Date.now().toString(36)}B${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
    const schoolAdminEmailA = `${uniqueId("school-admin-a")}@local.test`;
    const schoolAdminEmailB = `${uniqueId("school-admin-b")}@local.test`;
    const teacherEmailA = `${uniqueId("school-teacher-a")}@local.test`;
    const teacherEmailB = `${uniqueId("school-teacher-b")}@local.test`;
    const classNameA = `PW School A Class ${uniqueId("cls")}`;
    const classNameB = `PW School B Class ${uniqueId("cls")}`;

    await page.goto("/school/register");
    await registerSchoolAdminByApi(page, {
      email: schoolAdminEmailA,
      name: "Playwright School Admin A",
      schoolName: `Playwright School ${schoolCodeA}`,
      schoolCode: schoolCodeA
    });
    const schoolAdminA = await getCurrentUserByApi(page);
    expect(schoolAdminA.schoolId, "school admin A should be bound to a school").toBeTruthy();

    await page.goto("/login?role=teacher");
    await registerTeacherByApi(page, {
      email: teacherEmailA,
      name: "Playwright School Teacher A",
      schoolCode: schoolCodeA
    });
    await createClass(page, {
      name: classNameA
    });

    await page.goto("/school/register");
    await registerSchoolAdminByApi(page, {
      email: schoolAdminEmailB,
      name: "Playwright School Admin B",
      schoolName: `Playwright School ${schoolCodeB}`,
      schoolCode: schoolCodeB
    });
    const schoolAdminB = await getCurrentUserByApi(page);
    expect(schoolAdminB.schoolId, "school admin B should be bound to a school").toBeTruthy();
    expect(schoolAdminB.schoolId).not.toBe(schoolAdminA.schoolId);

    await page.goto("/login?role=teacher");
    await registerTeacherByApi(page, {
      email: teacherEmailB,
      name: "Playwright School Teacher B",
      schoolCode: schoolCodeB
    });
    await createClass(page, {
      name: classNameB
    });

    await loginByApi(page, {
      email: schoolAdminEmailA,
      role: "school_admin"
    });

    await page.goto("/school/classes");
    await expect(page.getByRole("heading", { name: "学校班级" })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("div.section-title", { hasText: classNameA }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("div.section-title", { hasText: classNameB })).toHaveCount(0);

    expectApiFailure(page, {
      method: "GET",
      path: `/api/school/classes?schoolId=${schoolAdminB.schoolId}`,
      status: 403
    });
    const crossSchoolClasses = await getJson(page, `/api/school/classes?schoolId=${schoolAdminB.schoolId}`);
    expectApiError(crossSchoolClasses, 403, "school admin should not reach another school's classes");
  });

  test("admin high-risk actions require step-up before saving", async ({ page }) => {
    const adminEmail = `${uniqueId("admin")}@local.test`;

    await page.goto("/admin/register");
    await registerAdminByApi(page, {
      email: adminEmail,
      name: "Playwright Admin"
    });
    await loginByApi(page, {
      email: adminEmail,
      role: "admin"
    });

    await page.goto("/admin/ai-models");
    await expect(page.getByRole("heading", { name: "AI 模型路由中心" })).toBeVisible();

    expectApiFailure(page, {
      method: "POST",
      path: "/api/admin/ai/config",
      status: 428
    });

    await page.getByRole("button", { name: "保存模型链" }).click();

    const stepUpDialog = page.getByRole("dialog");
    await expect(stepUpDialog).toContainText("管理员二次验证");
    await stepUpDialog.getByPlaceholder("请输入当前登录密码").fill(PASSWORD);
    await stepUpDialog.getByRole("button", { name: "确认并继续" }).click();

    await expect(stepUpDialog).toBeHidden();
    await expect(page.getByText("AI 模型链已保存")).toBeVisible({ timeout: 15_000 });
  });

  test("teacher session cannot overreach admin api routes", async ({ page }) => {
    const teacherEmail = `${uniqueId("teacher-admin-block")}@local.test`;

    await page.goto("/login?role=teacher");
    await registerTeacherByApi(page, {
      email: teacherEmail,
      name: "Playwright Teacher Guard"
    });
    await loginByApi(page, {
      email: teacherEmail,
      role: "teacher"
    });

    expectApiFailure(page, {
      method: "GET",
      path: "/api/admin/ai/config",
      status: 403
    });

    const result = await getJson(page, "/api/admin/ai/config");
    expectApiError(result, 403, "teacher should not reach admin ai config");
  });
});
