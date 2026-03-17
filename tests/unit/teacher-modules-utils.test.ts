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
  getTeacherModulesRequestMessage,
  isMissingTeacherModulesClassError,
  isMissingTeacherModulesModuleError,
  resolveTeacherModulesClassId,
  resolveTeacherModulesModuleId
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
});
