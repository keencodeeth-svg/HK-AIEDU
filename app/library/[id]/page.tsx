"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import LibraryReader from "@/components/LibraryReader";
import { SUBJECT_LABELS } from "@/lib/constants";

type LibraryItem = {
  id: string;
  title: string;
  description?: string;
  contentType: "textbook" | "courseware" | "lesson_plan";
  subject: string;
  grade: string;
  sourceType: "file" | "link" | "text";
  fileName?: string;
  mimeType?: string;
  contentBase64?: string;
  linkUrl?: string;
  textContent?: string;
  knowledgePointIds: string[];
  extractedKnowledgePoints: string[];
  accessScope: "global" | "class";
  createdAt: string;
};

type Annotation = {
  id: string;
  userId: string;
  quote: string;
  startOffset?: number;
  endOffset?: number;
  color?: string;
  note?: string;
  createdAt: string;
};

export default function LibraryDetailPage({ params }: { params: { id: string } }) {
  const [item, setItem] = useState<LibraryItem | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [user, setUser] = useState<any>(null);
  const [knowledgePoints, setKnowledgePoints] = useState<any[]>([]);
  const [selectedKpIds, setSelectedKpIds] = useState<string[]>([]);
  const [quote, setQuote] = useState("");
  const [note, setNote] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [itemRes, annoRes, meRes, kpRes] = await Promise.all([
      fetch(`/api/library/${params.id}`),
      fetch(`/api/library/${params.id}/annotations`),
      fetch("/api/auth/me"),
      fetch("/api/knowledge-points")
    ]);
    const itemPayload = await itemRes.json();
    const annoPayload = await annoRes.json();
    const mePayload = await meRes.json();
    const kpPayload = await kpRes.json();

    if (!itemRes.ok) {
      setError(itemPayload?.error ?? "加载失败");
      return;
    }

    const nextItem = itemPayload?.data ?? null;
    setItem(nextItem);
    setSelectedKpIds(nextItem?.knowledgePointIds ?? []);
    setAnnotations(annoPayload?.data ?? []);
    setUser(mePayload?.data ?? null);
    setKnowledgePoints(kpPayload?.data ?? []);
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredKps = useMemo(() => {
    if (!item) return [];
    return knowledgePoints.filter((kp) => kp.subject === item.subject && kp.grade === item.grade);
  }, [item, knowledgePoints]);

  function tryCaptureSelection() {
    const selected = window.getSelection()?.toString().trim() ?? "";
    if (!selected) return;
    const offset = item?.textContent ? item.textContent.indexOf(selected) : -1;
    setQuote(selected);
    setMessage(offset >= 0 ? `已捕获选中片段（${offset}-${offset + selected.length}）` : "已捕获选中片段");
  }

  async function submitAnnotation(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    if (!quote.trim()) {
      setError("请填写或选中标注片段");
      return;
    }
    const start = item?.textContent ? item.textContent.indexOf(quote.trim()) : -1;
    const end = start >= 0 ? start + quote.trim().length : undefined;
    const res = await fetch(`/api/library/${params.id}/annotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quote: quote.trim(),
        startOffset: start >= 0 ? start : undefined,
        endOffset: end,
        note: note.trim() || undefined
      })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error ?? "保存标注失败");
      return;
    }
    setQuote("");
    setNote("");
    setMessage("标注已保存");
    await load();
  }

  async function createShare() {
    setMessage(null);
    setError(null);
    const res = await fetch(`/api/library/${params.id}/share`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error ?? "生成分享链接失败");
      return;
    }
    setShareUrl(data?.data?.shareUrl ?? "");
    setMessage("分享链接已生成");
  }

  async function saveKnowledgePoints() {
    setMessage(null);
    setError(null);
    const res = await fetch(`/api/library/${params.id}/knowledge-points`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        knowledgePointIds: selectedKpIds
      })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error ?? "更新知识点失败");
      return;
    }
    setMessage("知识点修正已保存");
    await load();
  }

  if (error) {
    return <Card title="资料阅读">{error}</Card>;
  }
  if (!item) {
    return <Card title="资料阅读">加载中...</Card>;
  }

  const canEditKp = user?.role === "admin" || user?.role === "teacher";

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>{item.title}</h2>
          <div className="section-sub">
            {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级 ·{" "}
            {item.contentType === "textbook" ? "教材" : item.contentType === "courseware" ? "课件" : "教案"}
          </div>
        </div>
        <span className="chip">{item.accessScope === "global" ? "全局" : "班级"}</span>
      </div>

      <Card title="阅读内容" tag="查看">
        <LibraryReader item={item} onTextSelection={tryCaptureSelection} />
        <div className="cta-row" style={{ marginTop: 12 }}>
          <button className="button ghost" type="button" onClick={createShare}>
            生成分享链接
          </button>
          {shareUrl ? (
            <a className="button secondary" href={shareUrl} target="_blank" rel="noreferrer">
              打开分享页
            </a>
          ) : null}
        </div>
      </Card>

      <Card title="阅读标注" tag="标注">
        <form onSubmit={submitAnnotation} style={{ display: "grid", gap: 10 }}>
          <label>
            <div className="section-title">标注片段</div>
            <textarea
              rows={3}
              value={quote}
              onChange={(event) => setQuote(event.target.value)}
              placeholder="可手动填写，或在上方选中文本自动带入"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <label>
            <div className="section-title">备注</div>
            <textarea
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="写下你的理解或问题"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <button className="button primary" type="submit">
            保存标注
          </button>
        </form>
        <div className="grid" style={{ gap: 8, marginTop: 12 }}>
          {annotations.map((anno) => (
            <div className="card" key={anno.id}>
              <div style={{ fontWeight: 600 }}>{anno.quote}</div>
              {anno.note ? <div style={{ marginTop: 6 }}>{anno.note}</div> : null}
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-1)" }}>
                {new Date(anno.createdAt).toLocaleString("zh-CN")}
              </div>
            </div>
          ))}
          {!annotations.length ? <p>暂无标注。</p> : null}
        </div>
      </Card>

      <Card title="知识点提取与修正" tag="知识点">
        <div style={{ fontSize: 13, color: "var(--ink-1)" }}>
          AI 提取：{item.extractedKnowledgePoints?.length ? item.extractedKnowledgePoints.join("、") : "暂无"}
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: "var(--ink-1)" }}>
          当前绑定：{item.knowledgePointIds?.length ? item.knowledgePointIds.join("、") : "暂无"}
        </div>
        {canEditKp ? (
          <div style={{ marginTop: 10 }}>
            <div className="section-title">人工修正（多选）</div>
            <select
              multiple
              value={selectedKpIds}
              onChange={(event) =>
                setSelectedKpIds(Array.from(event.target.selectedOptions).map((opt) => opt.value))
              }
              style={{ width: "100%", height: 180, padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              {filteredKps.map((kp) => (
                <option key={kp.id} value={kp.id}>
                  {kp.chapter} · {kp.title}
                </option>
              ))}
            </select>
            <div className="cta-row" style={{ marginTop: 10 }}>
              <button className="button primary" type="button" onClick={saveKnowledgePoints}>
                保存修正
              </button>
            </div>
          </div>
        ) : (
          <p style={{ marginTop: 8 }}>当前账号仅可查看提取结果。</p>
        )}
      </Card>

      {message ? <div style={{ color: "#027a48", fontSize: 13 }}>{message}</div> : null}
      {shareUrl ? (
        <div className="card">
          <div className="section-title">分享链接</div>
          <div style={{ wordBreak: "break-all", fontSize: 13 }}>{shareUrl}</div>
        </div>
      ) : null}
    </div>
  );
}
