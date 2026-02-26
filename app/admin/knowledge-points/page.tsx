"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GRADE_OPTIONS, SUBJECT_LABELS, SUBJECT_OPTIONS } from "@/lib/constants";
import KnowledgePointsListPanel from "./_components/KnowledgePointsListPanel";
import KnowledgePointsToolsPanel from "./_components/KnowledgePointsToolsPanel";
import type {
  AiKnowledgePointForm,
  BatchForm,
  KnowledgePoint,
  KnowledgePointFacets,
  KnowledgePointForm,
  KnowledgePointListPayload,
  KnowledgePointQuery,
  KnowledgePointTreeNode,
  TreeForm
} from "./types";

export default function KnowledgePointsAdminPage() {
  const [list, setList] = useState<KnowledgePoint[]>([]);
  const [allKnowledgePoints, setAllKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [workspace, setWorkspace] = useState<"list" | "tools">("list");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState<KnowledgePointQuery>({
    subject: "all",
    grade: "all",
    unit: "all",
    chapter: "all",
    search: ""
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [meta, setMeta] = useState({ total: 0, page: 1, pageSize: 20, totalPages: 1 });
  const [tree, setTree] = useState<KnowledgePointTreeNode[]>([]);
  const [facets, setFacets] = useState<KnowledgePointFacets>({
    subjects: [],
    grades: [],
    units: [],
    chapters: []
  });
  const [form, setForm] = useState<KnowledgePointForm>({
    subject: "math",
    grade: "4",
    unit: "",
    title: "",
    chapter: ""
  });
  const [aiForm, setAiForm] = useState<AiKnowledgePointForm>({ subject: "math", grade: "4", chapter: "", count: 5 });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiErrors, setAiErrors] = useState<string[]>([]);
  const [treeForm, setTreeForm] = useState<TreeForm>({
    subject: "math",
    grade: "4",
    edition: "人教版",
    volume: "上册",
    unitCount: 6
  });
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeMessage, setTreeMessage] = useState<string | null>(null);
  const [treeErrors, setTreeErrors] = useState<string[]>([]);
  const [batchForm, setBatchForm] = useState<BatchForm>({
    subjects: SUBJECT_OPTIONS.map((item) => item.value),
    grades: GRADE_OPTIONS.map((item) => item.value),
    edition: "人教版",
    volume: "上册",
    unitCount: 6,
    chaptersPerUnit: 2,
    pointsPerChapter: 4
  });
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchPreview, setBatchPreview] = useState<any[]>([]);
  const [batchConfirming, setBatchConfirming] = useState(false);
  const [batchShowDetail, setBatchShowDetail] = useState(false);

  const chapterOptions = useMemo(() => {
    const filtered = allKnowledgePoints.filter(
      (kp) => kp.subject === aiForm.subject && kp.grade === aiForm.grade
    );
    const chapters = filtered.map((kp) => kp.chapter).filter(Boolean);
    return Array.from(new Set(chapters));
  }, [allKnowledgePoints, aiForm.subject, aiForm.grade]);

  const loadAllKnowledgePoints = useCallback(async () => {
    const res = await fetch("/api/admin/knowledge-points");
    const data = await res.json();
    setAllKnowledgePoints(data.data ?? []);
  }, []);

  const loadKnowledgePointList = useCallback(async () => {
    setLoading(true);
    const searchParams = new URLSearchParams();
    if (query.subject !== "all") searchParams.set("subject", query.subject);
    if (query.grade !== "all") searchParams.set("grade", query.grade);
    if (query.unit !== "all") searchParams.set("unit", query.unit);
    if (query.chapter !== "all") searchParams.set("chapter", query.chapter);
    if (query.search.trim()) searchParams.set("search", query.search.trim());
    searchParams.set("page", String(page));
    searchParams.set("pageSize", String(pageSize));

    const res = await fetch(`/api/admin/knowledge-points?${searchParams.toString()}`);
    const data = (await res.json()) as KnowledgePointListPayload;
    setList(data.data ?? []);
    setMeta(
      data.meta ?? {
        total: data.data?.length ?? 0,
        page,
        pageSize,
        totalPages: 1
      }
    );
    setTree(data.tree ?? []);
    setFacets({
      subjects: data.facets?.subjects ?? [],
      grades: data.facets?.grades ?? [],
      units: data.facets?.units ?? [],
      chapters: data.facets?.chapters ?? []
    });
    setLoading(false);
  }, [page, pageSize, query]);

  useEffect(() => {
    loadAllKnowledgePoints();
  }, [loadAllKnowledgePoints]);

  useEffect(() => {
    loadKnowledgePointList();
  }, [loadKnowledgePointList]);

  useEffect(() => {
    if (!aiForm.chapter && chapterOptions.length) {
      setAiForm((prev) => ({ ...prev, chapter: chapterOptions[0] }));
    }
  }, [aiForm.chapter, chapterOptions]);

  function patchQuery(next: Partial<KnowledgePointQuery>) {
    setQuery((prev) => ({ ...prev, ...next }));
    setPage(1);
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await fetch("/api/admin/knowledge-points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    setForm((prev) => ({ ...prev, title: "", chapter: "" }));
    await Promise.all([loadAllKnowledgePoints(), loadKnowledgePointList()]);
  }

  async function handleAiGenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAiLoading(true);
    setAiMessage(null);
    setAiErrors([]);

    const res = await fetch("/api/admin/knowledge-points/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: aiForm.subject,
        grade: aiForm.grade,
        chapter: aiForm.chapter || undefined,
        count: aiForm.count
      })
    });

    const data = await res.json();
    if (!res.ok) {
      setAiErrors([data?.error ?? "生成失败"]);
      setAiLoading(false);
      return;
    }

    const skipped = data.skipped ?? [];
    if (skipped.length) {
      setAiErrors(skipped.map((item: any) => `第 ${item.index + 1} 条：${item.reason}`));
    }
    setAiMessage(`已生成 ${data.created?.length ?? 0} 条知识点。`);
    setAiLoading(false);
    await Promise.all([loadAllKnowledgePoints(), loadKnowledgePointList()]);
  }

  async function handleTreeGenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTreeLoading(true);
    setTreeMessage(null);
    setTreeErrors([]);

    const res = await fetch("/api/admin/knowledge-points/generate-tree", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: treeForm.subject,
        grade: treeForm.grade,
        edition: treeForm.edition,
        volume: treeForm.volume,
        unitCount: treeForm.unitCount
      })
    });

    const data = await res.json();
    if (!res.ok) {
      setTreeErrors([data?.error ?? "生成失败"]);
      setTreeLoading(false);
      return;
    }

    const skipped = data.skipped ?? [];
    if (skipped.length) {
      setTreeErrors(skipped.slice(0, 5).map((item: any) => `第 ${item.index + 1} 条：${item.reason}`));
    }
    setTreeMessage(`已生成 ${data.created?.length ?? 0} 条知识点。`);
    setTreeLoading(false);
    await Promise.all([loadAllKnowledgePoints(), loadKnowledgePointList()]);
  }

  async function handleBatchPreview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBatchLoading(true);
    setBatchError(null);
    setBatchPreview([]);

    const res = await fetch("/api/admin/knowledge-points/preview-tree-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjects: batchForm.subjects,
        grades: batchForm.grades,
        edition: batchForm.edition,
        volume: batchForm.volume,
        unitCount: batchForm.unitCount,
        chaptersPerUnit: batchForm.chaptersPerUnit,
        pointsPerChapter: batchForm.pointsPerChapter
      })
    });

    const data = await res.json();
    if (!res.ok) {
      setBatchError(data?.error ?? "生成预览失败");
      setBatchLoading(false);
      return;
    }

    if (data.failed?.length) {
      setBatchError(
        data.failed
          .map((item: any) => `${SUBJECT_LABELS[item.subject] ?? item.subject}${item.grade}年级：${item.reason}`)
          .join("；")
      );
    }
    setBatchPreview(data.items ?? []);
    setBatchLoading(false);
  }

  async function handleBatchConfirm() {
    if (!batchPreview.length) {
      setBatchError("请先生成预览");
      return;
    }
    setBatchConfirming(true);
    const res = await fetch("/api/admin/knowledge-points/import-tree", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: batchPreview })
    });
    const data = await res.json();
    if (!res.ok) {
      setBatchError(data?.error ?? "入库失败");
      setBatchConfirming(false);
      return;
    }
    setBatchError(`已入库 ${data.created?.length ?? 0} 条，跳过 ${data.skipped?.length ?? 0} 条。`);
    setBatchConfirming(false);
    await Promise.all([loadAllKnowledgePoints(), loadKnowledgePointList()]);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/knowledge-points/${id}`, { method: "DELETE" });
    await Promise.all([loadAllKnowledgePoints(), loadKnowledgePointList()]);
  }

  const pageStart = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const pageEnd = meta.total === 0 ? 0 : Math.min(meta.total, meta.page * meta.pageSize);

  return (
    <div className="grid">
      <div className="section-head">
        <div>
          <h2>知识点管理</h2>
          <div className="section-sub">批量生成、AI 生成与知识点维护。</div>
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
          生成与维护
        </button>
      </div>

      {workspace === "tools" ? (
        <KnowledgePointsToolsPanel
          batchForm={batchForm}
          setBatchForm={setBatchForm}
          batchLoading={batchLoading}
          batchError={batchError}
          batchPreview={batchPreview}
          batchShowDetail={batchShowDetail}
          setBatchShowDetail={setBatchShowDetail}
          batchConfirming={batchConfirming}
          onBatchPreview={handleBatchPreview}
          onBatchConfirm={handleBatchConfirm}
          onClearBatchPreview={() => setBatchPreview([])}
          treeForm={treeForm}
          setTreeForm={setTreeForm}
          treeLoading={treeLoading}
          treeMessage={treeMessage}
          treeErrors={treeErrors}
          onTreeGenerate={handleTreeGenerate}
          aiForm={aiForm}
          setAiForm={setAiForm}
          chapterOptions={chapterOptions}
          aiLoading={aiLoading}
          aiMessage={aiMessage}
          aiErrors={aiErrors}
          onAiGenerate={handleAiGenerate}
          form={form}
          setForm={setForm}
          onCreate={handleCreate}
        />
      ) : null}

      {workspace === "list" ? (
        <KnowledgePointsListPanel
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
        />
      ) : null}
    </div>
  );
}
