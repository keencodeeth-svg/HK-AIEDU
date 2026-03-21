import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import type {
  ReportProfileData,
  ReportProfileKnowledgeItem,
  ReportProfileResponse,
  ReportProfileSubjectGroup,
  ReportSortMode
} from "./types";

export function isErrorResponse(value: unknown): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string";
}

export function getWeeklyReportRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;

  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续查看学习周报。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function getReportProfileRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;

  if (status === 401 || status === 403) {
    return "学生登录状态已失效，请重新登录后继续查看学习画像。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function getRatioColor(ratio: number) {
  const hue = Math.min(120, Math.max(0, Math.round((ratio / 100) * 120)));
  return `hsl(${hue}, 70%, 88%)`;
}

export function getDisplaySubjectGroups(
  profile: ReportProfileData | null,
  subjectFilter: string
): ReportProfileSubjectGroup[] {
  if (!profile?.subjects.length) {
    return [];
  }

  if (subjectFilter === "all") {
    return profile.subjects;
  }

  return profile.subjects.filter((group) => group.subject === subjectFilter);
}

export function resolveReportSubjectFilter(profile: ReportProfileData | null, subjectFilter: string) {
  if (subjectFilter === "all") {
    return "all";
  }

  return profile?.subjects.some((group) => group.subject === subjectFilter) ? subjectFilter : "all";
}

export function getChapterOptions(groups: ReportProfileSubjectGroup[]): string[] {
  const chapters = groups
    .flatMap((group) => group.items.map((item) => item.chapter))
    .filter((item): item is string => typeof item === "string" && item.length > 0);

  return Array.from(new Set(chapters));
}

export function resolveReportChapterFilter(groups: ReportProfileSubjectGroup[], chapterFilter: string) {
  if (chapterFilter === "all") {
    return "all";
  }

  return getChapterOptions(groups).includes(chapterFilter) ? chapterFilter : "all";
}

export function getVisibleKnowledgeItems(
  items: ReportProfileKnowledgeItem[],
  chapterFilter: string,
  sortMode: ReportSortMode
): ReportProfileKnowledgeItem[] {
  const filteredItems = items.filter((item) => (chapterFilter === "all" ? true : item.chapter === chapterFilter));

  return [...filteredItems].sort((left, right) => {
    if (sortMode === "ratio-desc") {
      return right.ratio - left.ratio;
    }
    if (sortMode === "total-desc") {
      return right.total - left.total;
    }
    return left.ratio - right.ratio;
  });
}

export function getReportPageDerivedState(options: {
  profile: ReportProfileResponse | null;
  subjectFilter: string;
  chapterFilter: string;
}) {
  const profileData = options.profile && !isErrorResponse(options.profile) ? options.profile : null;
  const resolvedSubjectFilter = resolveReportSubjectFilter(profileData, options.subjectFilter);
  const displaySubjects = getDisplaySubjectGroups(profileData, resolvedSubjectFilter);
  const chapterOptions = getChapterOptions(displaySubjects);
  const resolvedChapterFilter = resolveReportChapterFilter(displaySubjects, options.chapterFilter);

  return {
    profileData,
    displaySubjects,
    chapterOptions,
    resolvedSubjectFilter,
    resolvedChapterFilter
  };
}
