import { getCurrentUser } from "@/lib/auth";
import { getClassesByStudent, getClassesByTeacher } from "@/lib/classes";
import {
  listLearningLibraryItems,
  type LearningLibraryItem
} from "@/lib/learning-library";
import { unauthorized } from "@/lib/api/http";
import { parseSearchParams, v } from "@/lib/api/validation";
import { createLearningRoute } from "@/lib/api/domains";

function isLightListModeEnabled() {
  if (process.env.LIBRARY_LIGHT_LIST === "false") return false;
  if (process.env.LIBRARY_LIGHT_LIST === "true") return true;
  return true;
}

function stripStorageMeta(item: LearningLibraryItem) {
  const { contentStorageProvider, contentStorageKey, ...rest } = item;
  return rest;
}

function toLibraryListItem(item: LearningLibraryItem, lightList: boolean) {
  const sanitized = stripStorageMeta(item);
  if (!lightList) return sanitized;
  const { contentBase64, textContent, ...rest } = sanitized;
  return rest;
}

const querySchema = v.object<{
  subject?: string;
  grade?: string;
  contentType?: string;
  keyword?: string;
  page?: string;
  pageSize?: string;
}>(
  {
    subject: v.optional(v.string({ minLength: 1 })),
    grade: v.optional(v.string({ minLength: 1 })),
    contentType: v.optional(v.string({ minLength: 1 })),
    keyword: v.optional(v.string({ allowEmpty: true })),
    page: v.optional(v.string({ minLength: 1 })),
    pageSize: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: true }
);

type FacetItem = {
  value: string;
  count: number;
};

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function parseIntParam(value: string | undefined, fallback: number, min: number, max: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return clampInt(Math.floor(parsed), min, max);
}

function buildFacets(items: LearningLibraryItem[]) {
  const subjectMap = new Map<string, number>();
  const gradeMap = new Map<string, number>();
  const contentTypeMap = new Map<string, number>();

  items.forEach((item) => {
    subjectMap.set(item.subject, (subjectMap.get(item.subject) ?? 0) + 1);
    gradeMap.set(item.grade, (gradeMap.get(item.grade) ?? 0) + 1);
    contentTypeMap.set(item.contentType, (contentTypeMap.get(item.contentType) ?? 0) + 1);
  });

  const toFacetArray = (map: Map<string, number>): FacetItem[] =>
    Array.from(map.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.value.localeCompare(b.value, "zh-CN");
      });

  return {
    subjects: toFacetArray(subjectMap),
    grades: toFacetArray(gradeMap),
    contentTypes: toFacetArray(contentTypeMap)
  };
}

function buildSummary(items: LearningLibraryItem[]) {
  return items.reduce(
    (acc, item) => {
      if (item.contentType === "textbook") acc.textbookCount += 1;
      if (item.contentType === "courseware") acc.coursewareCount += 1;
      if (item.contentType === "lesson_plan") acc.lessonPlanCount += 1;
      return acc;
    },
    {
      textbookCount: 0,
      coursewareCount: 0,
      lessonPlanCount: 0
    }
  );
}

function matchesKeyword(item: LearningLibraryItem, keyword: string) {
  if (!keyword) return true;
  const haystack = [
    item.title,
    item.description ?? "",
    item.fileName ?? "",
    item.grade,
    ...(item.extractedKnowledgePoints ?? [])
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(keyword);
}

export const GET = createLearningRoute({
  cache: "private-short",
  handler: async ({ request }) => {
    const lightList = isLightListModeEnabled();
    const user = await getCurrentUser();
    if (!user) {
      unauthorized();
    }

    const query = parseSearchParams(request, querySchema);
    const contentTypeInput = query.contentType?.trim();
    const contentType =
      contentTypeInput === "textbook" ||
      contentTypeInput === "courseware" ||
      contentTypeInput === "lesson_plan"
        ? contentTypeInput
        : undefined;
    const keyword = query.keyword?.trim().toLowerCase() ?? "";
    const page = parseIntParam(query.page, 1, 1, 10000);
    const pageSize = parseIntParam(query.pageSize, 24, 1, 100);
    const all = await listLearningLibraryItems({
      subject: query.subject?.trim() || undefined,
      grade: query.grade?.trim() || undefined,
      contentType
    });

    let visible = all;

    if (user.role !== "admin") {
      let classIds: string[] = [];
      if (user.role === "teacher") {
        classIds = (await getClassesByTeacher(user.id)).map((item) => item.id);
      } else if (user.role === "student") {
        classIds = (await getClassesByStudent(user.id)).map((item) => item.id);
      } else if (user.role === "parent" && user.studentId) {
        classIds = (await getClassesByStudent(user.studentId)).map((item) => item.id);
      }
      const classIdSet = new Set(classIds);

      visible = all.filter((item) => {
        if (item.status !== "published" && item.ownerId !== user.id) {
          return false;
        }
        if (item.accessScope === "global") {
          return true;
        }
        if (!item.classId) {
          return false;
        }
        if (user.role === "teacher" && item.ownerId === user.id) {
          return true;
        }
        return classIdSet.has(item.classId);
      });
    }

    const filtered = visible.filter((item) => matchesKeyword(item, keyword));
    const total = filtered.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const currentPage = totalPages === 0 ? 1 : Math.min(page, totalPages);
    const start = (currentPage - 1) * pageSize;
    const pageItems = filtered.slice(start, start + pageSize);
    const facets = buildFacets(filtered);

    if (user.role === "admin") {
      return {
        data: pageItems.map((item) => toLibraryListItem(item, lightList)),
        meta: {
          total,
          page: currentPage,
          pageSize,
          totalPages,
          hasPrev: currentPage > 1 && totalPages > 0,
          hasNext: totalPages > 0 && currentPage < totalPages
        },
        facets,
        summary: buildSummary(filtered)
      };
    }

    return {
      data: pageItems.map((item) => toLibraryListItem(item, lightList)),
      meta: {
        total,
        page: currentPage,
        pageSize,
        totalPages,
        hasPrev: currentPage > 1 && totalPages > 0,
        hasNext: totalPages > 0 && currentPage < totalPages
      },
      facets,
      summary: buildSummary(filtered)
    };
  }
});
