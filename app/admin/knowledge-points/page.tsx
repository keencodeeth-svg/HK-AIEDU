"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import { GRADE_OPTIONS, SUBJECT_LABELS, SUBJECT_OPTIONS } from "@/lib/constants";

type KnowledgePoint = {
  id: string;
  subject: string;
  grade: string;
  title: string;
  chapter: string;
  unit?: string;
};

type FacetItem = { value: string; count: number };

type KnowledgePointTreeNode = {
  subject: string;
  count: number;
  grades: Array<{
    grade: string;
    count: number;
    units: Array<{ unit: string; count: number }>;
  }>;
};

type KnowledgePointListPayload = {
  data?: KnowledgePoint[];
  meta?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  facets?: {
    subjects?: FacetItem[];
    grades?: FacetItem[];
    units?: FacetItem[];
    chapters?: FacetItem[];
  };
  tree?: KnowledgePointTreeNode[];
};

export default function KnowledgePointsAdminPage() {
  const [list, setList] = useState<KnowledgePoint[]>([]);
  const [allKnowledgePoints, setAllKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState({
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
  const [facets, setFacets] = useState<{
    subjects: FacetItem[];
    grades: FacetItem[];
    units: FacetItem[];
    chapters: FacetItem[];
  }>({
    subjects: [],
    grades: [],
    units: [],
    chapters: []
  });
  const [form, setForm] = useState({
    subject: "math",
    grade: "4",
    unit: "",
    title: "",
    chapter: ""
  });
  const [aiForm, setAiForm] = useState({ subject: "math", grade: "4", chapter: "", count: 5 });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiErrors, setAiErrors] = useState<string[]>([]);
  const [treeForm, setTreeForm] = useState({
    subject: "math",
    grade: "4",
    edition: "人教版",
    volume: "上册",
    unitCount: 6
  });
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeMessage, setTreeMessage] = useState<string | null>(null);
  const [treeErrors, setTreeErrors] = useState<string[]>([]);
  const [batchForm, setBatchForm] = useState({
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

  function patchQuery(next: Partial<typeof query>) {
    setQuery((prev) => ({ ...prev, ...next }));
    setPage(1);
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    await fetch("/api/admin/knowledge-points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    setForm({ ...form, title: "", chapter: "" });
    await Promise.all([loadAllKnowledgePoints(), loadKnowledgePointList()]);
  }

  async function handleAiGenerate(event: React.FormEvent) {
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

  async function handleTreeGenerate(event: React.FormEvent) {
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

  async function handleBatchPreview(event: React.FormEvent) {
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

      <div className="grid grid-2" style={{ alignItems: "start" }}>
      <Card title="批量生成全学科/全年级（预览后确认）" tag="批量">
        <p style={{ color: "var(--ink-1)", fontSize: 13 }}>
          先生成预览，再确认入库。支持控制单元/章节/知识点数量模板。
        </p>
        <form onSubmit={handleBatchPreview} className="compact-form" style={{ marginTop: 12 }}>
          <div className="grid grid-3">
            <label>
              <div className="section-title">学科</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {SUBJECT_OPTIONS.map((subject) => (
                  <label key={subject.value} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={batchForm.subjects.includes(subject.value)}
                      onChange={(event) => {
                        setBatchForm((prev) => ({
                          ...prev,
                          subjects: event.target.checked
                            ? [...prev.subjects, subject.value]
                            : prev.subjects.filter((item) => item !== subject.value)
                        }));
                      }}
                    />
                    {subject.label}
                  </label>
                ))}
              </div>
            </label>
            <label>
              <div className="section-title">年级</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {GRADE_OPTIONS.map((grade) => (
                  <label key={grade.value} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={batchForm.grades.includes(grade.value)}
                      onChange={(event) => {
                        setBatchForm((prev) => ({
                          ...prev,
                          grades: event.target.checked
                            ? [...prev.grades, grade.value]
                            : prev.grades.filter((item) => item !== grade.value)
                        }));
                      }}
                    />
                    {grade.label}
                  </label>
                ))}
              </div>
            </label>
            <label>
              <div className="section-title">册次</div>
              <select
                value={batchForm.volume}
                onChange={(event) => setBatchForm({ ...batchForm, volume: event.target.value })}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              >
                <option value="上册">上册</option>
                <option value="下册">下册</option>
                <option value="全册">全册</option>
              </select>
            </label>
          </div>
          <div className="grid grid-3">
            <label>
              <div className="section-title">单元数量</div>
              <input
                type="number"
                min={1}
                max={12}
                value={batchForm.unitCount}
                onChange={(event) => setBatchForm({ ...batchForm, unitCount: Number(event.target.value) })}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              />
            </label>
            <label>
              <div className="section-title">每单元章节数</div>
              <input
                type="number"
                min={1}
                max={4}
                value={batchForm.chaptersPerUnit}
                onChange={(event) => setBatchForm({ ...batchForm, chaptersPerUnit: Number(event.target.value) })}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              />
            </label>
            <label>
              <div className="section-title">每章知识点数</div>
              <input
                type="number"
                min={2}
                max={8}
                value={batchForm.pointsPerChapter}
                onChange={(event) => setBatchForm({ ...batchForm, pointsPerChapter: Number(event.target.value) })}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              />
            </label>
          </div>
          <button className="button primary" type="submit" disabled={batchLoading}>
            {batchLoading ? "生成中..." : "生成预览"}
          </button>
        </form>
        {batchError ? <div style={{ marginTop: 8, color: "#b42318" }}>{batchError}</div> : null}
        {batchPreview.length ? (
          <div style={{ marginTop: 16 }}>
            <div className="section-title">预览结果</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={batchShowDetail}
                  onChange={(event) => setBatchShowDetail(event.target.checked)}
                />
                展示章节/知识点详情
              </label>
            </div>
            <div className="grid" style={{ gap: 10 }}>
              {batchPreview.map((item) => (
                <div className="card" key={`${item.subject}-${item.grade}`}>
                  <div className="section-title">
                    {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
                  </div>
                  {item.units?.slice(0, 3).map((unit: any) => (
                    <div key={unit.title} style={{ marginTop: 8 }}>
                      <div style={{ fontWeight: 600 }}>{unit.title}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                        章节数：{unit.chapters?.length ?? 0}
                      </div>
                      {batchShowDetail ? (
                        <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                          {unit.chapters?.map((chapter: any) => (
                            <div className="card" key={`${unit.title}-${chapter.title}`}>
                              <div style={{ fontWeight: 600 }}>{chapter.title}</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                                {chapter.points?.map((point: any) => (
                                  <span className="badge" key={`${unit.title}-${chapter.title}-${point.title}`}>
                                    {point.title}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {item.units?.length > 3 ? (
                    <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                      … 共 {item.units.length} 个单元
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="cta-row">
              <button className="button secondary" type="button" onClick={() => setBatchPreview([])}>
                清空预览
              </button>
              <button className="button primary" type="button" onClick={handleBatchConfirm} disabled={batchConfirming}>
                {batchConfirming ? "入库中..." : "确认入库"}
              </button>
            </div>
          </div>
        ) : null}
      </Card>
      <Card title="AI 生成知识点树（整本书）" tag="树形">
        <p style={{ color: "var(--ink-1)", fontSize: 13 }}>
          按“单元 → 章节 → 知识点”生成整本书结构（建议先执行该功能）。
        </p>
        <form onSubmit={handleTreeGenerate} className="compact-form" style={{ marginTop: 12 }}>
          <label>
            <div className="section-title">学科</div>
            <select
              value={treeForm.subject}
              onChange={(event) => setTreeForm({ ...treeForm, subject: event.target.value })}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              {SUBJECT_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="section-title">年级</div>
            <select
              value={treeForm.grade}
              onChange={(event) => setTreeForm({ ...treeForm, grade: event.target.value })}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              {GRADE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="section-title">教材版本</div>
            <input
              value={treeForm.edition}
              onChange={(event) => setTreeForm({ ...treeForm, edition: event.target.value })}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <label>
            <div className="section-title">册次</div>
            <select
              value={treeForm.volume}
              onChange={(event) => setTreeForm({ ...treeForm, volume: event.target.value })}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              <option value="上册">上册</option>
              <option value="下册">下册</option>
              <option value="全册">全册</option>
            </select>
          </label>
          <label>
            <div className="section-title">单元数量（1-12）</div>
            <input
              type="number"
              min={1}
              max={12}
              value={treeForm.unitCount}
              onChange={(event) => setTreeForm({ ...treeForm, unitCount: Number(event.target.value) })}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <button className="button primary" type="submit" disabled={treeLoading}>
            {treeLoading ? "生成中..." : "生成知识点树"}
          </button>
        </form>
        {treeMessage ? <div style={{ marginTop: 8 }}>{treeMessage}</div> : null}
        {treeErrors.length ? (
          <div style={{ marginTop: 8, color: "#b42318", fontSize: 13 }}>
            {treeErrors.map((err) => (
              <div key={err}>{err}</div>
            ))}
          </div>
        ) : null}
      </Card>
      <Card title="AI 生成知识点" tag="AI">
        <p style={{ color: "var(--ink-1)", fontSize: 13 }}>
          需要配置 LLM（如智谱），系统会按学科/年级生成知识点。
        </p>
        <form onSubmit={handleAiGenerate} className="compact-form" style={{ marginTop: 12 }}>
          <label>
            <div className="section-title">学科</div>
            <select
              value={aiForm.subject}
              onChange={(event) => setAiForm({ ...aiForm, subject: event.target.value })}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              {SUBJECT_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="section-title">年级</div>
            <select
              value={aiForm.grade}
              onChange={(event) => setAiForm({ ...aiForm, grade: event.target.value })}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              {GRADE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="section-title">章节（可选）</div>
            <select
              value={aiForm.chapter}
              onChange={(event) => setAiForm({ ...aiForm, chapter: event.target.value })}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              <option value="">不指定</option>
              {chapterOptions.map((chapter) => (
                <option value={chapter} key={chapter}>
                  {chapter}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="section-title">生成数量（1-10）</div>
            <input
              type="number"
              min={1}
              max={10}
              value={aiForm.count}
              onChange={(event) => setAiForm({ ...aiForm, count: Number(event.target.value) })}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <button className="button primary" type="submit" disabled={aiLoading}>
            {aiLoading ? "生成中..." : "开始生成"}
          </button>
        </form>
        {aiMessage ? <div style={{ marginTop: 8 }}>{aiMessage}</div> : null}
        {aiErrors.length ? (
          <div style={{ marginTop: 8, color: "#b42318", fontSize: 13 }}>
            {aiErrors.slice(0, 5).map((err) => (
              <div key={err}>{err}</div>
            ))}
          </div>
        ) : null}
      </Card>
      <Card title="新增知识点" tag="新增">
        <form onSubmit={handleCreate} className="compact-form">
          <label>
            <div className="section-title">学科</div>
            <select
              value={form.subject}
              onChange={(event) => setForm({ ...form, subject: event.target.value })}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              {SUBJECT_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="section-title">年级</div>
            <select
              value={form.grade}
              onChange={(event) => setForm({ ...form, grade: event.target.value })}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              {GRADE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="section-title">单元</div>
            <input
              value={form.unit}
              onChange={(event) => setForm({ ...form, unit: event.target.value })}
              placeholder="如：第一单元"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <label>
            <div className="section-title">知识点名称</div>
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <label>
            <div className="section-title">章节</div>
            <input
              value={form.chapter}
              onChange={(event) => setForm({ ...form, chapter: event.target.value })}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <button className="button primary" type="submit">
            保存
          </button>
        </form>
      </Card>
      </div>

      <Card title="知识点列表（分类筛选）" tag="列表">
        <div className="grid grid-3" style={{ gap: 10, alignItems: "end" }}>
          <label>
            <div className="section-title">搜索</div>
            <input
              value={query.search}
              onChange={(event) => patchQuery({ search: event.target.value })}
              placeholder="知识点 / 章节 / 单元"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <label>
            <div className="section-title">学科</div>
            <select
              value={query.subject}
              onChange={(event) => patchQuery({ subject: event.target.value, grade: "all", unit: "all" })}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              <option value="all">全部学科</option>
              {facets.subjects.map((item) => (
                <option key={item.value} value={item.value}>
                  {(SUBJECT_LABELS[item.value] ?? item.value) + ` (${item.count})`}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="section-title">年级</div>
            <select
              value={query.grade}
              onChange={(event) => patchQuery({ grade: event.target.value, unit: "all" })}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              <option value="all">全部年级</option>
              {facets.grades.map((item) => (
                <option key={item.value} value={item.value}>
                  {`${item.value} 年级 (${item.count})`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-3" style={{ gap: 10, alignItems: "end", marginTop: 10 }}>
          <label>
            <div className="section-title">单元</div>
            <select
              value={query.unit}
              onChange={(event) => patchQuery({ unit: event.target.value })}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              <option value="all">全部单元</option>
              {facets.units.map((item) => (
                <option key={item.value} value={item.value}>
                  {`${item.value} (${item.count})`}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="section-title">章节</div>
            <select
              value={query.chapter}
              onChange={(event) => patchQuery({ chapter: event.target.value })}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              <option value="all">全部章节</option>
              {facets.chapters.map((item) => (
                <option key={item.value} value={item.value}>
                  {`${item.value} (${item.count})`}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span className="section-title" style={{ marginBottom: 0 }}>
              每页
            </span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>
        </div>

        <div className="cta-row" style={{ marginTop: 10 }}>
          <button
            className="button ghost"
            type="button"
            onClick={() =>
              patchQuery({
                subject: "all",
                grade: "all",
                unit: "all",
                chapter: "all",
                search: ""
              })
            }
          >
            清空筛选
          </button>
        </div>

        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12
          }}
        >
          <div className="card" style={{ padding: 14 }}>
            <div className="section-title" style={{ marginTop: 0 }}>
              分类树
            </div>
            <button
              className="button ghost"
              type="button"
              onClick={() => patchQuery({ subject: "all", grade: "all", unit: "all" })}
              style={{ width: "100%", justifyContent: "space-between" }}
            >
              全部知识点
              <span>{meta.total}</span>
            </button>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {tree.map((subjectNode) => (
                <div key={subjectNode.subject} className="card" style={{ padding: 10 }}>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => patchQuery({ subject: subjectNode.subject, grade: "all", unit: "all" })}
                    style={{ width: "100%", justifyContent: "space-between" }}
                  >
                    {SUBJECT_LABELS[subjectNode.subject] ?? subjectNode.subject}
                    <span>{subjectNode.count}</span>
                  </button>
                  <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                    {subjectNode.grades.map((gradeNode) => (
                      <div key={`${subjectNode.subject}-${gradeNode.grade}`}>
                        <button
                          className="button ghost"
                          type="button"
                          onClick={() =>
                            patchQuery({ subject: subjectNode.subject, grade: gradeNode.grade, unit: "all" })
                          }
                          style={{ width: "100%", justifyContent: "space-between", padding: "8px 12px" }}
                        >
                          {gradeNode.grade} 年级
                          <span>{gradeNode.count}</span>
                        </button>
                        <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {gradeNode.units.slice(0, 6).map((unitNode) => (
                            <button
                              key={`${subjectNode.subject}-${gradeNode.grade}-${unitNode.unit}`}
                              className="badge"
                              type="button"
                              onClick={() =>
                                patchQuery({
                                  subject: subjectNode.subject,
                                  grade: gradeNode.grade,
                                  unit: unitNode.unit
                                })
                              }
                              style={{ border: "none", cursor: "pointer" }}
                            >
                              {unitNode.unit} · {unitNode.count}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="dense-list">
            {loading ? <p>加载中...</p> : null}
            {!loading && list.length === 0 ? (
              <div className="card">
                <div className="section-title" style={{ marginTop: 0 }}>
                  暂无结果
                </div>
                <div style={{ color: "var(--ink-1)", fontSize: 13 }}>请调整筛选条件后重试。</div>
              </div>
            ) : null}
            {list.map((item) => (
              <div className="card" key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div className="section-title">{item.title}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                    {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级 · {item.unit ?? "未分单元"} ·{" "}
                    {item.chapter}
                  </div>
                </div>
                <button className="button secondary" onClick={() => handleDelete(item.id)}>
                  删除
                </button>
              </div>
            ))}

            <div className="card" style={{ padding: 14 }}>
              <div className="cta-row" style={{ marginTop: 0, justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                  共 {meta.total} 条，当前 {pageStart}-{pageEnd}
                </div>
                <div className="cta-row" style={{ marginTop: 0 }}>
                  <button
                    className="button ghost"
                    type="button"
                    disabled={meta.page <= 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    上一页
                  </button>
                  <span className="badge">
                    第 {meta.page}/{Math.max(meta.totalPages, 1)} 页
                  </span>
                  <button
                    className="button ghost"
                    type="button"
                    disabled={meta.page >= meta.totalPages}
                    onClick={() => setPage((prev) => Math.min(meta.totalPages, prev + 1))}
                  >
                    下一页
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
