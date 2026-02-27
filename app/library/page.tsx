"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { SUBJECT_LABELS } from "@/lib/constants";

type LibraryItem = {
  id: string;
  title: string;
  description?: string;
  contentType: "textbook" | "courseware" | "lesson_plan";
  subject: string;
  grade: string;
  accessScope: "global" | "class";
  sourceType: "file" | "link" | "text";
  fileName?: string;
  mimeType?: string;
  contentBase64?: string;
  linkUrl?: string;
  textContent?: string;
  classId?: string;
  generatedByAi: boolean;
  createdAt: string;
  extractedKnowledgePoints: string[];
};

type ClassItem = {
  id: string;
  name: string;
  subject: string;
  grade: string;
};

type BatchImportSummary = {
  textbooksTotal: number;
  textbooksImported: number;
  textbooksFailed: number;
  questionsTotal: number;
  questionsImported: number;
  questionsFailed: number;
  knowledgePointsCreated: number;
};

function buildBatchImportTemplate() {
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

function contentTypeLabel(type: string) {
  if (type === "courseware") return "课件";
  if (type === "lesson_plan") return "教案";
  return "教材";
}

function toBase64(file: File) {
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

export default function LibraryPage() {
  const [user, setUser] = useState<any>(null);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [importForm, setImportForm] = useState({
    title: "",
    description: "",
    subject: "math",
    grade: "4",
    contentType: "textbook",
    sourceType: "file",
    textContent: "",
    linkUrl: ""
  });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [batchPreview, setBatchPreview] = useState<{
    textbooks: number;
    questions: number;
  } | null>(null);
  const [batchSummary, setBatchSummary] = useState<BatchImportSummary | null>(null);
  const [batchFailedPreview, setBatchFailedPreview] = useState<string[]>([]);

  const [aiForm, setAiForm] = useState({
    classId: "",
    topic: "",
    contentType: "lesson_plan"
  });
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [contentFilter, setContentFilter] = useState<"all" | "textbook" | "courseware" | "lesson_plan">("all");
  const [keyword, setKeyword] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/library", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "资料加载失败");
        return;
      }
      setItems(data.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setUser(data?.data ?? null));
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (user?.role === "teacher") {
      fetch("/api/teacher/classes")
        .then((res) => res.json())
        .then((data) => {
          const list = data.data ?? [];
          setClasses(list);
          if (!aiForm.classId && list.length) {
            setAiForm((prev) => ({ ...prev, classId: list[0].id }));
          }
        });
    }
  }, [aiForm.classId, user?.role]);

  useEffect(() => {
    if (importForm.contentType === "textbook" && importForm.sourceType !== "file") {
      setImportForm((prev) => ({
        ...prev,
        sourceType: "file",
        textContent: "",
        linkUrl: ""
      }));
    }
  }, [importForm.contentType, importForm.sourceType]);

  const subjectList = useMemo(() => {
    const keys = Array.from(new Set(items.map((item) => item.subject)));
    return keys.sort((a, b) => {
      const left = SUBJECT_LABELS[a] ?? a;
      const right = SUBJECT_LABELS[b] ?? b;
      return left.localeCompare(right, "zh-CN");
    });
  }, [items]);

  const filteredItems = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return items
      .filter((item) => (subjectFilter === "all" ? true : item.subject === subjectFilter))
      .filter((item) => (contentFilter === "all" ? true : item.contentType === contentFilter))
      .filter((item) => {
        if (!kw) return true;
        return `${item.title} ${item.description ?? ""}`.toLowerCase().includes(kw);
      });
  }, [contentFilter, items, keyword, subjectFilter]);

  const grouped = useMemo(() => {
    return {
      textbook: filteredItems.filter((item) => item.contentType === "textbook"),
      courseware: filteredItems.filter((item) => item.contentType === "courseware"),
      lessonPlan: filteredItems.filter((item) => item.contentType === "lesson_plan")
    };
  }, [filteredItems]);

  const groupedBySubject = useMemo(() => {
    const bucket = new Map<string, LibraryItem[]>();
    filteredItems.forEach((item) => {
      const list = bucket.get(item.subject) ?? [];
      list.push(item);
      bucket.set(item.subject, list);
    });
    return Array.from(bucket.entries())
      .map(([subject, list]) => ({
        subject,
        label: SUBJECT_LABELS[subject] ?? subject,
        list: list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
  }, [filteredItems]);

  async function submitImport(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    if (user?.role !== "admin") return;

    if (importForm.contentType === "textbook" && importForm.sourceType !== "file") {
      setError("教材资源仅支持文件导入");
      return;
    }

    const payload: any = {
      ...importForm
    };

    if (importForm.sourceType === "file") {
      if (!importFile) {
        setError("请先选择文件");
        return;
      }
      const file = await toBase64(importFile);
      payload.fileName = file.fileName;
      payload.mimeType = file.mimeType;
      payload.size = file.size;
      payload.contentBase64 = file.base64;
      payload.textContent = "";
      payload.linkUrl = "";
    } else if (importForm.sourceType === "link") {
      if (!importForm.linkUrl.trim()) {
        setError("请填写链接");
        return;
      }
      payload.textContent = "";
    } else {
      if (!importForm.textContent.trim()) {
        setError("请填写教材内容");
        return;
      }
      payload.linkUrl = "";
    }

    const res = await fetch("/api/admin/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error ?? "导入失败");
      return;
    }
    setMessage("教材导入成功");
    setImportForm((prev) => ({ ...prev, title: "", description: "", textContent: "", linkUrl: "" }));
    setImportFile(null);
    await loadItems();
  }

  function downloadBatchTemplate() {
    const blob = new Blob([JSON.stringify(buildBatchImportTemplate(), null, 2)], {
      type: "application/json;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "full-curriculum-batch-template.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleBatchFileChange(file?: File | null) {
    setBatchFile(file ?? null);
    setBatchSummary(null);
    setBatchFailedPreview([]);
    if (!file) {
      setBatchPreview(null);
      return;
    }
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      setBatchPreview({
        textbooks: Array.isArray(json?.textbooks) ? json.textbooks.length : 0,
        questions: Array.isArray(json?.questions) ? json.questions.length : 0
      });
    } catch {
      setBatchPreview(null);
      setError("批量文件不是合法 JSON");
    }
  }

  async function submitBatchImport(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setBatchSummary(null);
    setBatchFailedPreview([]);
    if (user?.role !== "admin") return;
    if (!batchFile) {
      setError("请先上传批量 JSON 文件");
      return;
    }

    let payload: any = null;
    try {
      payload = JSON.parse(await batchFile.text());
    } catch {
      setError("批量文件解析失败，请检查 JSON 格式");
      return;
    }

    const res = await fetch("/api/admin/library/batch-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error ?? "批量导入失败");
      return;
    }

    const summary = data?.data?.summary ?? null;
    const textbookFailed = (data?.data?.textbooks?.failed ?? []).map(
      (item: any) => `教材#${Number(item.index) + 1}: ${item.reason}`
    );
    const questionFailed = (data?.data?.questions?.failed ?? []).map(
      (item: any) => `习题#${Number(item.index) + 1}: ${item.reason}`
    );
    setBatchSummary(summary);
    setBatchFailedPreview([...textbookFailed, ...questionFailed].slice(0, 20));
    setMessage("批量导入完成");
    await loadItems();
  }

  async function submitAiGenerate(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    if (user?.role !== "teacher") return;
    if (!aiForm.classId || !aiForm.topic.trim()) {
      setError("请先选择班级并填写主题");
      return;
    }

    const res = await fetch("/api/teacher/library/ai-generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(aiForm)
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error ?? "生成失败");
      return;
    }
    const citationCount = Array.isArray(data?.data?.citations) ? data.data.citations.length : 0;
    setMessage(citationCount ? `AI 资料已生成并发布（引用教材片段 ${citationCount} 条）` : "AI 资料已生成并发布");
    setAiForm((prev) => ({ ...prev, topic: "" }));
    await loadItems();
  }

  async function fetchLibraryItemDetail(id: string) {
    const res = await fetch(`/api/library/${id}`, { cache: "no-store" });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      setError(data?.error ?? "获取资料详情失败");
      return null;
    }
    return (data?.data as LibraryItem | null) ?? null;
  }

  function downloadText(item: LibraryItem) {
    const text = item.textContent ?? "";
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${item.title || "资料"}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function downloadItem(item: LibraryItem) {
    if (item.contentType === "textbook" && item.sourceType === "link") {
      setError("教材资源只支持文件，当前外链已禁用");
      return;
    }
    setError(null);
    let detail = item;

    if (item.sourceType === "text" || item.sourceType === "file") {
      const loaded = await fetchLibraryItemDetail(item.id);
      if (!loaded) return;
      detail = loaded;
    }

    if (detail.sourceType === "text") {
      if (!detail.textContent) {
        setError("文本内容为空或不可用");
        return;
      }
      downloadText(detail);
      return;
    }

    if (detail.sourceType === "file") {
      if (!detail.contentBase64) {
        setError("文件内容不可用，请稍后重试");
        return;
      }
      const href = `data:${detail.mimeType || "application/octet-stream"};base64,${detail.contentBase64}`;
      const a = document.createElement("a");
      a.href = href;
      a.download = detail.fileName || detail.title || "资料";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    if (detail.linkUrl) {
      window.open(detail.linkUrl, "_blank", "noopener,noreferrer");
      return;
    }

    setError("资料缺少可下载内容");
  }

  async function removeItem(item: LibraryItem) {
    if (user?.role !== "admin") return;
    const confirmed = window.confirm(`确认删除「${item.title}」吗？删除后不可恢复。`);
    if (!confirmed) return;

    setMessage(null);
    setError(null);
    setDeletingId(item.id);
    try {
      const res = await fetch(`/api/library/${item.id}`, { method: "DELETE" });
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (!res.ok) {
        if (res.status === 404) {
          setItems((prev) => prev.filter((entry) => entry.id !== item.id));
          setMessage("资料不存在或已删除");
          await loadItems();
          return;
        }
        setError(data?.error ?? "删除失败");
        return;
      }
      setItems((prev) => prev.filter((entry) => entry.id !== item.id));
      setMessage("资料已删除");
      await loadItems();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>教材与课件资料库</h2>
          <div className="section-sub">支持全局教材导入、AI 生成课件/教案、阅读与标注。</div>
        </div>
        <span className="chip">资料中心</span>
      </div>

      {user?.role === "admin" ? (
        <Card title="管理端导入教材" tag="管理">
          <form onSubmit={submitImport} style={{ display: "grid", gap: 12 }}>
            <label>
              <div className="section-title">标题</div>
              <input
                value={importForm.title}
                onChange={(event) => setImportForm((prev) => ({ ...prev, title: event.target.value }))}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              />
            </label>
            <label>
              <div className="section-title">简介</div>
              <textarea
                rows={2}
                value={importForm.description}
                onChange={(event) => setImportForm((prev) => ({ ...prev, description: event.target.value }))}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              />
            </label>
            <div className="grid grid-3">
              <label>
                <div className="section-title">学科</div>
                <select
                  value={importForm.subject}
                  onChange={(event) => setImportForm((prev) => ({ ...prev, subject: event.target.value }))}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                >
                  {Object.entries(SUBJECT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <div className="section-title">年级</div>
                <input
                  value={importForm.grade}
                  onChange={(event) => setImportForm((prev) => ({ ...prev, grade: event.target.value }))}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                />
              </label>
              <label>
                <div className="section-title">类型</div>
                <select
                  value={importForm.contentType}
                  onChange={(event) =>
                    setImportForm((prev) => {
                      const nextContentType = event.target.value;
                      if (nextContentType === "textbook") {
                        return {
                          ...prev,
                          contentType: nextContentType,
                          sourceType: "file",
                          textContent: "",
                          linkUrl: ""
                        };
                      }
                      return { ...prev, contentType: nextContentType };
                    })
                  }
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                >
                  <option value="textbook">教材</option>
                  <option value="courseware">课件</option>
                  <option value="lesson_plan">教案</option>
                </select>
              </label>
            </div>
            <label>
              <div className="section-title">导入方式</div>
              <select
                value={importForm.contentType === "textbook" ? "file" : importForm.sourceType}
                onChange={(event) => setImportForm((prev) => ({ ...prev, sourceType: event.target.value }))}
                disabled={importForm.contentType === "textbook"}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              >
                {importForm.contentType === "textbook" ? (
                  <option value="file">上传文件（教材必选）</option>
                ) : (
                  <>
                    <option value="text">粘贴文本</option>
                    <option value="file">上传文件</option>
                    <option value="link">外部链接</option>
                  </>
                )}
              </select>
            </label>
            {importForm.contentType === "textbook" ? (
              <div style={{ fontSize: 12, color: "var(--ink-1)" }}>教材仅支持文件导入，已禁用外链和文本录入。</div>
            ) : null}
            {importForm.sourceType === "text" && importForm.contentType !== "textbook" ? (
              <label>
                <div className="section-title">教材文本</div>
                <textarea
                  rows={6}
                  value={importForm.textContent}
                  onChange={(event) => setImportForm((prev) => ({ ...prev, textContent: event.target.value }))}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                />
              </label>
            ) : null}
            {importForm.sourceType === "file" ? (
              <label>
                <div className="section-title">上传文件</div>
                <input type="file" onChange={(event) => setImportFile(event.target.files?.[0] ?? null)} />
              </label>
            ) : null}
            {importForm.sourceType === "link" && importForm.contentType !== "textbook" ? (
              <label>
                <div className="section-title">链接地址</div>
                <input
                  value={importForm.linkUrl}
                  onChange={(event) => setImportForm((prev) => ({ ...prev, linkUrl: event.target.value }))}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                />
              </label>
            ) : null}
            <button className="button primary" type="submit">
              导入资料
            </button>
          </form>
        </Card>
      ) : null}

      {user?.role === "admin" ? (
        <Card title="全学科批量导入（教材+习题）" tag="批量">
          <div className="feature-card">
            <EduIcon name="board" />
            <p>上传 JSON 清单后，系统会批量导入教材并自动创建/质检配套习题。</p>
          </div>
          <div className="cta-row">
            <button className="button ghost" type="button" onClick={downloadBatchTemplate}>
              下载 JSON 模板
            </button>
          </div>
          <form onSubmit={submitBatchImport} style={{ display: "grid", gap: 12, marginTop: 10 }}>
            <label>
              <div className="section-title">上传批量 JSON</div>
              <input type="file" accept=".json,application/json" onChange={(event) => handleBatchFileChange(event.target.files?.[0] ?? null)} />
            </label>
            {batchPreview ? (
              <div className="card" style={{ fontSize: 12, color: "var(--ink-1)" }}>
                预览：教材 {batchPreview.textbooks} 条，习题 {batchPreview.questions} 条
              </div>
            ) : null}
            <button className="button primary" type="submit">
              开始批量导入
            </button>
          </form>
          {batchSummary ? (
            <div className="grid" style={{ gap: 8, marginTop: 12 }}>
              <div className="card">
                教材：{batchSummary.textbooksImported}/{batchSummary.textbooksTotal}，失败{" "}
                {batchSummary.textbooksFailed}
              </div>
              <div className="card">
                习题：{batchSummary.questionsImported}/{batchSummary.questionsTotal}，失败{" "}
                {batchSummary.questionsFailed}
              </div>
              <div className="card">自动创建知识点：{batchSummary.knowledgePointsCreated}</div>
              {batchFailedPreview.length ? (
                <div className="card">
                  <div className="section-title">失败样例（最多 20 条）</div>
                  <div className="grid" style={{ gap: 4, marginTop: 8 }}>
                    {batchFailedPreview.map((line, idx) => (
                      <div key={`${line}-${idx}`} style={{ fontSize: 12, color: "var(--ink-1)" }}>
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>
      ) : null}

      {user?.role === "teacher" ? (
        <Card title="AI 生成课件/教案" tag="AI">
          <div className="feature-card">
            <EduIcon name="brain" />
            <p>输入主题后自动生成，可直接给老师和学生查看。</p>
          </div>
          <form onSubmit={submitAiGenerate} style={{ display: "grid", gap: 12 }}>
            <label>
              <div className="section-title">班级</div>
              <select
                value={aiForm.classId}
                onChange={(event) => setAiForm((prev) => ({ ...prev, classId: event.target.value }))}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              >
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
                  </option>
                ))}
              </select>
            </label>
            <label>
              <div className="section-title">主题</div>
              <input
                value={aiForm.topic}
                onChange={(event) => setAiForm((prev) => ({ ...prev, topic: event.target.value }))}
                placeholder="例如：分数加减法综合复习"
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              />
            </label>
            <label>
              <div className="section-title">生成类型</div>
              <select
                value={aiForm.contentType}
                onChange={(event) => setAiForm((prev) => ({ ...prev, contentType: event.target.value }))}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              >
                <option value="lesson_plan">教案</option>
                <option value="courseware">课件</option>
              </select>
            </label>
            <button className="button primary" type="submit">
              AI 生成并发布
            </button>
          </form>
        </Card>
      ) : null}

      {error ? <div style={{ color: "#b42318", fontSize: 13 }}>{error}</div> : null}
      {message ? <div style={{ color: "#027a48", fontSize: 13 }}>{message}</div> : null}

      <Card title="分学科管理" tag="筛选">
        <div className="grid grid-3">
          <label>
            <div className="section-title">学科</div>
            <select
              value={subjectFilter}
              onChange={(event) => setSubjectFilter(event.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              <option value="all">全部学科</option>
              {subjectList.map((subject) => (
                <option key={subject} value={subject}>
                  {SUBJECT_LABELS[subject] ?? subject}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="section-title">类型</div>
            <select
              value={contentFilter}
              onChange={(event) =>
                setContentFilter(event.target.value as "all" | "textbook" | "courseware" | "lesson_plan")
              }
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              <option value="all">全部类型</option>
              <option value="textbook">教材</option>
              <option value="courseware">课件</option>
              <option value="lesson_plan">教案</option>
            </select>
          </label>
          <label>
            <div className="section-title">关键词</div>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="按标题或简介搜索"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 10 }}>
          当前筛选结果：共 {filteredItems.length} 条（教材 {grouped.textbook.length}，课件 {grouped.courseware.length}，教案{" "}
          {grouped.lessonPlan.length}）
        </div>
      </Card>

      <Card title="资料管理列表" tag="管理">
        {loading ? <p>加载中...</p> : null}
        {!loading ? (
          <div className="grid" style={{ gap: 14 }}>
            {groupedBySubject.map((group) => (
              <div className="card" key={group.subject}>
                <div className="section-title">
                  {group.label}（{group.list.length}）
                </div>
                <div className="grid" style={{ gap: 10, marginTop: 10 }}>
                  {group.list.map((item) => {
                    const textbookLinkBlocked = item.contentType === "textbook" && item.sourceType === "link";
                    return (
                      <div className="card" key={item.id}>
                        <div className="section-title">
                          {item.title} <span className="badge">{contentTypeLabel(item.contentType)}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 6 }}>
                          {item.grade} 年级 · 来源：
                          {item.sourceType === "file"
                            ? "文件上传"
                            : item.sourceType === "link"
                              ? textbookLinkBlocked
                                ? "外部链接（教材禁用）"
                                : "外部链接"
                              : "文本录入"}{" "}
                          · {item.generatedByAi ? "AI生成" : "人工上传"}
                        </div>
                        <div className="cta-row" style={{ marginTop: 10 }}>
                          <Link className="button ghost" href={`/library/${item.id}`}>
                            查看
                          </Link>
                          <button
                            className="button secondary"
                            type="button"
                            onClick={() => downloadItem(item)}
                            disabled={textbookLinkBlocked}
                          >
                            {textbookLinkBlocked ? "外链禁用" : item.sourceType === "link" ? "打开链接" : "下载"}
                          </button>
                          {user?.role === "admin" ? (
                            <button
                              className="button ghost"
                              style={{ borderColor: "#fecaca", color: "#b42318" }}
                              type="button"
                              onClick={() => removeItem(item)}
                              disabled={deletingId === item.id}
                            >
                              {deletingId === item.id ? "删除中..." : "删除"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {!groupedBySubject.length ? <p>当前筛选条件下暂无资料。</p> : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
