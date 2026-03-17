import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import MathText from "@/components/MathText";
import { getGradeLabel, SUBJECT_LABELS } from "@/lib/constants";
import { ANSWER_MODE_OPTIONS, HISTORY_ORIGIN_OPTIONS, QUALITY_RISK_LABELS } from "../config";
import type {
  TutorHistoryItem,
  TutorHistoryOriginFilter
} from "../types";
import {
  getOriginLabel,
  getQualityToneClass,
  truncateText
} from "../utils";

type TutorHistoryCardProps = {
  history: TutorHistoryItem[];
  filteredHistory: TutorHistoryItem[];
  showFavorites: boolean;
  historyKeyword: string;
  historyOriginFilter: TutorHistoryOriginFilter;
  hasActiveHistoryFilters: boolean;
  historyImageCount: number;
  favoriteHistoryCount: number;
  onHistoryKeywordChange: (value: string) => void;
  onHistoryOriginFilterChange: (value: TutorHistoryOriginFilter) => void;
  onToggleFavorites: () => void;
  onClearHistoryFilters: () => void;
  onReuseHistoryItem: (item: TutorHistoryItem) => void;
  onToggleFavorite: (item: TutorHistoryItem) => void;
  onEditTags: (item: TutorHistoryItem) => void;
  onCopyAnswer: (value: string) => void;
  onDeleteHistory: (item: TutorHistoryItem) => void;
};

export function TutorHistoryCard({
  history,
  filteredHistory,
  showFavorites,
  historyKeyword,
  historyOriginFilter,
  hasActiveHistoryFilters,
  historyImageCount,
  favoriteHistoryCount,
  onHistoryKeywordChange,
  onHistoryOriginFilterChange,
  onToggleFavorites,
  onClearHistoryFilters,
  onReuseHistoryItem,
  onToggleFavorite,
  onEditTags,
  onCopyAnswer,
  onDeleteHistory
}: TutorHistoryCardProps) {
  return (
    <>
      <div id="tutor-history-anchor" />
      <Card title="AI 对话历史" tag="记录">
        <div className="grid grid-3" style={{ marginBottom: 12 }}>
          <label>
            <div className="section-title">搜索历史</div>
            <input
              value={historyKeyword}
              onChange={(event) => onHistoryKeywordChange(event.target.value)}
              placeholder="搜索题目、答案、标签或来源"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            />
          </label>
          <div className="card">
            <div className="section-title">来源筛选</div>
            <div className="cta-row cta-row-tight" style={{ marginTop: 8 }}>
              {HISTORY_ORIGIN_OPTIONS.map((option) => {
                const selected = historyOriginFilter === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={selected ? "button secondary" : "button ghost"}
                    onClick={() => onHistoryOriginFilterChange(option.value)}
                    aria-pressed={selected}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="card">
            <div className="section-title">历史概览</div>
            <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 8, display: "grid", gap: 4 }}>
              <div>总记录 {history.length} 条</div>
              <div>图片识题 {historyImageCount} 条</div>
              <div>收藏记录 {favoriteHistoryCount} 条</div>
            </div>
          </div>
        </div>

        <div className="cta-row tutor-history-toolbar" style={{ marginBottom: 12 }}>
          <button className="button secondary" onClick={onToggleFavorites}>
            {showFavorites ? "查看全部" : "只看收藏"}
          </button>
          {hasActiveHistoryFilters ? (
            <button className="button ghost" type="button" onClick={onClearHistoryFilters}>
              清空筛选
            </button>
          ) : null}
          <a className="button ghost" href="#tutor-composer-anchor">回到提问区</a>
          <span className="chip">当前结果 {filteredHistory.length} 条</span>
          {historyKeyword.trim() ? <span className="chip">关键词：{historyKeyword.trim()}</span> : null}
        </div>

        <div className="grid" style={{ gap: 10 }}>
          {filteredHistory.length === 0 ? (
            <StatePanel
              compact
              tone="empty"
              title={hasActiveHistoryFilters ? "当前筛选条件下暂无记录" : "还没有 AI 辅导历史"}
              description={hasActiveHistoryFilters ? "可以清空筛选后再试试。" : "先完成一次文字提问或拍照识题，这里会自动保留历史。"}
              action={
                hasActiveHistoryFilters ? (
                  <button className="button secondary" type="button" onClick={onClearHistoryFilters}>
                    清空筛选
                  </button>
                ) : (
                  <a className="button secondary" href="#tutor-composer-anchor">
                    去提问区
                  </a>
                )
              }
            />
          ) : null}
          {filteredHistory.map((item) => {
            const meta = item.meta;
            return (
              <div className="card" key={item.id}>
                <div className="workflow-card-meta" style={{ marginBottom: 8 }}>
                  <span className="chip">{getOriginLabel(meta?.origin)}</span>
                  {meta?.learningMode === "study" ? <span className="chip">学习模式</span> : null}
                  {meta?.subject ? <span className="chip">{SUBJECT_LABELS[meta.subject] ?? meta.subject}</span> : null}
                  {meta?.grade ? <span className="chip">{getGradeLabel(meta.grade)}</span> : null}
                  {meta?.answerMode ? (
                    <span className="chip">{ANSWER_MODE_OPTIONS.find((option) => option.value === meta.answerMode)?.label ?? meta.answerMode}</span>
                  ) : null}
                  {meta?.imageCount ? <span className="chip">题图 {meta.imageCount} 张</span> : null}
                  {meta?.quality ? <span className="chip">可信度 {meta.quality.confidenceScore}</span> : null}
                </div>

                <div className="section-title">
                  <MathText as="div" text={item.question} />
                </div>
                <div style={{ color: "var(--ink-1)", marginTop: 8 }}>
                  <MathText as="div" text={truncateText(item.answer)} />
                </div>

                {meta?.quality ? (
                  <div className={`status-note ${getQualityToneClass(meta.quality.riskLevel)}`} style={{ marginTop: 10 }}>
                    {QUALITY_RISK_LABELS[meta.quality.riskLevel]} · {meta.quality.fallbackAction}
                  </div>
                ) : null}

                {item.tags.length ? <div style={{ marginTop: 8, fontSize: 12 }}>标签：{item.tags.join("、")}</div> : null}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
                  <button className="button secondary" onClick={() => onReuseHistoryItem(item)}>
                    复用到提问框
                  </button>
                  <button className="button secondary" onClick={() => onToggleFavorite(item)}>
                    {item.favorite ? "已收藏" : "收藏"}
                  </button>
                  <button className="button secondary" onClick={() => onEditTags(item)}>
                    编辑标签
                  </button>
                  <button className="button ghost" onClick={() => onCopyAnswer(item.answer)}>
                    复制答案
                  </button>
                  <button className="button ghost" onClick={() => onDeleteHistory(item)}>
                    删除
                  </button>
                  <div style={{ fontSize: 12, color: "var(--ink-1)" }}>{new Date(item.createdAt).toLocaleString("zh-CN")}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}
