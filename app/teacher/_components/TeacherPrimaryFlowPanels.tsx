import Link from "next/link";
import type { ReactNode } from "react";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { SUBJECT_LABELS } from "@/lib/constants";
import type { AssignmentItem, ClassItem, TeacherInsightsData, TeacherJoinRequest } from "../types";

type TeacherPrimaryFlowPanelsProps = {
  classes: ClassItem[];
  assignments: AssignmentItem[];
  joinRequests: TeacherJoinRequest[];
  insights: TeacherInsightsData | null;
};

type ActionTone = "critical" | "primary" | "steady";

type TeacherDashboardAction = {
  id: string;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  badgeLabel: string;
  tone: ActionTone;
};

const ACTION_TONE_META: Record<ActionTone, { background: string; border: string; color: string }> = {
  critical: {
    background: "rgba(240, 68, 56, 0.08)",
    border: "rgba(240, 68, 56, 0.22)",
    color: "#b42318"
  },
  primary: {
    background: "rgba(105, 65, 198, 0.08)",
    border: "rgba(105, 65, 198, 0.22)",
    color: "#6941c6"
  },
  steady: {
    background: "rgba(18, 183, 106, 0.08)",
    border: "rgba(18, 183, 106, 0.22)",
    color: "#027a48"
  }
};

function ActionLink({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  if (href.startsWith("#")) {
    return (
      <a className={className} href={href}>
        {children}
      </a>
    );
  }

  return (
    <Link className={className} href={href}>
      {children}
    </Link>
  );
}

function getHoursUntil(value: string) {
  return Math.ceil((new Date(value).getTime() - Date.now()) / (60 * 60 * 1000));
}

function formatDueDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

function buildTeacherDashboardActions({
  classes,
  assignments,
  joinRequests,
  insights
}: TeacherPrimaryFlowPanelsProps): TeacherDashboardAction[] {
  const pendingJoinRequests = joinRequests.filter((item) => item.status === "pending");
  const activeAlerts = (insights?.alerts ?? []).filter((item) => item.status === "active");
  const highRiskAlerts = activeAlerts.filter((item) => item.riskScore >= 80);
  const classesMissingAssignments = classes.filter((item) => item.studentCount > 0 && item.assignmentCount === 0);
  const assignmentsInProgress = assignments.filter((item) => item.completed < item.total);
  const dueSoonAssignments = assignmentsInProgress.filter((item) => getHoursUntil(item.dueDate) <= 48);
  const nextDueAssignment = [...dueSoonAssignments].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  )[0];
  const topRiskClass = [...(insights?.riskClasses ?? [])].sort((a, b) => b.riskScore - a.riskScore)[0];

  const actions: TeacherDashboardAction[] = [];

  if (!classes.length) {
    actions.push({
      id: "create-class",
      title: "先建立第一个班级",
      description: "先把班级建好，后面的加学生、发作业、看分析和排座才能真正跑起来。",
      href: "#teacher-create-class",
      ctaLabel: "去创建班级",
      badgeLabel: "起步必做",
      tone: "primary"
    });
  }

  if (pendingJoinRequests.length) {
    actions.push({
      id: "join-requests",
      title: `先处理 ${pendingJoinRequests.length} 条入班申请`,
      description: "新学生没进班，作业、分析和课表提醒都会断开；这一步最影响后续教学闭环。",
      href: "#teacher-join-requests",
      ctaLabel: "审核申请",
      badgeLabel: "阻塞项",
      tone: "critical"
    });
  }

  if (highRiskAlerts.length) {
    actions.push({
      id: "high-risk-alerts",
      title: `优先处理 ${highRiskAlerts.length} 条高风险预警`,
      description: "先把高风险学生和知识点预警清掉，再做常规作业和教学安排，能更快稳住课堂节奏。",
      href: "/teacher/analysis",
      ctaLabel: "去处理预警",
      badgeLabel: "高风险",
      tone: "critical"
    });
  } else if (activeAlerts.length) {
    actions.push({
      id: "alerts",
      title: `今天先清掉 ${activeAlerts.length} 条活跃预警`,
      description: "已有预警说明学生风险或知识点风险已经浮现，适合先进入学情分析做闭环动作。",
      href: "/teacher/analysis",
      ctaLabel: "查看学情分析",
      badgeLabel: "优先处理",
      tone: "primary"
    });
  }

  if (classesMissingAssignments.length) {
    actions.push({
      id: "missing-assignments",
      title: `先给 ${classesMissingAssignments.length} 个班级补上作业`,
      description: "这些班级已经有学生但还没有作业，今天适合先用统一模板发出一版可执行任务。",
      href: "#teacher-compose-assignment",
      ctaLabel: "发布作业",
      badgeLabel: "教学执行",
      tone: "primary"
    });
  } else if (classes.length && !assignments.length) {
    actions.push({
      id: "first-assignment",
      title: "先发布第一份作业",
      description: "班级已经建好，但没有形成任务闭环；先发一份作业，后续的分析、成绩和提醒才会有数据。",
      href: "#teacher-compose-assignment",
      ctaLabel: "去发布作业",
      badgeLabel: "首个闭环",
      tone: "primary"
    });
  }

  if (nextDueAssignment) {
    actions.push({
      id: "due-soon-assignment",
      title: `跟进即将截止的“${nextDueAssignment.title}”`,
      description: `这份作业将在 ${formatDueDate(nextDueAssignment.dueDate)} 截止，当前完成 ${nextDueAssignment.completed}/${nextDueAssignment.total}，适合先看班级收口情况。`,
      href: "/teacher/gradebook",
      ctaLabel: "查看成绩册",
      badgeLabel: "临近截止",
      tone: "steady"
    });
  }

  if (topRiskClass) {
    actions.push({
      id: "risk-class",
      title: `关注 ${topRiskClass.className} 的风险班级趋势`,
      description: `${SUBJECT_LABELS[topRiskClass.subject] ?? topRiskClass.subject} · ${topRiskClass.grade} 年级，当前风险分 ${topRiskClass.riskScore}，建议优先复盘薄弱点与高风险学生。`,
      href: "/teacher/analysis",
      ctaLabel: "查看班级分析",
      badgeLabel: "班级治理",
      tone: "steady"
    });
  }

  if (!actions.length) {
    actions.push(
      {
        id: "seating",
        title: "本周课堂节奏稳定，适合复盘学期排座",
        description: "当下没有明显阻塞项，可以把时间放在座位微调、课堂环境优化和重点学生前排策略上。",
        href: "/teacher/seating",
        ctaLabel: "进入学期排座",
        badgeLabel: "结构优化",
        tone: "steady"
      },
      {
        id: "exams",
        title: "可以提前准备下一次测验",
        description: "利用当前相对平稳的窗口补一次阶段测验或随堂小测，便于后续复盘学情。",
        href: "/teacher/exams/create",
        ctaLabel: "新建考试",
        badgeLabel: "前置准备",
        tone: "primary"
      },
      {
        id: "ai-tools",
        title: "留点时间给 AI 教学工具",
        description: "可以去生成讲评脚本、组卷或错题讲解，减少重复备课时间。",
        href: "/teacher/ai-tools",
        ctaLabel: "打开 AI 工具",
        badgeLabel: "提效",
        tone: "steady"
      }
    );
  }

  return actions;
}

export function TeacherNextStepCard(props: TeacherPrimaryFlowPanelsProps) {
  const actions = buildTeacherDashboardActions(props);
  const primaryAction = actions[0];
  const secondaryActions = actions.slice(1, 3);
  const meta = ACTION_TONE_META[primaryAction.tone];

  return (
    <Card title="现在最值得先做" tag={primaryAction.badgeLabel}>
      <div className="grid" style={{ gap: 12 }}>
        <div className="feature-card" style={{ alignItems: "flex-start" }}>
          <EduIcon name="rocket" />
          <div>
            <div className="section-title">现在先做：{primaryAction.title}</div>
            <p style={{ marginTop: 6, lineHeight: 1.7 }}>{primaryAction.description}</p>
          </div>
        </div>

        <div
          className="card"
          style={{
            border: `1px solid ${meta.border}`,
            background: meta.background
          }}
        >
          <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginTop: 0 }}>
            <div>
              <div className="section-title">为什么先做这一项</div>
              <div className="meta-text" style={{ marginTop: 6, color: "var(--ink-1)", lineHeight: 1.7 }}>
                它对今天的教学链路影响最大，先清掉能显著减少后续来回切换。
              </div>
            </div>
            <span className="pill" style={{ color: meta.color, borderColor: meta.color }}>
              {primaryAction.badgeLabel}
            </span>
          </div>

          <div className="cta-row" style={{ marginTop: 12, flexWrap: "wrap" }}>
            <ActionLink href={primaryAction.href} className="button primary">
              {primaryAction.ctaLabel}
            </ActionLink>
            <Link className="button ghost" href="/teacher/analysis">
              查看学情分析
            </Link>
            <Link className="button ghost" href="/teacher/seating">
              学期排座
            </Link>
          </div>
        </div>

        {secondaryActions.length ? (
          <div className="grid" style={{ gap: 10 }}>
            <div className="section-title">紧接着做</div>
            {secondaryActions.map((item) => {
              const secondaryMeta = ACTION_TONE_META[item.tone];
              return (
                <div className="card" key={item.id}>
                  <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginTop: 0 }}>
                    <div>
                      <div className="section-title">{item.title}</div>
                      <div className="meta-text" style={{ marginTop: 6, lineHeight: 1.7 }}>{item.description}</div>
                    </div>
                    <span className="pill" style={{ color: secondaryMeta.color, borderColor: secondaryMeta.color }}>
                      {item.badgeLabel}
                    </span>
                  </div>
                  <div className="cta-row" style={{ marginTop: 10, justifyContent: "space-between", alignItems: "center" }}>
                    <div className="meta-text">处理完上一项后，建议立即衔接这一项。</div>
                    <ActionLink href={item.href} className="button ghost">
                      {item.ctaLabel}
                    </ActionLink>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function TeacherExecutionSummaryCard({ classes, assignments, joinRequests, insights }: TeacherPrimaryFlowPanelsProps) {
  const pendingJoinRequests = joinRequests.filter((item) => item.status === "pending");
  const activeAlerts = (insights?.alerts ?? []).filter((item) => item.status === "active");
  const highRiskStudents = (insights?.riskStudents ?? []).filter((item) => item.riskScore >= 80);
  const classesMissingAssignments = classes.filter((item) => item.studentCount > 0 && item.assignmentCount === 0);
  const assignmentsInProgress = assignments.filter((item) => item.completed < item.total);
  const dueSoonAssignments = assignmentsInProgress.filter((item) => getHoursUntil(item.dueDate) <= 48);
  const totalStudents = insights?.summary.students ?? classes.reduce((sum, item) => sum + item.studentCount, 0);

  let focusMessage = "当前没有明显阻塞项，适合把时间投到学情复盘、排座和测验准备。";
  let budgetHeadline = "今天的教学盘面相对平稳";
  let budgetMeta = `班级 ${classes.length} 个 · 学生 ${totalStudents} 人`;
  if (!classes.length) {
    focusMessage = "先创建班级，后面的学生加入、作业发布、分析和排座都依赖它。";
    budgetHeadline = "先搭起班级结构";
    budgetMeta = "没有班级时，其他教学动作都无法闭环";
  } else if (pendingJoinRequests.length) {
    focusMessage = "今天最该先清掉待审核的入班申请，避免新学生掉出教学闭环。";
    budgetHeadline = `当前有 ${pendingJoinRequests.length} 条入班阻塞`;
    budgetMeta = "这组阻塞会直接影响学生能否收到任务与提醒";
  } else if (activeAlerts.length) {
    focusMessage = "预警还在激活中，建议先处理风险学生和薄弱知识点，再回头做常规发布。";
    budgetHeadline = `先处理 ${activeAlerts.length} 条活跃预警`;
    budgetMeta = `其中高风险学生 ${highRiskStudents.length} 人`;
  } else if (classesMissingAssignments.length) {
    focusMessage = "已有班级还没形成作业闭环，适合先补齐一版任务，让分析和成绩数据动起来。";
    budgetHeadline = `有 ${classesMissingAssignments.length} 个班级还没形成作业闭环`;
    budgetMeta = "先补齐任务，再谈成绩和学情";
  } else if (dueSoonAssignments.length) {
    focusMessage = "临近截止的作业值得先收口，避免明天出现一批逾期和补交。";
    budgetHeadline = `48 小时内有 ${dueSoonAssignments.length} 份作业临近截止`;
    budgetMeta = `待跟进作业 ${assignmentsInProgress.length} 份`;
  }

  return (
    <Card title="风险与覆盖" tag="Coverage">
      <div className="grid" style={{ gap: 12 }}>
        <div className="feature-card" style={{ alignItems: "flex-start" }}>
          <EduIcon name="chart" />
          <div>
            <div className="section-title">{budgetHeadline}</div>
            <p style={{ marginTop: 6, lineHeight: 1.7 }}>{focusMessage}</p>
          </div>
        </div>

        <div className="badge-row" style={{ marginTop: 0 }}>
          <span className="badge">{budgetMeta}</span>
          <span className="badge">待审申请 {pendingJoinRequests.length}</span>
          <span className="badge">活跃预警 {activeAlerts.length}</span>
          <span className="badge">待跟进作业 {assignmentsInProgress.length}</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <div className="card">
            <div className="section-title">待审申请</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{pendingJoinRequests.length}</div>
            <div className="meta-text" style={{ marginTop: 6 }}>影响学生是否能进入班级闭环</div>
          </div>
          <div className="card">
            <div className="section-title">活跃预警</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{activeAlerts.length}</div>
            <div className="meta-text" style={{ marginTop: 6 }}>高风险学生 {highRiskStudents.length} 人</div>
          </div>
          <div className="card">
            <div className="section-title">待跟进作业</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{assignmentsInProgress.length}</div>
            <div className="meta-text" style={{ marginTop: 6 }}>48 小时内截止 {dueSoonAssignments.length} 份</div>
          </div>
          <div className="card">
            <div className="section-title">班级覆盖</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{classes.length}</div>
            <div className="meta-text" style={{ marginTop: 6 }}>学生 {totalStudents} 人 · 未布置作业班级 {classesMissingAssignments.length}</div>
          </div>
        </div>

        <div className="meta-text" style={{ lineHeight: 1.7 }}>
          这张卡只负责帮你看清今天的风险密度和班级覆盖面。真正开工时，优先跟着左侧“现在最值得先做”和上面的教学闭环走，不需要在首页重新排一遍顺序。
        </div>

        <div className="cta-row" style={{ flexWrap: "wrap" }}>
          <Link className="button secondary" href="/teacher/analysis">
            去看学情风险
          </Link>
          <Link className="button ghost" href="/teacher/gradebook">
            去看成绩册
          </Link>
          <Link className="button ghost" href="/teacher/seating">
            去看排座
          </Link>
        </div>
      </div>
    </Card>
  );
}
