import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import type { StudentProfileFormState, StudentProfilePayload } from "./types";

export const INITIAL_FORM: StudentProfileFormState = {
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
};

export const studentProfileInputStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid var(--stroke)"
} as const;

export const studentProfileTextareaStyle = {
  ...studentProfileInputStyle,
  minHeight: 96,
  resize: "vertical" as const
};

export function createInitialStudentProfileForm(): StudentProfileFormState {
  return {
    ...INITIAL_FORM,
    subjects: [...INITIAL_FORM.subjects]
  };
}

export function buildProfileFormState(profile?: StudentProfilePayload | null): StudentProfileFormState {
  if (!profile) {
    return createInitialStudentProfileForm();
  }

  return {
    grade: profile.grade || INITIAL_FORM.grade,
    subjects: profile.subjects?.length ? [...profile.subjects] : [...INITIAL_FORM.subjects],
    target: profile.target ?? "",
    school: profile.school ?? "",
    preferredName: profile.preferredName ?? "",
    gender: profile.gender ?? "",
    heightCm: typeof profile.heightCm === "number" ? String(profile.heightCm) : "",
    eyesightLevel: profile.eyesightLevel ?? "",
    seatPreference: profile.seatPreference ?? "",
    personality: profile.personality ?? "",
    focusSupport: profile.focusSupport ?? "",
    peerSupport: profile.peerSupport ?? "",
    strengths: profile.strengths ?? "",
    supportNotes: profile.supportNotes ?? ""
  };
}

export function buildProfileSavePayload(form: StudentProfileFormState) {
  return {
    grade: form.grade,
    subjects: form.subjects,
    target: form.target,
    school: form.school,
    preferredName: form.preferredName,
    gender: form.gender || null,
    heightCm: form.heightCm.trim() ? Number(form.heightCm) : null,
    eyesightLevel: form.eyesightLevel || null,
    seatPreference: form.seatPreference || null,
    personality: form.personality || null,
    focusSupport: form.focusSupport || null,
    peerSupport: form.peerSupport || null,
    strengths: form.strengths,
    supportNotes: form.supportNotes
  };
}

export function mergeSavedProfileForm(
  currentForm: StudentProfileFormState,
  profile?: StudentProfilePayload | null
): StudentProfileFormState {
  if (!profile) {
    return currentForm;
  }

  return {
    ...currentForm,
    preferredName: profile.preferredName ?? currentForm.preferredName,
    gender: profile.gender ?? "",
    heightCm: typeof profile.heightCm === "number" ? String(profile.heightCm) : "",
    eyesightLevel: profile.eyesightLevel ?? "",
    seatPreference: profile.seatPreference ?? "",
    personality: profile.personality ?? "",
    focusSupport: profile.focusSupport ?? "",
    peerSupport: profile.peerSupport ?? "",
    strengths: profile.strengths ?? "",
    supportNotes: profile.supportNotes ?? ""
  };
}

export function sanitizeHeightInput(value: string) {
  return value.replace(/[^\d]/g, "");
}

export function toggleStudentProfileSubject(subjects: string[], subject: string) {
  return subjects.includes(subject)
    ? subjects.filter((item) => item !== subject)
    : [...subjects, subject];
}

export function getStudentProfileSaveMessage(
  observerCode: string,
  observerLoadResult?: "ok" | "failed" | "auth"
) {
  if (observerCode) {
    return "已保存，老师端学期排座配置与个性化推荐会同步使用这些信息。";
  }
  if (observerLoadResult === "ok") {
    return "已保存，老师端学期排座配置与个性化推荐会同步使用这些信息。";
  }
  if (observerLoadResult === "failed") {
    return "已保存，但家长绑定码同步失败，请稍后重试。";
  }
  return null;
}

export function getStudentProfileRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim();
  const lower = requestMessage.toLowerCase();

  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续维护资料。";
  }
  if (lower === "missing fields") {
    return "请先补全年级和关注学科后再保存。";
  }
  if (/^body\.grade /.test(lower)) {
    return "请选择年级。";
  }
  if (lower === "body.subjects must contain at least 1 items" || /^body\.subjects(\[\d+\])? /.test(lower)) {
    return "请至少选择一门学科。";
  }
  if (/^body\.heightcm /.test(lower)) {
    return "身高需填写 100 到 220 厘米之间的整数。";
  }
  if (/^body\.gender /.test(lower)) {
    return "性别选项无效，请重新选择。";
  }
  if (/^body\.eyesightlevel /.test(lower)) {
    return "视力偏好选项无效，请重新选择。";
  }
  if (/^body\.seatpreference /.test(lower)) {
    return "座位偏好选项无效，请重新选择。";
  }
  if (/^body\.personality /.test(lower)) {
    return "性格选项无效，请重新选择。";
  }
  if (/^body\.focussupport /.test(lower)) {
    return "专注支持选项无效，请重新选择。";
  }
  if (/^body\.peersupport /.test(lower)) {
    return "同桌协作选项无效，请重新选择。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function getStudentObserverCodeRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续查看家长绑定码。";
  }

  return getStudentProfileRequestMessage(error, fallback);
}
