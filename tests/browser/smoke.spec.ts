import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "Playwright123!";
const TEACHER_INVITE_CODE = "PW-TEACH-2026";

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

async function loginByApi(page: Page, params: { email: string; role: "student" | "parent" | "teacher" | "admin" }) {
  const result = await postJson(page, "/api/auth/login", {
    email: params.email,
    password: PASSWORD,
    role: params.role
  });
  expectApiOk(result, `${params.role} login failed`);
}

async function registerTeacherByApi(page: Page, params: { email: string; name: string }) {
  const result = await postJson(page, "/api/auth/teacher-register", {
    email: params.email,
    password: PASSWORD,
    name: params.name,
    inviteCode: TEACHER_INVITE_CODE
  });
  expectApiOk(result, "teacher registration failed");
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

async function createAssignment(page: Page, params: { classId: string; title: string }) {
  const dueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const result = await postJson(page, "/api/teacher/assignments", {
    classId: params.classId,
    title: params.title,
    dueDate,
    submissionType: "essay",
    maxUploads: 1,
    gradingFocus: "先确认是否按时完成，再看表达与步骤是否完整。"
  });
  expectApiOk(result, "assignment creation failed");
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
});
