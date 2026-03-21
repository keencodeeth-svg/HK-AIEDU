"use client";

import Link from "next/link";
import Card from "@/components/Card";
import LibraryReader from "@/components/LibraryReader";
import StatePanel from "@/components/StatePanel";
import { SUBJECT_LABELS } from "@/lib/constants";
import { useLibraryDetailPage } from "./useLibraryDetailPage";

export default function LibraryDetailPage({ params }: { params: { id: string } }) {
  const detailPage = useLibraryDetailPage(params.id);
  const { item } = detailPage;

  if (detailPage.loading && !item && !detailPage.authRequired) {
    return <StatePanel title="资料阅读加载中" description="正在同步资料详情、标注与知识点信息。" tone="loading" />;
  }

  if (detailPage.authRequired) {
    return (
      <StatePanel
        title="请先登录后查看资料"
        description="登录后即可阅读资料、保存标注并管理分享链接。"
        tone="info"
        action={
          <Link className="button secondary" href="/login">
            前往登录
          </Link>
        }
      />
    );
  }

  if (detailPage.pageError && !item) {
    return (
      <StatePanel
        title="资料阅读加载失败"
        description={detailPage.pageError}
        tone="error"
        action={
          <button className="button secondary" type="button" onClick={() => void detailPage.load()}>
            重试
          </button>
        }
      />
    );
  }

  if (!item) {
    return (
      <StatePanel
        title="资料阅读暂时不可用"
        description="当前未能读取资料详情，请稍后再试。"
        tone="empty"
        action={
          <button className="button secondary" type="button" onClick={() => void detailPage.load()}>
            重新加载
          </button>
        }
      />
    );
  }

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
        <div className="cta-row no-margin" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
          <span className="chip">{item.accessScope === "global" ? "全局" : "班级"}</span>
          {detailPage.lastLoadedAtLabel ? <span className="chip">更新于 {detailPage.lastLoadedAtLabel}</span> : null}
          <button className="button secondary" type="button" onClick={() => void detailPage.load("refresh")} disabled={detailPage.loading || detailPage.refreshing}>
            {detailPage.refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {detailPage.pageError ? <StatePanel title="本次刷新存在异常" description={detailPage.pageError} tone="error" compact /> : null}
      {detailPage.actionError ? <StatePanel title="本次操作失败" description={detailPage.actionError} tone="error" compact /> : null}

      <Card title="阅读内容" tag="查看">
        <LibraryReader item={item} onTextSelection={detailPage.captureSelection} />
        <div className="cta-row" style={{ marginTop: 12 }}>
          <button className="button ghost" type="button" onClick={detailPage.createShare} disabled={detailPage.creatingShare || detailPage.refreshing}>
            {detailPage.creatingShare ? "生成中..." : "生成分享链接"}
          </button>
          {detailPage.shareUrl ? (
            <a className="button secondary" href={detailPage.shareUrl} target="_blank" rel="noreferrer">
              打开分享页
            </a>
          ) : null}
        </div>
      </Card>

      <Card title="阅读标注" tag="标注">
        <form onSubmit={detailPage.submitAnnotation} style={{ display: "grid", gap: 10 }}>
          <label>
            <div className="section-title">标注片段</div>
            <textarea
              rows={3}
              value={detailPage.quote}
              onChange={(event) => detailPage.updateQuote(event.target.value)}
              placeholder="可手动填写，或在上方选中文本自动带入"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <label>
            <div className="section-title">备注</div>
            <textarea
              rows={2}
              value={detailPage.note}
              onChange={(event) => detailPage.updateNote(event.target.value)}
              placeholder="写下你的理解或问题"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <button className="button primary" type="submit" disabled={detailPage.savingAnnotation || detailPage.refreshing}>
            {detailPage.savingAnnotation ? "保存中..." : "保存标注"}
          </button>
        </form>
        <div className="grid" style={{ gap: 8, marginTop: 12 }}>
          {detailPage.annotations.map((anno) => (
            <div className="card" key={anno.id}>
              <div style={{ fontWeight: 600 }}>{anno.quote}</div>
              {anno.note ? <div style={{ marginTop: 6 }}>{anno.note}</div> : null}
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-1)" }}>
                {new Date(anno.createdAt).toLocaleString("zh-CN")}
              </div>
            </div>
          ))}
          {!detailPage.annotations.length ? <p>暂无标注。</p> : null}
        </div>
      </Card>

      <Card title="知识点提取与修正" tag="知识点">
        <div style={{ fontSize: 13, color: "var(--ink-1)" }}>
          AI 提取：{item.extractedKnowledgePoints?.length ? item.extractedKnowledgePoints.join("、") : "暂无"}
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: "var(--ink-1)" }}>
          当前绑定：{item.knowledgePointIds?.length ? item.knowledgePointIds.join("、") : "暂无"}
        </div>
        {detailPage.canEditKnowledgePoints ? (
          <div style={{ marginTop: 10 }}>
            <div className="section-title">人工修正（多选）</div>
            <select
              multiple
              value={detailPage.selectedKpIds}
              onChange={(event) =>
                detailPage.updateSelectedKnowledgePointIds(Array.from(event.target.selectedOptions).map((opt) => opt.value))
              }
              disabled={detailPage.savingKnowledgePoints || detailPage.refreshing}
              style={{ width: "100%", height: 180, padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              {detailPage.filteredKnowledgePoints.map((kp) => (
                <option key={kp.id} value={kp.id}>
                  {kp.chapter} · {kp.title}
                </option>
              ))}
            </select>
            <div className="cta-row" style={{ marginTop: 10 }}>
              <button className="button primary" type="button" onClick={detailPage.saveKnowledgePoints} disabled={detailPage.savingKnowledgePoints || detailPage.refreshing}>
                {detailPage.savingKnowledgePoints ? "保存中..." : "保存修正"}
              </button>
            </div>
          </div>
        ) : (
          <p style={{ marginTop: 8 }}>当前账号仅可查看提取结果。</p>
        )}
      </Card>

      {detailPage.message ? <div style={{ color: "#027a48", fontSize: 13 }}>{detailPage.message}</div> : null}
      {detailPage.shareUrl ? (
        <div className="card">
          <div className="section-title">分享链接</div>
          <div style={{ wordBreak: "break-all", fontSize: 13 }}>{detailPage.shareUrl}</div>
        </div>
      ) : null}
    </div>
  );
}
