import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";

type FilesClassLike = {
  id: string;
};

function getFilesRequestMessage(error: unknown) {
  return getRequestErrorMessage(error, "").trim().toLowerCase();
}

function getFilesBaseRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getFilesRequestMessage(error);

  if (status === 401 || status === 403) {
    return "登录状态已失效，请重新登录后继续查看课程文件。";
  }
  if (requestMessage === "class not found") {
    return "当前班级不存在，或你已失去该班级的资料访问权限。";
  }
  if (status === 404 && requestMessage === "not found") {
    return "当前资料不存在，或你已失去访问权限。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function getFilesBootstrapRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;

  if (status === 401 || status === 403) {
    return "登录状态已失效，请重新登录后继续进入课程文件中心。";
  }

  return getFilesBaseRequestMessage(error, fallback);
}

export function getFilesListRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;

  if (status === 401 || status === 403) {
    return "登录状态已失效，请重新登录后继续查看课程资料。";
  }

  return getFilesBaseRequestMessage(error, fallback);
}

export function getFilesSubmitRequestMessage(
  error: unknown,
  fallback: string,
  resourceType: "file" | "link"
) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getFilesRequestMessage(error);

  if (status === 401 || status === 403) {
    return resourceType === "link"
      ? "登录状态已失效，请重新登录后继续保存资料链接。"
      : "登录状态已失效，请重新登录后继续上传课程资料。";
  }
  if (requestMessage === "missing classid" || requestMessage === "missing fields") {
    return "请先选择班级并填写资料标题后再提交。";
  }
  if (requestMessage === "missing link") {
    return "请输入有效链接后再保存。";
  }
  if (requestMessage === "missing file") {
    return "请选择至少一个文件后再上传。";
  }
  if (requestMessage === "class not found") {
    return "当前班级不可用，请刷新班级列表后重新选择。";
  }
  if (requestMessage.startsWith("不支持的文件类型：")) {
    return "当前文件类型不支持，请上传 PDF、PNG、JPG 或 WEBP 文件。";
  }
  if (requestMessage.startsWith("单个文件不能超过")) {
    return getRequestErrorMessage(error, fallback);
  }

  return getFilesBaseRequestMessage(error, fallback);
}

export function isMissingFilesClassError(error: unknown) {
  return getFilesRequestMessage(error) === "class not found";
}

export function resolveFilesClassId(classes: FilesClassLike[], classId: string) {
  if (classId && classes.some((item) => item.id === classId)) {
    return classId;
  }

  return classes[0]?.id ?? "";
}
