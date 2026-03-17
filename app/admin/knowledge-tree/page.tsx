"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import {
  getRequestErrorMessage,
  isAuthError,
  requestJson
} from "@/lib/client-request";
import { SUBJECT_LABELS } from "@/lib/constants";

type KnowledgePoint = {
  id: string;
  subject: string;
  grade: string;
  title: string;
  chapter: string;
  unit?: string;
};

type KnowledgePointListPayload = {
  data?: KnowledgePoint[];
  meta?: {
    totalPages?: number;
  };
};

async function loadAllKnowledgePoints() {
  const firstPage = await requestJson<KnowledgePointListPayload>(
    "/api/admin/knowledge-points?page=1&pageSize=200"
  );
  const totalPages = Math.max(1, Number(firstPage.meta?.totalPages ?? 1));
  if (totalPages === 1) {
    return firstPage.data ?? [];
  }

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      requestJson<KnowledgePointListPayload>(
        `/api/admin/knowledge-points?page=${index + 2}&pageSize=200`
      )
    )
  );

  return [
    ...(firstPage.data ?? []),
    ...remainingPages.flatMap((payload) => payload.data ?? [])
  ];
}

export default function KnowledgeTreePage() {
  const [list, setList] = useState<KnowledgePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadKnowledgePoints() {
      setLoading(true);
      setError(null);
      try {
        const payload = await loadAllKnowledgePoints();
        if (cancelled) return;
        setAuthRequired(false);
        setList(payload);
      } catch (nextError) {
        if (cancelled) return;
        setList([]);
        if (isAuthError(nextError)) {
          setAuthRequired(true);
        }
        setError(getRequestErrorMessage(nextError, "知识点加载失败"));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadKnowledgePoints();
    return () => {
      cancelled = true;
    };
  }, []);

  const tree = list.reduce((acc, kp) => {
    const unit = kp.unit ?? "未分单元";
    if (!acc[kp.subject]) acc[kp.subject] = {};
    if (!acc[kp.subject][kp.grade]) acc[kp.subject][kp.grade] = {};
    if (!acc[kp.subject][kp.grade][unit]) acc[kp.subject][kp.grade][unit] = {};
    if (!acc[kp.subject][kp.grade][unit][kp.chapter]) acc[kp.subject][kp.grade][unit][kp.chapter] = [];
    acc[kp.subject][kp.grade][unit][kp.chapter].push(kp);
    return acc;
  }, {} as Record<string, Record<string, Record<string, Record<string, KnowledgePoint[]>>>>);

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>知识点树可视化</h2>
          <div className="section-sub">按单元与章节查看知识点结构。</div>
        </div>
        <span className="chip">管理端</span>
      </div>

      {authRequired ? (
        <Card title="知识点树（可视化）" tag="登录">
          <StatePanel
            compact
            tone="info"
            title="请先登录后进入管理端"
            description="登录管理员账号后即可查看完整知识点树和章节结构。"
            action={
              <Link className="button secondary" href="/login">
                前往登录
              </Link>
            }
          />
        </Card>
      ) : null}

      {!authRequired ? (
        <Card title="知识点树（可视化）" tag="结构">
          {loading ? (
            <StatePanel compact tone="loading" title="知识点树加载中" description="正在同步知识点目录。" />
          ) : null}
          {!loading && error ? (
            <StatePanel compact tone="error" title="知识点树加载失败" description={error} />
          ) : null}
          {!loading && !error && Object.keys(tree).length === 0 ? <p>暂无知识点。</p> : null}
          <div className="grid" style={{ gap: 12, marginTop: 12 }}>
            {Object.entries(tree).map(([subject, gradeMap]) => (
              <div className="card" key={subject}>
                <div className="section-title">{SUBJECT_LABELS[subject] ?? subject}</div>
                <div className="grid" style={{ gap: 8, marginTop: 8 }}>
                  {Object.entries(gradeMap).map(([grade, unitMap]) => (
                    <div key={`${subject}-${grade}`}>
                      <div style={{ fontWeight: 600 }}>年级：{grade}</div>
                      <div className="grid" style={{ gap: 6, marginTop: 6 }}>
                        {Object.entries(unitMap).map(([unit, chapterMap]) => (
                          <div className="card" key={`${subject}-${grade}-${unit}`}>
                            <div className="section-title" style={{ fontSize: 14 }}>
                              {unit}
                            </div>
                            <div className="grid" style={{ gap: 6, marginTop: 6 }}>
                              {Object.entries(chapterMap).map(([chapter, points]) => (
                                <div className="card" key={`${subject}-${grade}-${unit}-${chapter}`}>
                                  <div className="section-title" style={{ fontSize: 13 }}>
                                    {chapter}
                                  </div>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                                    {points.map((kp) => (
                                      <span className="badge" key={kp.id}>
                                        {kp.title}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
