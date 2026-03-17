import { formatLoadedTime } from "@/lib/client-request";

type StudentPortraitHeaderProps = {
  abilityCount: number;
  trackedKnowledgePointCount: number;
  weakKnowledgePointCount: number;
  lastLoadedAt: string | null;
  refreshing: boolean;
  onRefresh: () => void;
};

export default function StudentPortraitHeader({
  abilityCount,
  trackedKnowledgePointCount,
  weakKnowledgePointCount,
  lastLoadedAt,
  refreshing,
  onRefresh
}: StudentPortraitHeaderProps) {
  return (
    <div className="section-head">
      <div>
        <h2>学习画像</h2>
        <div className="section-sub">多维能力雷达、学科掌握概览与薄弱知识点优先级。</div>
      </div>
      <div className="workflow-toolbar">
        <span className="chip">能力 {abilityCount}</span>
        <span className="chip">知识点 {trackedKnowledgePointCount}</span>
        <span className="chip">薄弱点 {weakKnowledgePointCount}</span>
        {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
        <button className="button secondary" type="button" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? "刷新中..." : "刷新"}
        </button>
      </div>
    </div>
  );
}
