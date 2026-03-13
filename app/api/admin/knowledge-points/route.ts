import { createKnowledgePoint, getKnowledgePoints } from "@/lib/content";
import { requireRole } from "@/lib/guard";
import { addAdminLog } from "@/lib/admin-log";
import { assertAdminStepUp } from "@/lib/admin-step-up";
import { badRequest, unauthorized } from "@/lib/api/http";
import { createKnowledgePointBodySchema, isAllowedSubject } from "@/lib/api/schemas/admin";
import { parseJson, parseSearchParams, v } from "@/lib/api/validation";
import { createAdminRoute } from "@/lib/api/domains";
export const dynamic = "force-dynamic";

const listKnowledgePointsQuerySchema = v.object<{
  subject?: string;
  grade?: string;
  unit?: string;
  chapter?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "updatedAt" | "subject" | "grade" | "unit" | "chapter" | "title";
  sortDir?: "asc" | "desc";
}>(
  {
    subject: v.optional(v.string({ allowEmpty: true, trim: false })),
    grade: v.optional(v.string({ allowEmpty: true, trim: false })),
    unit: v.optional(v.string({ allowEmpty: true, trim: false })),
    chapter: v.optional(v.string({ allowEmpty: true, trim: false })),
    search: v.optional(v.string({ allowEmpty: true, trim: false })),
    page: v.optional(v.number({ integer: true, min: 1, coerce: true })),
    pageSize: v.optional(v.number({ integer: true, min: 1, max: 200, coerce: true })),
    sortBy: v.optional(v.enum(["updatedAt", "subject", "grade", "unit", "chapter", "title"] as const)),
    sortDir: v.optional(v.enum(["asc", "desc"] as const))
  },
  { allowUnknown: true }
);

function normalizeQueryString(value?: string) {
  const next = value?.trim();
  return next ? next : undefined;
}

function buildFacet(values: string[]) {
  const map = new Map<string, number>();
  values.forEach((value) => {
    const key = value.trim();
    if (!key) return;
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return Array.from(map.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

type KnowledgePointTreeNode = {
  subject: string;
  count: number;
  grades: Array<{
    grade: string;
    count: number;
    units: Array<{ unit: string; count: number }>;
  }>;
};

export const GET = createAdminRoute({
  cache: "private-short",
  handler: async ({ request }) => {
    const user = await requireRole("admin");
    if (!user) {
      unauthorized();
    }

  const query = parseSearchParams(request, listKnowledgePointsQuerySchema);
  const subject = normalizeQueryString(query.subject);
  const grade = normalizeQueryString(query.grade);
  const unit = normalizeQueryString(query.unit);
  const chapter = normalizeQueryString(query.chapter);
  const search = normalizeQueryString(query.search)?.toLowerCase();
  const sortBy = query.sortBy ?? "updatedAt";
  const sortDir = query.sortDir ?? "desc";
  const shouldPaginate = query.page !== undefined || query.pageSize !== undefined;
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 30;

  const list = await getKnowledgePoints();
  const filtered = list.filter((item) => {
    if (subject && item.subject !== subject) return false;
    if (grade && item.grade !== grade) return false;
    if (unit && (item.unit ?? "未分单元") !== unit) return false;
    if (chapter && item.chapter !== chapter) return false;
    if (search) {
      const text = [item.id, item.title, item.chapter, item.unit ?? "", item.grade, item.subject]
        .join(" ")
        .toLowerCase();
      if (!text.includes(search)) return false;
    }
    return true;
  });

  const sorted = filtered.slice().sort((a, b) => {
    const unitA = a.unit ?? "未分单元";
    const unitB = b.unit ?? "未分单元";
    let result = 0;

    if (sortBy === "subject") {
      result = a.subject.localeCompare(b.subject);
    } else if (sortBy === "grade") {
      result = a.grade.localeCompare(b.grade, "zh-Hans-CN", { numeric: true });
    } else if (sortBy === "unit") {
      result = unitA.localeCompare(unitB);
    } else if (sortBy === "chapter") {
      result = a.chapter.localeCompare(b.chapter);
    } else if (sortBy === "title") {
      result = a.title.localeCompare(b.title);
    } else {
      result = b.id.localeCompare(a.id);
    }

    return sortDir === "asc" ? result : -result;
  });

  const total = sorted.length;
  const totalPages = shouldPaginate ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const safePage = shouldPaginate ? Math.min(Math.max(page, 1), totalPages) : 1;
  const start = shouldPaginate ? (safePage - 1) * pageSize : 0;
  const end = shouldPaginate ? start + pageSize : sorted.length;
  const data = sorted.slice(start, end);

  const facetsSource = sorted;
  const subjectFacet = buildFacet(facetsSource.map((item) => item.subject));
  const gradeFacet = buildFacet(facetsSource.map((item) => item.grade));
  const unitFacet = buildFacet(facetsSource.map((item) => item.unit ?? "未分单元"));
  const chapterFacet = buildFacet(facetsSource.map((item) => item.chapter));

  const treeMap = new Map<string, KnowledgePointTreeNode>();
  facetsSource.forEach((item) => {
    const subjectNode =
      treeMap.get(item.subject) ??
      ({
        subject: item.subject,
        count: 0,
        grades: []
      } as KnowledgePointTreeNode);
    subjectNode.count += 1;

    let gradeNode = subjectNode.grades.find((entry) => entry.grade === item.grade);
    if (!gradeNode) {
      gradeNode = { grade: item.grade, count: 0, units: [] };
      subjectNode.grades.push(gradeNode);
    }
    gradeNode.count += 1;

    const unitValue = item.unit ?? "未分单元";
    const unitNode = gradeNode.units.find((entry) => entry.unit === unitValue);
    if (unitNode) {
      unitNode.count += 1;
    } else {
      gradeNode.units.push({ unit: unitValue, count: 1 });
    }

    treeMap.set(item.subject, subjectNode);
  });

  const tree = Array.from(treeMap.values())
    .sort((a, b) => b.count - a.count || a.subject.localeCompare(b.subject))
    .map((subjectNode) => ({
      ...subjectNode,
      grades: subjectNode.grades
        .slice()
        .sort((a, b) => a.grade.localeCompare(b.grade, "zh-Hans-CN", { numeric: true }))
        .map((gradeNode) => ({
          ...gradeNode,
          units: gradeNode.units
            .slice()
            .sort((a, b) => b.count - a.count || a.unit.localeCompare(b.unit))
        }))
    }));

    return {
      data,
      meta: {
        total,
        page: safePage,
        pageSize: shouldPaginate ? pageSize : total,
        totalPages
      },
      facets: {
        subjects: subjectFacet,
        grades: gradeFacet,
        units: unitFacet,
        chapters: chapterFacet
      },
      tree,
      filters: {
        subject: subject ?? null,
        grade: grade ?? null,
        unit: unit ?? null,
        chapter: chapter ?? null,
        search: search ?? null,
        sortBy,
        sortDir
      }
    };
  }
});

export const POST = createAdminRoute({
  cache: "private-realtime",
  handler: async ({ request }) => {
    const user = await requireRole("admin");
    if (!user) {
      unauthorized();
    }
    assertAdminStepUp(user);

  const body = await parseJson(request, createKnowledgePointBodySchema);
  const subject = body.subject?.trim();
  const grade = body.grade?.trim();
  const title = body.title?.trim();
  const chapter = body.chapter?.trim();

  if (!subject || !grade || !title || !chapter) {
    badRequest("missing fields");
  }
  if (!isAllowedSubject(subject)) {
    badRequest("invalid subject");
  }

  const unit = body.unit?.trim();
  const next = await createKnowledgePoint({
    subject,
    grade,
    title,
    chapter,
    unit: unit ? unit : "未分单元"
  });

    if (next) {
      await addAdminLog({
        adminId: user.id,
        action: "create_knowledge_point",
        entityType: "knowledge_point",
        entityId: next.id,
        detail: `${next.subject} ${next.grade} ${next.unit ?? "未分单元"} ${next.title}`
      });
    }

    return { data: next };
  }
});
