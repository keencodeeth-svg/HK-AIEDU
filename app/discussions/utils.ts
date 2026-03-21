import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import type {
  ClassItem,
  CurrentUser,
  DiscussionLoadStatus,
  DiscussionStageCopy,
  DiscussionsDerivedState,
  Topic
} from "./types";

type DiscussionStageCopyInput = {
  loading: boolean;
  classesCount: number;
  topicsCount: number;
  activeTopic: Topic | null;
  teacherMode: boolean;
  role?: string;
};

export function truncateDiscussionText(value: string, maxLength = 88) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}…`;
}

export function getDiscussionPerspectiveLabel(role?: string) {
  if (role === "teacher") {
    return "教师视角";
  }
  if (role === "parent") {
    return "家长视角";
  }
  return "学生视角";
}

export function getDiscussionStageCopy({
  loading,
  classesCount,
  topicsCount,
  activeTopic,
  teacherMode
}: DiscussionStageCopyInput): DiscussionStageCopy {
  if (loading) {
    return {
      title: "正在加载班级讨论区",
      description: "系统正在同步你的班级、话题与回复记录，请稍等。"
    };
  }

  if (!classesCount) {
    return teacherMode
      ? {
          title: "先绑定班级，再发起课堂讨论",
          description: "建立授课班级后，这里会自动开放发布话题、收集回复和班级讨论沉淀。"
        }
      : {
          title: "当前暂无可参与的班级讨论",
          description: "加入班级或等待老师发布讨论后，这里会自动出现可参与的话题。"
        };
  }

  if (activeTopic) {
    return {
      title: `正在查看「${activeTopic.title}」`,
      description: teacherMode
        ? "你可以继续补充教师引导、查看学生回复，或快速发布一个新的置顶话题。"
        : "你可以先读完老师发起的话题，再在下方直接回复，形成完整讨论闭环。"
    };
  }

  if (topicsCount) {
    return {
      title: `当前班级已有 ${topicsCount} 个讨论话题`,
      description: "可以通过关键词或置顶筛选快速定位，选择后会在右侧展开完整讨论详情。"
    };
  }

  return teacherMode
    ? {
        title: "当前班级还没有讨论话题",
        description: "建议先发布一个明确的问题或任务，引导学生围绕课堂重点展开交流。"
      }
      : {
        title: "老师暂时还没有发布话题",
        description: "等老师发起讨论后，你可以在这里查看说明、参与回复并回顾讨论记录。"
      };
}

function getDiscussionRequestMessage(error: unknown) {
  return getRequestErrorMessage(error, "").trim().toLowerCase();
}

function getDiscussionBaseRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;

  if (status === 401 || status === 403) {
    return "登录状态已失效，请重新登录后继续查看班级讨论。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function getDiscussionTopicDetailRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getDiscussionRequestMessage(error);

  if (status === 404 && requestMessage === "not found") {
    return "该话题不存在，或你当前无权查看这个班级的讨论。";
  }

  return getDiscussionBaseRequestMessage(error, fallback);
}

export function getDiscussionTopicListRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getDiscussionRequestMessage(error);

  if (requestMessage === "class not found" || (status === 404 && requestMessage === "not found")) {
    return "当前班级讨论不可用，可能已被移除或你已失去访问权限。";
  }

  return getDiscussionBaseRequestMessage(error, fallback);
}

export function getDiscussionCreateRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getDiscussionRequestMessage(error);

  if (status === 401 || status === 403) {
    return "登录状态已失效，请重新登录后继续发布讨论。";
  }
  if (requestMessage === "missing fields") {
    return "请先补全班级、标题和话题内容。";
  }
  if (requestMessage === "class not found" || (status === 404 && requestMessage === "not found")) {
    return "当前班级不可用，请刷新班级列表后重新选择可发布的班级。";
  }

  return getDiscussionBaseRequestMessage(error, fallback);
}

export function getDiscussionReplyRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getDiscussionRequestMessage(error);

  if (status === 401 || status === 403) {
    return "登录状态已失效，请重新登录后继续回复讨论。";
  }
  if (requestMessage === "missing content") {
    return "请输入回复内容后再发送。";
  }
  if (status === 404 && requestMessage === "not found") {
    return "该话题已不存在，或你当前无权继续回复。";
  }

  return getDiscussionBaseRequestMessage(error, fallback);
}

export function isMissingDiscussionTopicError(error: unknown) {
  return (getRequestStatus(error) ?? 0) === 404 && getDiscussionRequestMessage(error) === "not found";
}

export function isMissingDiscussionClassError(error: unknown) {
  return getDiscussionRequestMessage(error) === "class not found";
}

export function getDiscussionNoStoreRequestInit(): RequestInit {
  return { cache: "no-store" };
}

export function resolveDiscussionsClassId(classes: ClassItem[], classId: string) {
  if (classId && classes.some((item) => item.id === classId)) {
    return classId;
  }
  return classes[0]?.id ?? "";
}

export function resolveDiscussionTopicId(
  topics: Topic[],
  ...candidates: Array<string | null | undefined>
) {
  for (const candidate of candidates) {
    if (candidate && topics.some((topic) => topic.id === candidate)) {
      return candidate;
    }
  }
  return topics[0]?.id ?? "";
}

export function filterDiscussionTopics(topics: Topic[], keyword: string, pinnedOnly: boolean) {
  const needle = keyword.trim().toLowerCase();
  return topics.filter((topic) => {
    if (pinnedOnly && !topic.pinned) {
      return false;
    }
    if (!needle) {
      return true;
    }
    return [topic.title, topic.content, topic.authorName ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
}

type DiscussionsDerivedStateInput = {
  user: CurrentUser | null;
  classes: ClassItem[];
  classId: string;
  topics: Topic[];
  activeTopic: Topic | null;
  keyword: string;
  pinnedOnly: boolean;
  loading: boolean;
};

export function getDiscussionsDerivedState({
  user,
  classes,
  classId,
  topics,
  activeTopic,
  keyword,
  pinnedOnly,
  loading
}: DiscussionsDerivedStateInput): DiscussionsDerivedState {
  const teacherMode = user?.role === "teacher";

  return {
    teacherMode,
    currentClass: classes.find((item) => item.id === classId) ?? null,
    pinnedTopicCount: topics.filter((item) => item.pinned).length,
    filteredTopics: filterDiscussionTopics(topics, keyword, pinnedOnly),
    hasTopicFilters: Boolean(keyword.trim()) || pinnedOnly,
    stageCopy: getDiscussionStageCopy({
      loading,
      classesCount: classes.length,
      topicsCount: topics.length,
      activeTopic,
      teacherMode
    }),
    hasDiscussionData: Boolean(user || classes.length || topics.length || activeTopic)
  };
}

export function getDiscussionCreateSuccessMessage(status: DiscussionLoadStatus) {
  if (status === "error") {
    return "话题已发布，但最新列表同步失败，请稍后重试。";
  }
  if (status === "stale") {
    return "话题已发布，讨论区正在同步最新内容。";
  }
  return "话题已发布，并已自动打开详情，方便继续查看学生回复。";
}

export function getDiscussionReplySuccessMessage(status: DiscussionLoadStatus) {
  if (status === "error") {
    return "回复已发送，但讨论记录同步失败，请稍后重试。";
  }
  if (status === "stale") {
    return "回复已发送，讨论区正在同步最新内容。";
  }
  return "回复已发送，讨论记录已经更新。";
}
