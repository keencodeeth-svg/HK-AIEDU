import { SUBJECT_LABELS } from "@/lib/constants";
import { removeFacetCount } from "./request-helpers";
import type {
  ClassItem,
  LibraryContentFilter,
  LibraryFacets,
  LibraryImportFormState,
  LibraryItem,
  LibraryListResponse,
  LibraryMeta,
  LibrarySubjectGroup,
  LibrarySummary
} from "./types";

export const DEFAULT_META: LibraryMeta = {
  total: 0,
  page: 1,
  pageSize: 24,
  totalPages: 0,
  hasPrev: false,
  hasNext: false
};

export const DEFAULT_FACETS: LibraryFacets = {
  subjects: [],
  grades: [],
  contentTypes: []
};

export const DEFAULT_SUMMARY: LibrarySummary = {
  textbookCount: 0,
  coursewareCount: 0,
  lessonPlanCount: 0
};

export function buildBatchImportTemplate() {
  return {
    options: {
      autoCreateKnowledgePoint: true,
      skipExistingQuestionStem: true
    },
    textbooks: [
      {
        title: "四年级数学 上册 第一单元",
        description: "教材导入示例（文件）",
        contentType: "textbook",
        subject: "math",
        grade: "4",
        sourceType: "file",
        fileName: "四年级数学-第一单元.txt",
        mimeType: "text/plain",
        contentBase64: "56ys5LiA5Y2V5YWD77ya5Zub5YiZ6L+Q566X56S65L6L5YaF5a65",
        accessScope: "global"
      }
    ],
    questions: [
      {
        subject: "math",
        grade: "4",
        knowledgePointTitle: "四则运算",
        chapter: "第一单元",
        stem: "12 + 18 = ?",
        options: ["20", "28", "30", "32"],
        answer: "30",
        explanation: "把十位和个位分别相加。",
        difficulty: "easy",
        questionType: "choice",
        tags: ["计算", "基础"],
        abilities: ["运算能力"]
      }
    ]
  };
}

export function contentTypeLabel(type: string) {
  if (type === "courseware") return "课件";
  if (type === "lesson_plan") return "教案";
  return "教材";
}

export function contentTypeRank(type: LibraryItem["contentType"]) {
  if (type === "textbook") return 0;
  if (type === "courseware") return 1;
  return 2;
}

export function buildLibraryListSearchParams(
  page: number,
  pageSize: number,
  subjectFilter: string,
  contentFilter: LibraryContentFilter,
  keyword: string
) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (subjectFilter !== "all") {
    params.set("subject", subjectFilter);
  }
  if (contentFilter !== "all") {
    params.set("contentType", contentFilter);
  }
  if (keyword.trim()) {
    params.set("keyword", keyword.trim());
  }
  return params;
}

export function normalizeLibraryListSnapshot(
  payload: LibraryListResponse,
  page: number,
  pageSize: number
) {
  return {
    items: Array.isArray(payload.data) ? payload.data : [],
    meta: {
      total: Number(payload.meta?.total ?? 0),
      page: Number(payload.meta?.page ?? page),
      pageSize: Number(payload.meta?.pageSize ?? pageSize),
      totalPages: Number(payload.meta?.totalPages ?? 0),
      hasPrev: Boolean(payload.meta?.hasPrev),
      hasNext: Boolean(payload.meta?.hasNext)
    } satisfies LibraryMeta,
    facets: {
      subjects: Array.isArray(payload.facets?.subjects) ? payload.facets.subjects : [],
      grades: Array.isArray(payload.facets?.grades) ? payload.facets.grades : [],
      contentTypes: Array.isArray(payload.facets?.contentTypes) ? payload.facets.contentTypes : []
    } satisfies LibraryFacets,
    summary: {
      textbookCount: Number(payload.summary?.textbookCount ?? 0),
      coursewareCount: Number(payload.summary?.coursewareCount ?? 0),
      lessonPlanCount: Number(payload.summary?.lessonPlanCount ?? 0)
    } satisfies LibrarySummary
  };
}

export function removeLibraryItemSnapshot(
  items: LibraryItem[],
  meta: LibraryMeta,
  facets: LibraryFacets,
  summary: LibrarySummary,
  item: LibraryItem
) {
  const nextItems = items.filter((entry) => entry.id !== item.id);
  if (nextItems.length === items.length) {
    return { items, meta, facets, summary };
  }

  const nextTotal = Math.max(0, meta.total - 1);
  const nextTotalPages = nextTotal === 0 ? 0 : Math.ceil(nextTotal / Math.max(meta.pageSize, 1));
  const nextPage = nextTotalPages === 0 ? 1 : Math.min(meta.page, nextTotalPages);

  return {
    items: nextItems,
    meta: {
      ...meta,
      total: nextTotal,
      page: nextPage,
      totalPages: nextTotalPages,
      hasPrev: nextTotalPages > 0 && nextPage > 1,
      hasNext: nextTotalPages > 0 && nextPage < nextTotalPages
    },
    facets: {
      subjects: removeFacetCount(facets.subjects, item.subject),
      grades: removeFacetCount(facets.grades, item.grade),
      contentTypes: removeFacetCount(facets.contentTypes, item.contentType)
    },
    summary: {
      textbookCount: Math.max(0, summary.textbookCount - (item.contentType === "textbook" ? 1 : 0)),
      coursewareCount: Math.max(0, summary.coursewareCount - (item.contentType === "courseware" ? 1 : 0)),
      lessonPlanCount: Math.max(0, summary.lessonPlanCount - (item.contentType === "lesson_plan" ? 1 : 0))
    }
  };
}

export function resolveLibraryAiClassId(classes: ClassItem[], classId: string) {
  if (!classes.length) {
    return "";
  }
  return classId && classes.some((item) => item.id === classId) ? classId : classes[0]?.id ?? "";
}

export function getLibraryNoStoreRequestInit(): RequestInit {
  return { cache: "no-store" };
}

export function normalizeLibraryImportForm(importForm: LibraryImportFormState): LibraryImportFormState {
  if (importForm.contentType !== "textbook" || importForm.sourceType === "file") {
    return importForm;
  }
  return {
    ...importForm,
    sourceType: "file",
    textContent: "",
    linkUrl: ""
  };
}

export function buildLibrarySubjectList(facets: LibraryFacets) {
  return facets.subjects
    .map((item) => item.value)
    .slice()
    .sort((left, right) => {
      const leftLabel = SUBJECT_LABELS[left] ?? left;
      const rightLabel = SUBJECT_LABELS[right] ?? right;
      return leftLabel.localeCompare(rightLabel, "zh-CN");
    });
}

export function getLibraryPageDerivedState({
  facets,
  items
}: {
  facets: LibraryFacets;
  items: LibraryItem[];
}) {
  return {
    subjectList: buildLibrarySubjectList(facets),
    groupedBySubject: buildLibrarySubjectGroups(items)
  };
}

export function buildLibrarySubjectGroups(items: LibraryItem[]): LibrarySubjectGroup[] {
  const bucket = new Map<string, LibraryItem[]>();
  items.forEach((item) => {
    const list = bucket.get(item.subject) ?? [];
    list.push(item);
    bucket.set(item.subject, list);
  });

  return Array.from(bucket.entries())
    .map(([subject, list]) => ({
      subject,
      label: SUBJECT_LABELS[subject] ?? subject,
      list: list.slice().sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
      contentGroups: (["textbook", "courseware", "lesson_plan"] as LibraryItem["contentType"][])
        .map((contentType) => ({
          contentType,
          label: contentTypeLabel(contentType),
          list: list.filter((item) => item.contentType === contentType)
        }))
        .filter((group) => group.list.length)
        .sort((left, right) => contentTypeRank(left.contentType) - contentTypeRank(right.contentType))
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));
}

export function pruneExpandedLibrarySubjects(
  expandedSubjects: string[],
  groupedBySubject: LibrarySubjectGroup[]
) {
  const visibleSubjects = new Set(groupedBySubject.map((item) => item.subject));
  return expandedSubjects.filter((item) => visibleSubjects.has(item));
}

export function buildLibraryExpandedTypeKeys(groupedBySubject: LibrarySubjectGroup[]) {
  return groupedBySubject.flatMap((group) =>
    group.contentGroups.map((contentGroup) => `${group.subject}:${contentGroup.contentType}`)
  );
}

export function pruneExpandedLibraryTypeKeys(
  expandedTypeKeys: string[],
  groupedBySubject: LibrarySubjectGroup[]
) {
  const visibleKeys = new Set(buildLibraryExpandedTypeKeys(groupedBySubject));
  return expandedTypeKeys.filter((item) => visibleKeys.has(item));
}

export function toBase64(file: File) {
  return new Promise<{ base64: string; mimeType: string; fileName: string; size: number }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve({
        base64,
        mimeType: file.type || "application/octet-stream",
        fileName: file.name,
        size: file.size
      });
    };
    reader.onerror = () => reject(new Error("read file failed"));
    reader.readAsDataURL(file);
  });
}
