import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import { SUBJECT_LABELS } from "@/lib/constants";
import type { FavoriteItem, StudentFavoritesStageCopy } from "./types";

type StudentFavoritesStageCopyInput = {
  loading: boolean;
  editingQuestionId: string;
  favoritesCount: number;
  filteredCount: number;
  hasActiveFilters: boolean;
};

export function normalizeFavoriteTagInput(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[，,\n]/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).slice(0, 12);
}

export function buildFavoriteSearchText(item: FavoriteItem) {
  return [
    item.question?.stem ?? "",
    item.question?.knowledgePointTitle ?? "",
    SUBJECT_LABELS[item.question?.subject ?? ""] ?? item.question?.subject ?? "",
    item.note ?? "",
    ...(item.tags ?? [])
  ]
    .join(" ")
    .toLowerCase();
}

export function getStudentFavoritesRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;

  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续查看收藏夹。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function getStudentFavoriteSaveRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;

  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续保存收藏信息。";
  }

  return getStudentFavoritesRequestMessage(error, fallback);
}

export function getStudentFavoriteRemoveRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;

  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续整理收藏夹。";
  }

  return getStudentFavoritesRequestMessage(error, fallback);
}

export function resolveStudentFavoritesSubjectFilter(favorites: FavoriteItem[], subjectFilter: string) {
  if (subjectFilter === "all") {
    return "all";
  }

  const subjects = new Set(
    favorites.map((item) => item.question?.subject).filter((value): value is string => Boolean(value))
  );

  return subjects.has(subjectFilter) ? subjectFilter : "all";
}

export function resolveStudentFavoritesSelectedTag(favorites: FavoriteItem[], selectedTag: string) {
  if (!selectedTag) {
    return "";
  }

  const tags = new Set(favorites.flatMap((item) => item.tags));
  return tags.has(selectedTag) ? selectedTag : "";
}

export async function copyTextToClipboard(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  throw new Error("clipboard unavailable");
}

export function getStudentFavoritesStageCopy({
  loading,
  editingQuestionId,
  favoritesCount,
  filteredCount,
  hasActiveFilters
}: StudentFavoritesStageCopyInput): StudentFavoritesStageCopy {
  if (loading) {
    return {
      title: "正在整理你的收藏题目",
      description: "系统正在同步题目、标签与复习备注，请稍等。"
    };
  }

  if (editingQuestionId) {
    return {
      title: "正在整理这道收藏题的复习信息",
      description: "可以补充标签和备注，把这道题变成后续复习时更好用的学习资产。"
    };
  }

  if (!favoritesCount) {
    return {
      title: "当前还没有收藏题目",
      description: "先在练习、考试或 AI 辅导中收藏题目，这里会自动沉淀成你的复习清单。"
    };
  }

  if (hasActiveFilters) {
    return {
      title: `当前筛出 ${filteredCount} 道重点收藏题`,
      description: "你可以继续按关键词、标签和学科收窄范围，快速找到要复习的那一组题。"
    };
  }

  return {
    title: `你已沉淀 ${favoritesCount} 道收藏题`,
    description: "建议给重点题补上标签和备注，后续做阶段复习时会更快回忆解题思路。"
  };
}
