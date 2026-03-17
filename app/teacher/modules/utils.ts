import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";

export function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result?.toString() ?? "";
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("file read failed"));
    reader.readAsDataURL(file);
  });
}

export function resolveTeacherModulesClassId(currentClassId: string, classes: Array<{ id: string }>) {
  if (currentClassId && classes.some((item) => item.id === currentClassId)) {
    return currentClassId;
  }
  return classes[0]?.id ?? "";
}

export function resolveTeacherModulesModuleId(currentModuleId: string, modules: Array<{ id: string }>) {
  if (currentModuleId && modules.some((item) => item.id === currentModuleId)) {
    return currentModuleId;
  }
  return modules[0]?.id ?? "";
}

export function isMissingTeacherModulesClassError(error: unknown) {
  return getRequestErrorMessage(error, "").trim().toLowerCase() === "class not found";
}

export function isMissingTeacherModulesModuleError(error: unknown) {
  return (getRequestStatus(error) ?? 0) === 404 && getRequestErrorMessage(error, "").trim().toLowerCase() === "not found";
}

export function getTeacherModulesRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim();
  const lower = requestMessage.toLowerCase();

  if (status === 401 || status === 403) {
    return "教师登录状态已失效，请重新登录后继续管理课程模块。";
  }
  if (isMissingTeacherModulesClassError(error)) {
    return "当前班级不存在，或你已失去该班级的模块管理权限。";
  }
  if (isMissingTeacherModulesModuleError(error)) {
    return "所选模块不存在，可能已被删除或你已失去访问权限。";
  }
  if (lower === "missing file") {
    return "上传文件不能为空，请重新选择文件后再试。";
  }
  if (lower === "missing link") {
    return "资源链接不能为空，请输入有效链接后再试。";
  }

  return getRequestErrorMessage(error, fallback);
}
