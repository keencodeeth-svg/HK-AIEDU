import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import type {
  ModuleItem,
  ModuleResourceFileLike,
  ModuleResourcePayload,
  ModuleResourceType
} from "./types";

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

export function resolveTeacherModulesParentId(currentParentId: string, modules: Array<{ id: string }>) {
  if (currentParentId && modules.some((item) => item.id === currentParentId)) {
    return currentParentId;
  }
  return "";
}

export function removeTeacherModulesClassSnapshot<T extends { id: string }>(
  previousClasses: T[],
  staleClassId: string
) {
  const classes = previousClasses.filter((item) => item.id !== staleClassId);
  return {
    classes,
    classId: resolveTeacherModulesClassId("", classes)
  };
}

export function removeTeacherModulesModuleSnapshot<T extends { id: string }>(
  previousModules: T[],
  staleModuleId: string
) {
  const modules = previousModules.filter((item) => item.id !== staleModuleId);
  return {
    modules,
    moduleId: resolveTeacherModulesModuleId("", modules)
  };
}

export function getTeacherModulesResourceValidationMessage({
  title,
  resourceType,
  resourceUrl,
  resourceFile
}: {
  title: string;
  resourceType: ModuleResourceType;
  resourceUrl: string;
  resourceFile: ModuleResourceFileLike | null;
}) {
  if (!title) {
    return "请填写资源标题";
  }
  if (resourceType === "file" && !resourceFile) {
    return "请选择文件";
  }
  if (resourceType === "link" && !resourceUrl) {
    return "请输入资源链接";
  }
  return null;
}

export function buildTeacherModulesResourcePayload({
  title,
  resourceType,
  resourceUrl,
  resourceFile,
  contentBase64
}: {
  title: string;
  resourceType: ModuleResourceType;
  resourceUrl: string;
  resourceFile: ModuleResourceFileLike | null;
  contentBase64?: string;
}): ModuleResourcePayload {
  if (resourceType === "link") {
    return {
      title,
      resourceType,
      linkUrl: resourceUrl
    };
  }

  return {
    title,
    resourceType,
    fileName: resourceFile?.name,
    mimeType: resourceFile?.type || "application/octet-stream",
    size: resourceFile?.size,
    contentBase64
  };
}

export function resolveTeacherModulesSwapPair(
  modules: ModuleItem[],
  index: number,
  direction: "up" | "down"
) {
  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= modules.length) {
    return null;
  }

  return {
    current: modules[index]!,
    target: modules[nextIndex]!
  };
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
