import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import type { RubricItem, RubricLevel } from "../types";

type AssignmentRubricEditorCardProps = {
  rubrics: RubricItem[];
  rubricLevelCount: number;
  rubricsLoading: boolean;
  rubricsReady: boolean;
  rubricLoadError: string | null;
  rubricError: string | null;
  rubricMessage: string | null;
  rubricSaving: boolean;
  onUpdateRubric: (index: number, patch: Partial<RubricItem>) => void;
  onUpdateLevel: (rubricIndex: number, levelIndex: number, patch: Partial<RubricLevel>) => void;
  onAddRubric: () => void;
  onRemoveRubric: (index: number) => void;
  onAddLevel: (index: number) => void;
  onRemoveLevel: (rubricIndex: number, levelIndex: number) => void;
  onSave: () => void;
  onRetryLoad: () => void;
};

export default function AssignmentRubricEditorCard({
  rubrics,
  rubricLevelCount,
  rubricsLoading,
  rubricsReady,
  rubricLoadError,
  rubricError,
  rubricMessage,
  rubricSaving,
  onUpdateRubric,
  onUpdateLevel,
  onAddRubric,
  onRemoveRubric,
  onAddLevel,
  onRemoveLevel,
  onSave,
  onRetryLoad
}: AssignmentRubricEditorCardProps) {
  return (
    <Card title="评分细则（Rubric）" tag="Rubric">
      <div className="feature-card">
        <EduIcon name="chart" />
        <div>
          <div className="section-title">评分细则放在执行动作之后处理</div>
          <p>当催交、批改和提醒都已经明确后，再维护评分维度和分档，会更符合教师实际工作节奏。</p>
        </div>
      </div>

      <div className="pill-list" style={{ marginTop: 12 }}>
        <span className="pill">维度 {rubrics.length} 个</span>
        <span className="pill">分档 {rubricLevelCount} 条</span>
      </div>

      {!rubricsReady && rubricsLoading ? (
        <StatePanel
          compact
          tone="loading"
          title="评分细则加载中"
          description="正在同步当前作业的 rubric。"
        />
      ) : null}

      {!rubricsReady && rubricLoadError ? (
        <StatePanel
          compact
          tone="error"
          title="评分细则加载失败"
          description={rubricLoadError}
          action={
            <button className="button secondary" type="button" onClick={onRetryLoad}>
              重试评分细则
            </button>
          }
        />
      ) : null}

      {rubricsReady && rubricLoadError ? (
        <StatePanel
          compact
          tone="error"
          title="当前展示最近一次成功加载的评分细则"
          description={`最新刷新失败：${rubricLoadError}`}
          action={
            <button className="button secondary" type="button" onClick={onRetryLoad}>
              重新同步 rubric
            </button>
          }
        />
      ) : null}

      {rubricsReady ? (
        <div className="grid" style={{ gap: 12, marginTop: 12 }}>
        {rubrics.map((rubric, index) => (
          <div className="card" key={`rubric-${index}`}>
            <div className="card-header">
              <div className="section-title">维度 {index + 1}</div>
              <button className="button ghost" type="button" onClick={() => onRemoveRubric(index)}>
                删除维度
              </button>
            </div>
            <div className="grid" style={{ gap: 10 }}>
              <label>
                <div className="section-title">维度名称</div>
                <input value={rubric.title} onChange={(event) => onUpdateRubric(index, { title: event.target.value })} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }} />
              </label>
              <label>
                <div className="section-title">维度说明</div>
                <input
                  value={rubric.description ?? ""}
                  onChange={(event) => onUpdateRubric(index, { description: event.target.value })}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                />
              </label>
              <div className="grid grid-2">
                <label>
                  <div className="section-title">满分</div>
                  <input type="number" min={1} value={rubric.maxScore} onChange={(event) => onUpdateRubric(index, { maxScore: Number(event.target.value) })} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }} />
                </label>
                <label>
                  <div className="section-title">权重</div>
                  <input type="number" min={1} value={rubric.weight} onChange={(event) => onUpdateRubric(index, { weight: Number(event.target.value) })} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }} />
                </label>
              </div>
              <div>
                <div className="section-title">分档描述</div>
                <div className="grid" style={{ gap: 8, marginTop: 8 }}>
                  {rubric.levels.map((level, levelIndex) => (
                    <div className="card" key={`level-${index}-${levelIndex}`}>
                      <div className="grid grid-2">
                        <label>
                          <div className="section-title">档位名称</div>
                          <input value={level.label} onChange={(event) => onUpdateLevel(index, levelIndex, { label: event.target.value })} style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid var(--stroke)" }} />
                        </label>
                        <label>
                          <div className="section-title">建议得分</div>
                          <input type="number" min={0} value={level.score} onChange={(event) => onUpdateLevel(index, levelIndex, { score: Number(event.target.value) })} style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid var(--stroke)" }} />
                        </label>
                      </div>
                      <label>
                        <div className="section-title">描述</div>
                        <input value={level.description} onChange={(event) => onUpdateLevel(index, levelIndex, { description: event.target.value })} style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid var(--stroke)" }} />
                      </label>
                      <button className="button ghost" type="button" onClick={() => onRemoveLevel(index, levelIndex)}>
                        删除档位
                      </button>
                    </div>
                  ))}
                </div>
                <button className="button secondary" type="button" onClick={() => onAddLevel(index)}>
                  添加分档
                </button>
              </div>
            </div>
          </div>
        ))}
        </div>
      ) : null}
      {rubricsReady && rubricError ? <div className="status-note error">{rubricError}</div> : null}
      {rubricsReady && rubricMessage ? <div className="status-note success">{rubricMessage}</div> : null}
      {rubricsReady ? (
        <div className="cta-row" style={{ marginTop: 12 }}>
          <button className="button secondary" type="button" onClick={onAddRubric}>
            添加评分维度
          </button>
          <button
            className="button primary"
            type="button"
            disabled={rubricSaving || rubricsLoading}
            onClick={onSave}
          >
            {rubricSaving ? "保存中..." : "保存评分细则"}
          </button>
        </div>
      ) : null}
    </Card>
  );
}
