import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { formatLoadedTime } from "@/lib/client-request";
import { SUBJECT_LABELS } from "@/lib/constants";
import type { WeakKnowledgePoint } from "../types";
import { buildPracticeHref, getMasteryLabel, getMasteryTone } from "../utils";

type StudentPortraitWeakPointsCardProps = {
  weakKnowledgePoints: WeakKnowledgePoint[];
};

export default function StudentPortraitWeakPointsCard({
  weakKnowledgePoints
}: StudentPortraitWeakPointsCardProps) {
  return (
    <Card title="薄弱知识点" tag="mastery">
      {!weakKnowledgePoints.length ? (
        <StatePanel
          compact
          tone="empty"
          title="当前没有明显薄弱知识点"
          description="继续保持练习和复盘，系统会在发现风险点时自动更新这里的优先清单。"
        />
      ) : (
        <div className="portrait-weak-grid">
          {weakKnowledgePoints.map((item) => (
            <div className="card" key={item.knowledgePointId}>
              <div className="section-title">{item.title}</div>
              <div className="workflow-card-meta">
                <span className={`gradebook-pill ${getMasteryTone(item.masteryLevel)}`}>{getMasteryLabel(item.masteryLevel)}</span>
                <span className="pill">{SUBJECT_LABELS[item.subject] ?? item.subject}</span>
                {item.weaknessRank ? <span className="pill">优先级 #{item.weaknessRank}</span> : null}
              </div>
              <div className="student-module-resource-meta">
                掌握分 {item.masteryScore} · 信心分 {item.confidenceScore} · 7日趋势 {item.masteryTrend7d}
              </div>
              <div className="student-module-resource-meta">
                正确 {item.correct} / 总计 {item.total}
                {item.lastAttemptAt ? ` · 最近作答 ${formatLoadedTime(item.lastAttemptAt)}` : " · 暂无最近作答时间"}
              </div>
              <div className="cta-row portrait-next-actions">
                <Link
                  className="button secondary"
                  href={buildPracticeHref({
                    subject: item.subject,
                    knowledgePointId: item.knowledgePointId
                  })}
                >
                  去练习
                </Link>
                <Link className="button ghost" href="/wrong-book">
                  去错题本
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
