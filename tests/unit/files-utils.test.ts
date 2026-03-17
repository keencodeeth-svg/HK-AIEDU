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
  getFilesBootstrapRequestMessage,
  getFilesListRequestMessage,
  getFilesSubmitRequestMessage,
  isMissingFilesClassError,
  resolveFilesClassId
} = require("../../app/files/utils") as typeof import("../../app/files/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("files helpers map auth, stale class, and upload validation errors", () => {
  assert.equal(
    getFilesBootstrapRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "登录状态已失效，请重新登录后继续进入课程文件中心。"
  );
  assert.equal(
    getFilesListRequestMessage(createRequestError(404, "class not found"), "fallback"),
    "当前班级不存在，或你已失去该班级的资料访问权限。"
  );
  assert.equal(
    getFilesSubmitRequestMessage(createRequestError(400, "missing file"), "fallback", "file"),
    "请选择至少一个文件后再上传。"
  );
  assert.equal(
    getFilesSubmitRequestMessage(createRequestError(400, "missing link"), "fallback", "link"),
    "请输入有效链接后再保存。"
  );
  assert.equal(
    getFilesSubmitRequestMessage(createRequestError(400, "不支持的文件类型：application/zip"), "fallback", "file"),
    "当前文件类型不支持，请上传 PDF、PNG、JPG 或 WEBP 文件。"
  );
  assert.equal(isMissingFilesClassError(createRequestError(404, "class not found")), true);
});

test("files helpers keep selected class only when it still exists", () => {
  const classes = [{ id: "class-a" }, { id: "class-b" }];

  assert.equal(resolveFilesClassId(classes, "class-b"), "class-b");
  assert.equal(resolveFilesClassId(classes, "missing-class"), "class-a");
  assert.equal(resolveFilesClassId([], "class-a"), "");
});
