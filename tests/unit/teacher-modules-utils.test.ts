import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

const Module = require("node:module") as {
  _resolveFilename: (request: string, parent?: unknown, isMain?: boolean, options?: unknown) => string;
};

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "@/lib/client-request") {
    return path.resolve(__dirname, "../../lib/client-request.js");
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const {
  buildTeacherModulesResourcePayload,
  getTeacherModulesRequestMessage,
  getTeacherModulesResourceValidationMessage,
  isMissingTeacherModulesClassError,
  isMissingTeacherModulesModuleError,
  removeTeacherModulesClassSnapshot,
  removeTeacherModulesModuleSnapshot,
  resolveTeacherModulesClassId,
  resolveTeacherModulesModuleId,
  resolveTeacherModulesParentId,
  resolveTeacherModulesSwapPair
} = require("../../app/teacher/modules/utils") as typeof import("../../app/teacher/modules/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("teacher modules helpers map auth and validation errors", () => {
  assert.equal(
    getTeacherModulesRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "教师登录状态已失效，请重新登录后继续管理课程模块。"
  );
  assert.equal(
    getTeacherModulesRequestMessage(createRequestError(400, "missing file"), "fallback"),
    "上传文件不能为空，请重新选择文件后再试。"
  );
  assert.equal(
    getTeacherModulesRequestMessage(createRequestError(400, "missing link"), "fallback"),
    "资源链接不能为空，请输入有效链接后再试。"
  );
});

test("teacher modules helpers distinguish missing class from missing module", () => {
  assert.equal(
    getTeacherModulesRequestMessage(createRequestError(404, "class not found"), "fallback"),
    "当前班级不存在，或你已失去该班级的模块管理权限。"
  );
  assert.equal(
    getTeacherModulesRequestMessage(createRequestError(404, "not found"), "fallback"),
    "所选模块不存在，可能已被删除或你已失去访问权限。"
  );
  assert.equal(isMissingTeacherModulesClassError(createRequestError(404, "class not found")), true);
  assert.equal(isMissingTeacherModulesModuleError(createRequestError(404, "not found")), true);
  assert.equal(isMissingTeacherModulesModuleError(createRequestError(400, "missing file")), false);
});

test("teacher modules helpers clear stale class and module selections", () => {
  const classes = [
    { id: "class-a" },
    { id: "class-b" }
  ];
  const modules = [
    { id: "module-a" },
    { id: "module-b" }
  ];

  assert.equal(resolveTeacherModulesClassId("class-b", classes), "class-b");
  assert.equal(resolveTeacherModulesClassId("missing-class", classes), "class-a");
  assert.equal(resolveTeacherModulesClassId("", []), "");
  assert.equal(resolveTeacherModulesModuleId("module-b", modules), "module-b");
  assert.equal(resolveTeacherModulesModuleId("missing-module", modules), "module-a");
  assert.equal(resolveTeacherModulesModuleId("", []), "");
  assert.equal(resolveTeacherModulesParentId("module-b", modules), "module-b");
  assert.equal(resolveTeacherModulesParentId("missing-module", modules), "");
  assert.equal(resolveTeacherModulesParentId("", modules), "");
  assert.deepEqual(removeTeacherModulesClassSnapshot(classes, "class-a"), {
    classes: [{ id: "class-b" }],
    classId: "class-b"
  });
  assert.deepEqual(removeTeacherModulesModuleSnapshot(modules, "module-a"), {
    modules: [{ id: "module-b" }],
    moduleId: "module-b"
  });
});

test("teacher modules helpers validate and build resource payloads deterministically", () => {
  assert.equal(
    getTeacherModulesResourceValidationMessage({
      title: "",
      resourceType: "file",
      resourceUrl: "",
      resourceFile: null
    }),
    "请填写资源标题"
  );
  assert.equal(
    getTeacherModulesResourceValidationMessage({
      title: "讲义",
      resourceType: "link",
      resourceUrl: "",
      resourceFile: null
    }),
    "请输入资源链接"
  );
  assert.deepEqual(
    buildTeacherModulesResourcePayload({
      title: "讲义 PDF",
      resourceType: "file",
      resourceUrl: "",
      resourceFile: {
        name: "lesson.pdf",
        type: "application/pdf",
        size: 1024
      },
      contentBase64: "ZmFrZQ=="
    }),
    {
      title: "讲义 PDF",
      resourceType: "file",
      fileName: "lesson.pdf",
      mimeType: "application/pdf",
      size: 1024,
      contentBase64: "ZmFrZQ=="
    }
  );
  assert.deepEqual(
    buildTeacherModulesResourcePayload({
      title: "外部链接",
      resourceType: "link",
      resourceUrl: "https://example.com",
      resourceFile: null
    }),
    {
      title: "外部链接",
      resourceType: "link",
      linkUrl: "https://example.com"
    }
  );
});

test("teacher modules helpers resolve sortable swap targets safely", () => {
  const modules = [
    { id: "module-a", title: "A", orderIndex: 1 },
    { id: "module-b", title: "B", orderIndex: 2 },
    { id: "module-c", title: "C", orderIndex: 3 }
  ];

  assert.deepEqual(resolveTeacherModulesSwapPair(modules, 1, "up"), {
    current: { id: "module-b", title: "B", orderIndex: 2 },
    target: { id: "module-a", title: "A", orderIndex: 1 }
  });
  assert.equal(resolveTeacherModulesSwapPair(modules, 0, "up"), null);
  assert.equal(resolveTeacherModulesSwapPair(modules, 2, "down"), null);
});
