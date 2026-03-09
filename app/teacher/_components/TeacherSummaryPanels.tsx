import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { SUBJECT_LABELS } from "@/lib/constants";
import type {
  AlertImpactData,
  AssignmentItem,
  ClassItem,
  TeacherAlertActionType,
  TeacherAlertItem,
  TeacherInsightsData
} from "../types";

type TeacherOverviewCardProps = {
  classes: ClassItem[];
  assignments: AssignmentItem[];
  message: string | null;
  error: string | null;
};

export function TeacherOverviewCard({ classes, assignments, message, error }: TeacherOverviewCardProps) {
  return (
    <Card title="教师概览" tag="数据">
      <div className="grid grid-3">
        <div className="card">
          <div className="section-title">班级数</div>
          <p>{classes.length}</p>
        </div>
        <div className="card">
          <div className="section-title">作业数</div>
          <p>{assignments.length}</p>
        </div>
        <div className="card">
          <div className="section-title">待完成作业</div>
          <p>{assignments.filter((item) => item.completed < item.total).length}</p>
        </div>
      </div>
      {message ? <div style={{ marginTop: 12, color: "#1a7f37", fontSize: 13 }}>{message}</div> : null}
      {error ? <div style={{ marginTop: 12, color: "#b42318", fontSize: 13 }}>{error}</div> : null}
    </Card>
  );
}

export function TeacherExamModuleCard() {
  return (
    <Card title="在线考试模块" tag="考试">
      <div className="feature-card">
        <EduIcon name="pencil" />
        <p>发布独立考试，追踪班级提交进度与成绩。</p>
      </div>
      <div className="cta-row" style={{ marginTop: 12 }}>
        <Link className="button secondary" href="/teacher/exams">
          进入在线考试
        </Link>
        <Link className="button ghost" href="/teacher/exams/create">
          新建考试
        </Link>
      </div>
    </Card>
  );
}

type TeacherInsightsCardProps = {
  insights: TeacherInsightsData | null;
  actingAlertKey: string | null;
  acknowledgingAlertId: string | null;
  impactByAlertId: Record<string, AlertImpactData>;
  loadingImpactId: string | null;
  onRunAlertAction: (alertId: string, actionType: TeacherAlertActionType) => void | Promise<void>;
  onAcknowledgeAlert: (alertId: string) => void | Promise<void>;
  onLoadAlertImpact: (alertId: string) => void | Promise<void>;
};

function getAlertTypeLabel(type: TeacherAlertItem["type"]) {
  return type === "student-risk" ? "学生风险" : "知识点风险";
}

function getAlertNotificationLabel(type: TeacherAlertItem["type"]) {
  return type === "student-risk" ? "提醒学生" : "提醒全班";
}

function getActionTypeLabel(type: TeacherAlertActionType | "mark_done") {
  if (type === "assign_review") return "布置修复";
  if (type === "notify_student") return "提醒学生/班级";
  if (type === "auto_chain") return "一键闭环";
  return "确认完成";
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString("zh-CN") : "-";
}

export function TeacherInsightsCard({
  insights,
  actingAlertKey,
  acknowledgingAlertId,
  impactByAlertId,
  loadingImpactId,
  onRunAlertAction,
  onAcknowledgeAlert,
  onLoadAlertImpact
}: TeacherInsightsCardProps) {
  const weakPoints = insights?.weakPoints ?? [];
  const alerts = insights?.alerts ?? [];

  return (
    <Card title="作业统计看板" tag="分析">
      <div className="grid grid-3">
        <div className="card">
          <div className="section-title">完成率</div>
          <p>{insights?.summary.completionRate ?? 0}%</p>
        </div>
        <div className="card">
          <div className="section-title">正确率</div>
          <p>{insights?.summary.accuracy ?? 0}%</p>
        </div>
        <div className="card">
          <div className="section-title">参与学生</div>
          <p>{insights?.summary.students ?? 0} 人</p>
        </div>
        <div className="card">
          <div className="section-title">班级风险分</div>
          <p>{insights?.summary.classRiskScore ?? 0}</p>
        </div>
        <div className="card">
          <div className="section-title">活跃预警</div>
          <p>{insights?.summary.activeAlerts ?? 0}</p>
        </div>
        <div className="card">
          <div className="section-title">高风险预警</div>
          <p>{insights?.summary.highRiskAlerts ?? 0}</p>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <div className="section-title">薄弱知识点</div>
        {weakPoints.length ? (
          <div className="grid" style={{ gap: 8 }}>
            {weakPoints.map((item) => (
              <div className="card" key={item.id}>
                <div className="section-title">{item.title}</div>
                <p>
                  正确率 {item.ratio}% · 练习 {item.total} 次
                </p>
                <p>
                  {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p>暂无薄弱点数据。</p>
        )}
      </div>
      <div style={{ marginTop: 12 }}>
        <div className="section-title">教师预警</div>
        {alerts.length ? (
          <div className="grid" style={{ gap: 8 }}>
            {alerts.map((item) => {
              const impact = impactByAlertId[item.id];

              return (
                <div className="card" key={item.id}>
                  <div className="section-title">
                    {getAlertTypeLabel(item.type)} · 风险分 {item.riskScore}
                  </div>
                  <p>
                    {item.className} · {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
                  </p>
                  <p>{item.riskReason}</p>
                  <p style={{ color: "var(--ink-1)" }}>建议动作：{item.recommendedAction}</p>
                  {item.lastActionType ? (
                    <p style={{ color: "var(--ink-1)", fontSize: 12 }}>
                      最近动作：{getActionTypeLabel(item.lastActionType)} · {formatDateTime(item.lastActionAt)}
                    </p>
                  ) : null}
                  {item.lastActionDetail ? (
                    <p style={{ color: "var(--ink-1)", fontSize: 12 }}>{item.lastActionDetail}</p>
                  ) : null}
                  <div className="cta-row">
                    <button
                      className="button primary"
                      onClick={() => onRunAlertAction(item.id, "auto_chain")}
                      disabled={actingAlertKey === `${item.id}:auto_chain`}
                    >
                      {actingAlertKey === `${item.id}:auto_chain` ? "执行中..." : "一键闭环执行"}
                    </button>
                    <button
                      className="button ghost"
                      onClick={() => onRunAlertAction(item.id, "assign_review")}
                      disabled={actingAlertKey === `${item.id}:assign_review`}
                    >
                      {actingAlertKey === `${item.id}:assign_review` ? "布置中..." : "一键布置修复任务"}
                    </button>
                    <button
                      className="button ghost"
                      onClick={() => onRunAlertAction(item.id, "notify_student")}
                      disabled={actingAlertKey === `${item.id}:notify_student`}
                    >
                      {actingAlertKey === `${item.id}:notify_student`
                        ? "提醒中..."
                        : getAlertNotificationLabel(item.type)}
                    </button>
                    {item.status === "acknowledged" ? (
                      <span className="badge">已确认</span>
                    ) : (
                      <button
                        className="button secondary"
                        onClick={() => onAcknowledgeAlert(item.id)}
                        disabled={acknowledgingAlertId === item.id}
                      >
                        {acknowledgingAlertId === item.id ? "确认中..." : "确认预警"}
                      </button>
                    )}
                    <button
                      className="button ghost"
                      onClick={() => onLoadAlertImpact(item.id)}
                      disabled={loadingImpactId === item.id}
                    >
                      {loadingImpactId === item.id ? "加载中..." : "查看24h/72h效果"}
                    </button>
                  </div>
                  {impact ? (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 10,
                        borderRadius: 10,
                        border: "1px dashed var(--stroke)",
                        background: "rgba(255,255,255,0.5)"
                      }}
                    >
                      {impact.impact.tracked ? (
                        <div style={{ display: "grid", gap: 6, fontSize: 12, color: "var(--ink-1)" }}>
                          <div>
                            基线时间： {formatDateTime(impact.impact.trackedAt)} · 已追踪 {impact.impact.elapsedHours} 小时
                          </div>
                          <div>
                            风险分变化：{impact.impact.deltas.riskScore ?? 0} ·{" "}
                            {(impact.impact.deltas.riskScore ?? 0) < 0 ? "风险下降" : "风险未下降"}
                          </div>
                          <div>
                            24h：{impact.impact.windows.h24.ready ? "已到期" : "观察中"} ·{" "}
                            {impact.impact.windows.h24.ready
                              ? `Δ${impact.impact.windows.h24.riskDelta ?? 0}`
                              : `剩余 ${impact.impact.windows.h24.remainingHours}h`}
                          </div>
                          <div>
                            72h：{impact.impact.windows.h72.ready ? "已到期" : "观察中"} ·{" "}
                            {impact.impact.windows.h72.ready
                              ? `Δ${impact.impact.windows.h72.riskDelta ?? 0}`
                              : `剩余 ${impact.impact.windows.h72.remainingHours}h`}
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: "var(--ink-1)" }}>
                          当前预警还没有可追踪的动作基线，请先执行修复动作。
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p>暂无预警。</p>
        )}
      </div>
    </Card>
  );
}

export function TeacherQuickAccessCards() {
  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
      <Card title="AI 教学工具" tag="智能">
        <div className="feature-card">
          <EduIcon name="brain" />
          <p>AI 组卷、课堂讲稿、错题讲评脚本、题库纠错。</p>
        </div>
        <Link className="button secondary" href="/teacher/ai-tools" style={{ marginTop: 12 }}>
          进入工具
        </Link>
      </Card>
      <Card title="学期排座" tag="班级">
        <div className="feature-card">
          <EduIcon name="board" />
          <p>学期初生成班级座位方案，兼顾成绩互补、性别、身高与前排需求，后续只按需局部调整。</p>
        </div>
        <Link className="button secondary" href="/teacher/seating" style={{ marginTop: 12 }}>
          进入学期排座
        </Link>
      </Card>
      <Card title="学情分析" tag="数据">
        <div className="feature-card">
          <EduIcon name="chart" />
          <p>知识点掌握热力图 + 学情报告。</p>
        </div>
        <Link className="button secondary" href="/teacher/analysis" style={{ marginTop: 12 }}>
          查看分析
        </Link>
      </Card>
      <Card title="成绩册" tag="Gradebook">
        <div className="feature-card">
          <EduIcon name="board" />
          <p>查看班级作业完成情况、逾期与平均分。</p>
        </div>
        <Link className="button secondary" href="/teacher/gradebook" style={{ marginTop: 12 }}>
          进入成绩册
        </Link>
      </Card>
    </div>
  );
}
