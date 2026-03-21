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
  buildProfileFormState,
  buildProfileSavePayload,
  createInitialStudentProfileForm,
  getStudentObserverCodeRequestMessage,
  getStudentProfileRequestMessage,
  getStudentProfileSaveMessage,
  mergeSavedProfileForm,
  sanitizeHeightInput,
  toggleStudentProfileSubject
} = require("../../app/student/profile/utils") as typeof import("../../app/student/profile/utils");
Module._resolveFilename = originalResolveFilename;

function createRequestError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

test("student profile helpers map auth and required-field errors", () => {
  assert.equal(
    getStudentProfileRequestMessage(createRequestError(401, "unauthorized"), "fallback"),
    "学生登录状态已失效，请重新登录后继续维护资料。"
  );
  assert.equal(
    getStudentProfileRequestMessage(createRequestError(400, "missing fields"), "fallback"),
    "请先补全年级和关注学科后再保存。"
  );
  assert.equal(
    getStudentProfileRequestMessage(createRequestError(400, "body.heightCm must be <= 220"), "fallback"),
    "身高需填写 100 到 220 厘米之间的整数。"
  );
});

test("student profile helpers map observer-code auth and enum errors", () => {
  assert.equal(
    getStudentObserverCodeRequestMessage(createRequestError(403, "forbidden"), "fallback"),
    "学生登录状态已失效，请重新登录后继续查看家长绑定码。"
  );
  assert.equal(
    getStudentProfileRequestMessage(createRequestError(400, "body.seatPreference must be one of the allowed values"), "fallback"),
    "座位偏好选项无效，请重新选择。"
  );
  assert.equal(
    getStudentProfileRequestMessage(createRequestError(400, "body.peerSupport must be one of the allowed values"), "fallback"),
    "同桌协作选项无效，请重新选择。"
  );
});

test("student profile helpers build and merge form state deterministically", () => {
  assert.deepEqual(createInitialStudentProfileForm(), {
    grade: "4",
    subjects: ["math", "chinese", "english"],
    target: "",
    school: "",
    preferredName: "",
    gender: "",
    heightCm: "",
    eyesightLevel: "",
    seatPreference: "",
    personality: "",
    focusSupport: "",
    peerSupport: "",
    strengths: "",
    supportNotes: ""
  });

  assert.deepEqual(
    buildProfileFormState({
      grade: "5",
      subjects: ["math"],
      target: "提升口算",
      school: "实验小学",
      preferredName: "小明",
      gender: "male",
      heightCm: 138,
      eyesightLevel: "front_preferred",
      seatPreference: "front",
      personality: "active",
      focusSupport: "needs_focus",
      peerSupport: "needs_support",
      strengths: "口算快",
      supportNotes: "需要少量提醒"
    }),
    {
      grade: "5",
      subjects: ["math"],
      target: "提升口算",
      school: "实验小学",
      preferredName: "小明",
      gender: "male",
      heightCm: "138",
      eyesightLevel: "front_preferred",
      seatPreference: "front",
      personality: "active",
      focusSupport: "needs_focus",
      peerSupport: "needs_support",
      strengths: "口算快",
      supportNotes: "需要少量提醒"
    }
  );

  assert.deepEqual(
    mergeSavedProfileForm(
      createInitialStudentProfileForm(),
      {
        preferredName: "小明",
        gender: "male",
        heightCm: 138,
        eyesightLevel: "front_preferred",
        seatPreference: "front",
        personality: "active",
        focusSupport: "needs_focus",
        peerSupport: "needs_support",
        strengths: "口算快",
        supportNotes: "需要少量提醒"
      }
    ),
    {
      grade: "4",
      subjects: ["math", "chinese", "english"],
      target: "",
      school: "",
      preferredName: "小明",
      gender: "male",
      heightCm: "138",
      eyesightLevel: "front_preferred",
      seatPreference: "front",
      personality: "active",
      focusSupport: "needs_focus",
      peerSupport: "needs_support",
      strengths: "口算快",
      supportNotes: "需要少量提醒"
    }
  );
});

test("student profile helpers build save payloads and normalize input predictably", () => {
  assert.deepEqual(
    buildProfileSavePayload({
      grade: "5",
      subjects: ["math", "english"],
      target: "提升阅读",
      school: "实验小学",
      preferredName: "小明",
      gender: "",
      heightCm: " 138 ",
      eyesightLevel: "",
      seatPreference: "front",
      personality: "",
      focusSupport: "needs_focus",
      peerSupport: "",
      strengths: "表达好",
      supportNotes: "需要稳定提醒"
    }),
    {
      grade: "5",
      subjects: ["math", "english"],
      target: "提升阅读",
      school: "实验小学",
      preferredName: "小明",
      gender: null,
      heightCm: 138,
      eyesightLevel: null,
      seatPreference: "front",
      personality: null,
      focusSupport: "needs_focus",
      peerSupport: null,
      strengths: "表达好",
      supportNotes: "需要稳定提醒"
    }
  );

  assert.equal(sanitizeHeightInput("1a3b8cm"), "138");
  assert.deepEqual(toggleStudentProfileSubject(["math", "english"], "math"), ["english"]);
  assert.deepEqual(toggleStudentProfileSubject(["math", "english"], "chinese"), ["math", "english", "chinese"]);
});

test("student profile helpers resolve save feedback copy deterministically", () => {
  assert.equal(
    getStudentProfileSaveMessage("observer-123"),
    "已保存，老师端学期排座配置与个性化推荐会同步使用这些信息。"
  );
  assert.equal(
    getStudentProfileSaveMessage("", "ok"),
    "已保存，老师端学期排座配置与个性化推荐会同步使用这些信息。"
  );
  assert.equal(
    getStudentProfileSaveMessage("", "failed"),
    "已保存，但家长绑定码同步失败，请稍后重试。"
  );
  assert.equal(getStudentProfileSaveMessage("", "auth"), null);
});
