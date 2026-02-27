"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QuestionsListPanel from "./_components/QuestionsListPanel";
import QuestionsToolsPanel from "./_components/QuestionsToolsPanel";
import type {
  AiQuestionForm,
  KnowledgePoint,
  Question,
  QuestionFacets,
  QuestionForm,
  QuestionListPayload,
  QuestionQuery,
  QuestionTreeNode
} from "./types";
import { downloadQuestionTemplate, parseCsv, parseListText } from "./utils";

export default function QuestionsAdminPage() {
  const [list, setList] = useState<Question[]>([]);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [workspace, setWorkspace] = useState<"list" | "tools">("list");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState<QuestionQuery>({
    subject: "all",
    grade: "all",
    chapter: "all",
    difficulty: "all",
    questionType: "all",
    search: "",
    pool: "all",
    riskLevel: "all",
    answerConflict: "all",
    duplicateClusterId: ""
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [meta, setMeta] = useState({ total: 0, page: 1, pageSize: 20, totalPages: 1 });
  const [tree, setTree] = useState<QuestionTreeNode[]>([]);
  const [facets, setFacets] = useState<QuestionFacets>({
    subjects: [],
    grades: [],
    chapters: [],
    difficulties: [],
    questionTypes: []
  });
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [form, setForm] = useState<QuestionForm>({
    subject: "math",
    grade: "4",
    knowledgePointId: "",
    stem: "",
    options: "",
    answer: "",
    explanation: "",
    difficulty: "medium",
    questionType: "choice",
    tags: "",
    abilities: ""
  });
  const [aiForm, setAiForm] = useState<AiQuestionForm>({
    subject: "math",
    grade: "4",
    knowledgePointId: "",
    count: 1,
    difficulty: "medium",
    mode: "single",
    chapter: ""
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiErrors, setAiErrors] = useState<string[]>([]);

  const chapterOptions = useMemo(() => {
    const filtered = knowledgePoints.filter(
      (kp) => kp.subject === aiForm.subject && kp.grade === aiForm.grade
    );
    const chapters = filtered.map((kp) => kp.chapter).filter(Boolean);
    return Array.from(new Set(chapters));
  }, [knowledgePoints, aiForm.subject, aiForm.grade]);

  const aiKnowledgePoints = useMemo(
    () => knowledgePoints.filter((kp) => kp.subject === aiForm.subject && kp.grade === aiForm.grade),
    [knowledgePoints, aiForm.subject, aiForm.grade]
  );

  const loadKnowledgePoints = useCallback(async () => {
    const kpRes = await fetch("/api/admin/knowledge-points");
    const kpData = await kpRes.json();
    setKnowledgePoints(kpData.data ?? []);
  }, []);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    const searchParams = new URLSearchParams();
    if (query.subject !== "all") searchParams.set("subject", query.subject);
    if (query.grade !== "all") searchParams.set("grade", query.grade);
    if (query.chapter !== "all") searchParams.set("chapter", query.chapter);
    if (query.difficulty !== "all") searchParams.set("difficulty", query.difficulty);
    if (query.questionType !== "all") searchParams.set("questionType", query.questionType);
    if (query.search.trim()) searchParams.set("search", query.search.trim());
    if (query.pool !== "all") searchParams.set("pool", query.pool);
    if (query.riskLevel !== "all") searchParams.set("riskLevel", query.riskLevel);
    if (query.answerConflict !== "all") searchParams.set("answerConflict", query.answerConflict);
    if (query.duplicateClusterId.trim()) searchParams.set("duplicateClusterId", query.duplicateClusterId.trim());
    searchParams.set("page", String(page));
    searchParams.set("pageSize", String(pageSize));

    const qRes = await fetch(`/api/admin/questions?${searchParams.toString()}`);
    const qData = (await qRes.json()) as QuestionListPayload;
    setList(qData.data ?? []);
    setMeta(
      qData.meta ?? {
        total: qData.data?.length ?? 0,
        page,
        pageSize,
        totalPages: 1
      }
    );
    setTree(qData.tree ?? []);
    setFacets({
      subjects: qData.facets?.subjects ?? [],
      grades: qData.facets?.grades ?? [],
      chapters: qData.facets?.chapters ?? [],
      difficulties: qData.facets?.difficulties ?? [],
      questionTypes: qData.facets?.questionTypes ?? []
    });
    setLoading(false);
  }, [page, pageSize, query]);

  useEffect(() => {
    loadKnowledgePoints();
  }, [loadKnowledgePoints]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  useEffect(() => {
    if (knowledgePoints.length && !form.knowledgePointId) {
      setForm((prev) => ({ ...prev, knowledgePointId: knowledgePoints[0].id }));
    }
    if (aiKnowledgePoints.length && !aiForm.knowledgePointId) {
      setAiForm((prev) => ({ ...prev, knowledgePointId: aiKnowledgePoints[0].id }));
    }
    if (aiForm.knowledgePointId && !aiKnowledgePoints.find((kp) => kp.id === aiForm.knowledgePointId)) {
      setAiForm((prev) => ({ ...prev, knowledgePointId: aiKnowledgePoints[0]?.id ?? "" }));
    }
  }, [knowledgePoints, form.knowledgePointId, aiForm.knowledgePointId, aiKnowledgePoints]);

  useEffect(() => {
    if (aiForm.mode === "batch" && chapterOptions.length && !aiForm.chapter) {
      setAiForm((prev) => ({ ...prev, chapter: chapterOptions[0] }));
    }
  }, [aiForm.mode, aiForm.chapter, chapterOptions]);

  function patchQuery(next: Partial<QuestionQuery>) {
    setQuery((prev) => ({ ...prev, ...next }));
    setPage(1);
  }

  async function handleImport(file?: File | null) {
    if (!file) return;
    setImportMessage(null);
    setImportErrors([]);
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) {
      setImportErrors(["CSV 内容不足"]);
      return;
    }
    const headers = rows[0].map((h) => h.trim());
    const items: any[] = [];
    const errors: string[] = [];

    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i];
      if (!row.length) continue;
      const record: Record<string, string> = {};
      headers.forEach((key, index) => {
        record[key] = row[index] ?? "";
      });
      const options = (record.options || "")
        .split("|")
        .map((opt) => opt.trim())
        .filter(Boolean);
      const tags = parseListText(record.tags || "");
      const abilities = parseListText(record.abilities || "");
      let knowledgePointId = record.knowledgePointId;
      if (!knowledgePointId && record.knowledgePointTitle) {
        const kp = knowledgePoints.find(
          (item) => item.title === record.knowledgePointTitle && item.subject === record.subject
        );
        knowledgePointId = kp?.id ?? "";
      }
      if (!knowledgePointId) {
        errors.push(`第 ${i + 1} 行：找不到知识点`);
        continue;
      }
      items.push({
        subject: record.subject,
        grade: record.grade,
        knowledgePointId,
        stem: record.stem,
        options,
        answer: record.answer,
        explanation: record.explanation,
        difficulty: record.difficulty,
        questionType: record.questionType,
        tags,
        abilities
      });
    }

    if (!items.length) {
      setImportErrors(errors.length ? errors : ["没有可导入的题目"]);
      return;
    }

    const res = await fetch("/api/admin/questions/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items })
    });
    const data = await res.json();
    if (!res.ok) {
      setImportErrors([data?.error ?? "导入失败"]);
      return;
    }
    const highRiskCount = (data.items ?? []).filter(
      (item: any) => item.duplicateRisk === "high" || item.ambiguityRisk === "high"
    ).length;
    setImportMessage(
      `已导入 ${data.created} 题，失败 ${data.failed?.length ?? 0} 条，高风险 ${highRiskCount} 题。`
    );
    setImportErrors(errors);
    loadQuestions();
  }

  async function handleGenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAiMessage(null);
    setAiErrors([]);
    setAiLoading(true);

    const endpoint =
      aiForm.mode === "batch" ? "/api/admin/questions/generate-batch" : "/api/admin/questions/generate";

    const count = aiForm.mode === "batch" ? Math.max(aiForm.count, 10) : aiForm.count;
    const payload =
      aiForm.mode === "batch"
        ? {
            subject: aiForm.subject,
            grade: aiForm.grade,
            count,
            chapter: aiForm.chapter || undefined,
            difficulty: aiForm.difficulty
          }
        : {
            subject: aiForm.subject,
            grade: aiForm.grade,
            knowledgePointId: aiForm.knowledgePointId,
            count,
            difficulty: aiForm.difficulty
          };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      setAiErrors([data?.error ?? "生成失败"]);
      setAiLoading(false);
      return;
    }

    const failed = data.failed ?? [];
    if (failed.length) {
      setAiErrors(failed.map((item: any) => `第 ${item.index + 1} 题：${item.reason}`));
    }
    const highRiskCount = (data.created ?? []).filter(
      (item: any) => item.duplicateRisk === "high" || item.ambiguityRisk === "high"
    ).length;
    setAiMessage(`已生成 ${data.created?.length ?? 0} 题，高风险 ${highRiskCount} 题。`);
    setAiLoading(false);
    loadQuestions();
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const options = form.options
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    const tags = parseListText(form.tags);
    const abilities = parseListText(form.abilities);

    await fetch("/api/admin/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: form.subject,
        grade: form.grade,
        knowledgePointId: form.knowledgePointId,
        stem: form.stem,
        options,
        answer: form.answer,
        explanation: form.explanation,
        difficulty: form.difficulty,
        questionType: form.questionType,
        tags,
        abilities
      })
    });

    setForm({
      subject: form.subject,
      grade: form.grade,
      knowledgePointId: form.knowledgePointId,
      stem: "",
      options: "",
      answer: "",
      explanation: "",
      difficulty: form.difficulty,
      questionType: form.questionType,
      tags: "",
      abilities: ""
    });
    loadQuestions();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/questions/${id}`, { method: "DELETE" });
    loadQuestions();
  }

  async function handleToggleIsolation(id: string, isolated: boolean) {
    await fetch("/api/admin/questions/quality/isolation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId: id,
        isolated,
        reason: isolated ? ["管理员手动加入隔离池"] : ["管理员手动移出隔离池"]
      })
    });
    loadQuestions();
  }

  const pageStart = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const pageEnd = meta.total === 0 ? 0 : Math.min(meta.total, meta.page * meta.pageSize);

  return (
    <div className="grid">
      <div className="section-head">
        <div>
          <h2>题库管理</h2>
          <div className="section-sub">CSV 导入、AI 出题与题库维护。</div>
        </div>
        <span className="chip">管理端</span>
      </div>

      <div className="cta-row" style={{ marginTop: 0 }}>
        <button
          className={workspace === "list" ? "button secondary" : "button ghost"}
          type="button"
          onClick={() => setWorkspace("list")}
        >
          列表与分类
        </button>
        <button
          className={workspace === "tools" ? "button secondary" : "button ghost"}
          type="button"
          onClick={() => setWorkspace("tools")}
        >
          导入/生成/新增
        </button>
      </div>

      {workspace === "tools" ? (
        <QuestionsToolsPanel
          importMessage={importMessage}
          importErrors={importErrors}
          onDownloadTemplate={downloadQuestionTemplate}
          onImport={handleImport}
          aiForm={aiForm}
          setAiForm={setAiForm}
          aiKnowledgePoints={aiKnowledgePoints}
          chapterOptions={chapterOptions}
          aiLoading={aiLoading}
          aiMessage={aiMessage}
          aiErrors={aiErrors}
          onGenerate={handleGenerate}
          form={form}
          setForm={setForm}
          knowledgePoints={knowledgePoints}
          onCreate={handleCreate}
        />
      ) : null}

      {workspace === "list" ? (
        <QuestionsListPanel
          query={query}
          patchQuery={patchQuery}
          facets={facets}
          tree={tree}
          loading={loading}
          list={list}
          meta={meta}
          pageSize={pageSize}
          setPageSize={setPageSize}
          setPage={setPage}
          pageStart={pageStart}
          pageEnd={pageEnd}
          onDelete={handleDelete}
          onToggleIsolation={handleToggleIsolation}
        />
      ) : null}
    </div>
  );
}
