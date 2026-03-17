import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import type {
  StudentModuleAssignment,
  StudentModuleAssignmentStatusMeta,
  StudentModuleStageCopy
} from "./types";

export function formatStudentModuleFileSize(size?: number) {
  if (!size || size <= 0) return "文件";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function getStudentModuleAssignmentStatusMeta(item: StudentModuleAssignment): StudentModuleAssignmentStatusMeta {
  const isCompleted = item.status === "completed";
  const isOverdue = !isCompleted && new Date(item.dueDate).getTime() < Date.now();
  if (isCompleted) {
    return { label: "已完成", tone: "done" };
  }
  if (isOverdue) {
    return { label: "待补交", tone: "overdue" };
  }
  return { label: "待完成", tone: "pending" };
}

export function getStudentModuleResourceTypeLabel(resourceType: "file" | "link") {
  return resourceType === "link" ? "链接资料" : "文件资料";
}

export function buildStudentModuleStageCopy(input: {
  loading: boolean;
  hasData: boolean;
  resourceCount: number;
  assignmentCount: number;
  pendingCount: number;
}): StudentModuleStageCopy {
  if (input.loading) {
    return {
      title: "正在加载模块详情",
      description: "系统正在同步该模块的资料、作业和学习进度，请稍等。"
    };
  }

  if (!input.hasData) {
    return {
      title: "模块信息暂不可用",
      description: "稍后刷新即可重新尝试拉取模块详情。"
    };
  }

  if (!input.resourceCount && !input.assignmentCount) {
    return {
      title: "这个模块还在准备中",
      description: "老师暂未上传资料或作业，后续内容补齐后，这里会自动更新。"
    };
  }

  if (input.pendingCount > 0) {
    return {
      title: `当前模块还有 ${input.pendingCount} 项任务待完成`,
      description: "建议先看资料再完成作业，模块内的学习资源和任务已经按同一上下文收拢。"
    };
  }

  return {
    title: "当前模块任务已完成",
    description: "你可以回顾资料、复习关键内容，或者返回模块列表进入下一单元。"
  };
}

export function getStudentModuleDetailRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();

  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续查看模块。";
  }
  if (status === 404 && requestMessage === "not found") {
    return "模块不存在，或你已失去对应班级的访问权限。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function isMissingStudentModuleDetailError(error: unknown) {
  return (getRequestStatus(error) ?? 0) === 404 && getRequestErrorMessage(error, "").trim().toLowerCase() === "not found";
}
