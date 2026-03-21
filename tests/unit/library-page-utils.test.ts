import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

const Module = require("node:module") as {
  _resolveFilename: (request: string, parent?: unknown, isMain?: boolean, options?: unknown) => string;
};

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "@/lib/constants") {
    return path.resolve(__dirname, "../../lib/constants.js");
  }
  if (request === "@/lib/client-request") {
    return path.resolve(__dirname, "../../lib/client-request.js");
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const {
  buildLibraryExpandedTypeKeys,
  buildLibraryListSearchParams,
  getLibraryNoStoreRequestInit,
  getLibraryPageDerivedState,
  normalizeLibraryImportForm,
  normalizeLibraryListSnapshot,
  pruneExpandedLibrarySubjects,
  pruneExpandedLibraryTypeKeys,
  removeLibraryItemSnapshot,
  resolveLibraryAiClassId
} = require("../../app/library/utils") as typeof import("../../app/library/utils");
Module._resolveFilename = originalResolveFilename;

test("library page helpers build list search params and normalize list payloads", () => {
  assert.equal(
    buildLibraryListSearchParams(2, 16, "math", "textbook", " 几何 ").toString(),
    "page=2&pageSize=16&subject=math&contentType=textbook&keyword=%E5%87%A0%E4%BD%95"
  );

  assert.deepEqual(
    normalizeLibraryListSnapshot(
      {
        data: [{ id: "item-1", title: "几何教材", subject: "math", grade: "4", contentType: "textbook", accessScope: "global", sourceType: "file", generatedByAi: false, createdAt: "2026-03-19T10:00:00.000Z", extractedKnowledgePoints: [] }],
        meta: { total: 1, page: 2, pageSize: 16, totalPages: 3, hasPrev: true, hasNext: true },
        facets: {
          subjects: [{ value: "math", count: 1 }],
          grades: [{ value: "4", count: 1 }],
          contentTypes: [{ value: "textbook", count: 1 }]
        },
        summary: { textbookCount: 1, coursewareCount: 0, lessonPlanCount: 0 }
      },
      1,
      20
    ),
    {
      items: [{ id: "item-1", title: "几何教材", subject: "math", grade: "4", contentType: "textbook", accessScope: "global", sourceType: "file", generatedByAi: false, createdAt: "2026-03-19T10:00:00.000Z", extractedKnowledgePoints: [] }],
      meta: { total: 1, page: 2, pageSize: 16, totalPages: 3, hasPrev: true, hasNext: true },
      facets: {
        subjects: [{ value: "math", count: 1 }],
        grades: [{ value: "4", count: 1 }],
        contentTypes: [{ value: "textbook", count: 1 }]
      },
      summary: { textbookCount: 1, coursewareCount: 0, lessonPlanCount: 0 }
    }
  );
});

test("library page helpers remove stale snapshot entries without corrupting pagination and counts", () => {
  assert.deepEqual(
    removeLibraryItemSnapshot(
      [
        { id: "item-2", title: "配套课件", subject: "math", grade: "4", contentType: "courseware", accessScope: "global", sourceType: "file", generatedByAi: false, createdAt: "2026-03-19T11:00:00.000Z", extractedKnowledgePoints: [] }
      ],
      { total: 2, page: 2, pageSize: 1, totalPages: 2, hasPrev: true, hasNext: false },
      {
        subjects: [{ value: "math", count: 2 }],
        grades: [{ value: "4", count: 2 }],
        contentTypes: [{ value: "courseware", count: 1 }, { value: "textbook", count: 1 }]
      },
      { textbookCount: 1, coursewareCount: 1, lessonPlanCount: 0 },
      { id: "item-2", title: "配套课件", subject: "math", grade: "4", contentType: "courseware", accessScope: "global", sourceType: "file", generatedByAi: false, createdAt: "2026-03-19T11:00:00.000Z", extractedKnowledgePoints: [] }
    ),
    {
      items: [],
      meta: { total: 1, page: 1, pageSize: 1, totalPages: 1, hasPrev: false, hasNext: false },
      facets: {
        subjects: [{ value: "math", count: 1 }],
        grades: [{ value: "4", count: 1 }],
        contentTypes: [{ value: "textbook", count: 1 }]
      },
      summary: { textbookCount: 1, coursewareCount: 0, lessonPlanCount: 0 }
    }
  );
});

test("library page helpers resolve teacher class fallback and group items deterministically", () => {
  const classes = [
    { id: "class-a", name: "四年级一班", subject: "math", grade: "4" },
    { id: "class-b", name: "四年级二班", subject: "english", grade: "4" }
  ];

  assert.equal(resolveLibraryAiClassId(classes, "class-b"), "class-b");
  assert.equal(resolveLibraryAiClassId(classes, "missing-class"), "class-a");
  assert.equal(resolveLibraryAiClassId([], "class-a"), "");

  const derivedState = getLibraryPageDerivedState({
    facets: {
      subjects: [{ value: "english", count: 1 }, { value: "math", count: 2 }],
      grades: [],
      contentTypes: []
    },
    items: [
      { id: "item-1", title: "教材", subject: "math", grade: "4", contentType: "textbook", accessScope: "global", sourceType: "file", generatedByAi: false, createdAt: "2026-03-19T10:00:00.000Z", extractedKnowledgePoints: [] },
      { id: "item-2", title: "教案", subject: "math", grade: "4", contentType: "lesson_plan", accessScope: "class", sourceType: "text", generatedByAi: true, createdAt: "2026-03-19T09:00:00.000Z", extractedKnowledgePoints: [] },
      { id: "item-3", title: "课件", subject: "english", grade: "4", contentType: "courseware", accessScope: "global", sourceType: "file", generatedByAi: false, createdAt: "2026-03-19T08:00:00.000Z", extractedKnowledgePoints: [] }
    ]
  });

  assert.deepEqual(derivedState.subjectList, ["math", "english"]);

  assert.deepEqual(
    derivedState.groupedBySubject.map((group) => ({
      subject: group.subject,
      types: group.contentGroups.map((contentGroup) => contentGroup.contentType)
    })),
    [
      { subject: "math", types: ["textbook", "lesson_plan"] },
      { subject: "english", types: ["courseware"] }
    ]
  );
});

test("library page helpers prune stale expanded state after regrouping", () => {
  const grouped = getLibraryPageDerivedState({
    facets: { subjects: [], grades: [], contentTypes: [] },
    items: [
      { id: "item-1", title: "教材", subject: "math", grade: "4", contentType: "textbook", accessScope: "global", sourceType: "file", generatedByAi: false, createdAt: "2026-03-19T10:00:00.000Z", extractedKnowledgePoints: [] },
      { id: "item-2", title: "课件", subject: "english", grade: "4", contentType: "courseware", accessScope: "global", sourceType: "file", generatedByAi: false, createdAt: "2026-03-19T08:00:00.000Z", extractedKnowledgePoints: [] }
    ]
  }).groupedBySubject;

  assert.deepEqual(buildLibraryExpandedTypeKeys(grouped), ["math:textbook", "english:courseware"]);
  assert.deepEqual(pruneExpandedLibrarySubjects(["math", "science"], grouped), ["math"]);
  assert.deepEqual(
    pruneExpandedLibraryTypeKeys(["math:textbook", "science:textbook"], grouped),
    ["math:textbook"]
  );
});

test("library page helpers normalize textbook import source to file-only mode", () => {
  assert.deepEqual(
    normalizeLibraryImportForm({
      title: "教材",
      description: "教材说明",
      subject: "math",
      grade: "4",
      contentType: "textbook",
      sourceType: "text",
      textContent: "正文",
      linkUrl: "https://example.com"
    }),
    {
      title: "教材",
      description: "教材说明",
      subject: "math",
      grade: "4",
      contentType: "textbook",
      sourceType: "file",
      textContent: "",
      linkUrl: ""
    }
  );

  const lessonPlanForm = {
    title: "教案",
    description: "教案说明",
    subject: "math",
    grade: "4",
    contentType: "lesson_plan" as const,
    sourceType: "text" as const,
    textContent: "正文",
    linkUrl: ""
  };
  assert.equal(normalizeLibraryImportForm(lessonPlanForm), lessonPlanForm);
});

test("library page helpers expose fresh no-store request init for dynamic bootstrap and list loads", () => {
  const first = getLibraryNoStoreRequestInit();
  const second = getLibraryNoStoreRequestInit();

  assert.notEqual(first, second);
  assert.deepEqual(first, { cache: "no-store" });
  assert.deepEqual(second, { cache: "no-store" });
});
