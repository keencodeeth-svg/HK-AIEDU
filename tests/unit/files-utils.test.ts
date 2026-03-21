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
  getFilesNoStoreRequestInit,
  groupCourseFilesByFolder,
  getFilesBootstrapRequestMessage,
  getFilesListRequestMessage,
  getFilesSubmitRequestMessage,
  isMissingFilesClassError,
  resolveFilesClassId,
  resolveFilesStateAfterMissingClass
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

test("files helpers remove stale class and preserve current fallback deterministically", () => {
  const classes = [{ id: "class-a" }, { id: "class-b" }, { id: "class-c" }];

  assert.deepEqual(resolveFilesStateAfterMissingClass(classes, "class-b", "class-b"), {
    nextClasses: [{ id: "class-a" }, { id: "class-c" }],
    nextClassId: "class-a"
  });

  assert.deepEqual(resolveFilesStateAfterMissingClass(classes, "class-b", "class-c"), {
    nextClasses: [{ id: "class-a" }, { id: "class-c" }],
    nextClassId: "class-c"
  });
});

test("files helpers group resources by trimmed folder name and default bucket", () => {
  assert.deepEqual(
    groupCourseFilesByFolder([
      {
        id: "1",
        classId: "class-a",
        folder: " 第一单元 ",
        title: "讲义",
        resourceType: "file",
        createdAt: "2026-03-19T12:00:00.000Z"
      },
      {
        id: "2",
        classId: "class-a",
        folder: "",
        title: "练习链接",
        resourceType: "link",
        createdAt: "2026-03-19T12:00:00.000Z"
      },
      {
        id: "3",
        classId: "class-a",
        title: "补充图片",
        resourceType: "file",
        createdAt: "2026-03-19T12:00:00.000Z"
      }
    ]),
    {
      第一单元: [
        {
          id: "1",
          classId: "class-a",
          folder: " 第一单元 ",
          title: "讲义",
          resourceType: "file",
          createdAt: "2026-03-19T12:00:00.000Z"
        }
      ],
      默认: [
        {
          id: "2",
          classId: "class-a",
          folder: "",
          title: "练习链接",
          resourceType: "link",
          createdAt: "2026-03-19T12:00:00.000Z"
        },
        {
          id: "3",
          classId: "class-a",
          title: "补充图片",
          resourceType: "file",
          createdAt: "2026-03-19T12:00:00.000Z"
        }
      ]
    }
  );
});

test("files helpers expose no-store request init for dynamic bootstrap and list loads", () => {
  assert.deepEqual(getFilesNoStoreRequestInit(), { cache: "no-store" });
});

test("files helpers return a fresh no-store request init object on each call", () => {
  const first = getFilesNoStoreRequestInit();
  const second = getFilesNoStoreRequestInit();

  assert.notEqual(first, second);
  assert.deepEqual(first, { cache: "no-store" });
  assert.deepEqual(second, { cache: "no-store" });
});
