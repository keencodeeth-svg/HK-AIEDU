"use client";

import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { SUBJECT_LABELS } from "@/lib/constants";
import { useAdminKnowledgeTreePage } from "./useAdminKnowledgeTreePage";

export default function KnowledgeTreePage() {
  const knowledgeTreePage = useAdminKnowledgeTreePage();

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>知识点树可视化</h2>
          <div className="section-sub">按单元与章节查看知识点结构。</div>
        </div>
        <span className="chip">管理端</span>
      </div>

      {knowledgeTreePage.authRequired ? (
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

      {!knowledgeTreePage.authRequired ? (
        <Card title="知识点树（可视化）" tag="结构">
          {knowledgeTreePage.loading ? (
            <StatePanel compact tone="loading" title="知识点树加载中" description="正在同步知识点目录。" />
          ) : null}
          {!knowledgeTreePage.loading && knowledgeTreePage.error ? (
            <StatePanel compact tone="error" title="知识点树加载失败" description={knowledgeTreePage.error} />
          ) : null}
          {!knowledgeTreePage.loading && !knowledgeTreePage.error && Object.keys(knowledgeTreePage.tree).length === 0 ? (
            <p>暂无知识点。</p>
          ) : null}
          <div className="grid" style={{ gap: 12, marginTop: 12 }}>
            {Object.entries(knowledgeTreePage.tree).map(([subject, gradeMap]) => (
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
