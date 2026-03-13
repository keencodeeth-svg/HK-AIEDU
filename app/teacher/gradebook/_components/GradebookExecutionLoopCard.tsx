"use client";

import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { SUBJECT_LABELS } from "@/lib/constants";
import type {
  GradebookAssignment,
  GradebookAssignmentStat,
  GradebookClass,
  GradebookStudent,
  GradebookSummary,
  GradebookTrendItem
} from "../types";

type GradebookExecutionLoopCardProps = {
  selectedClass: GradebookClass | null;
  summary: GradebookSummary | null;
  assignments: GradebookAssignment[];
  assignmentStatMap: ReadonlyMap<string, GradebookAssignmentStat>;
  students: GradebookStudent[];
  trendMap: ReadonlyMap<string, GradebookTrendItem>;
  now: number;
};

function formatClassLabel(selectedClass: GradebookClass | null) {
  if (!selectedClass) return "当前班级";
  return `${selectedClass.name} · ${SUBJECT_LABELS[selectedClass.subject] ?? selectedClass.subject} · ${selectedClass.grade} 年级`;
}

export default function GradebookExecutionLoopCard({
  selectedClass,
  summary,
  assignments,
  assignmentStatMap,
  students,
  trendMap,
  now
}: GradebookExecutionLoopCardProps) {
  const incompleteAssignments = assignments
    .map((assignment) => {
      const stat = assignmentStatMap.get(assignment.id);
      const trend = trendMap.get(assignment.id);
      const dueTs = new Date(assignment.dueDate).getTime();
      return {
        assignment,
        stat,
        trend,
        dueTs,
        overdue: (stat?.completed ?? 0) < (stat?.total ?? 0) && dueTs < now,
        dueSoon: (stat?.completed ?? 0) < (stat?.total ?? 0) && dueTs >= now && dueTs - now <= 48 * 60 * 60 * 1000
      };
    })
    .filter((item) => (item.stat?.completed ?? 0) < (item.stat?.total ?? 0))
    .sort((left, right) => {
      if (left.overdue !== right.overdue) return left.overdue ? -1 : 1;
      if (left.dueSoon !== right.dueSoon) return left.dueSoon ? -1 : 1;
      return left.dueTs - right.dueTs;
    });

  const urgentAssignment = incompleteAssignments[0] ?? null;
  const followUpStudents = students.filter((student) => student.stats.overdue > 0 || student.stats.pending > 0);
  const overdueStudents = students.filter((student) => student.stats.overdue > 0);
  const topFollowUpStudent =
    [...followUpStudents].sort((left, right) => {
      if (left.stats.overdue !== right.stats.overdue) return right.stats.overdue - left.stats.overdue;
      if (left.stats.pending !== right.stats.pending) return right.stats.pending - left.stats.pending;
      return left.stats.avgScore - right.stats.avgScore;
    })[0] ?? null;
  const classLabel = formatClassLabel(selectedClass);

  const loopSignals = [
    {
      id: "assignment",
      label: "当前最该先收",
      value: urgentAssignment ? urgentAssignment.assignment.title : "当前没有临近截止的未收口作业",
      meta: urgentAssignment
        ? `已交 ${urgentAssignment.stat?.completed ?? 0}/${urgentAssignment.stat?.total ?? 0} · 逾期 ${urgentAssignment.stat?.overdue ?? 0}`
        : "可以把时间转到趋势复盘、导出和下一轮安排"
    },
    {
      id: "student",
      label: "当前待跟进学生",
      value: followUpStudents.length ? `${followUpStudents.length} 人待跟进` : "当前没有明显掉队学生",
      meta: followUpStudents.length
        ? `其中逾期学生 ${overdueStudents.length} 人${topFollowUpStudent ? ` · 最先看 ${topFollowUpStudent.name}` : ""}`
        : "说明这个班当前提交状态相对稳定"
    },
    {
      id: "verify",
      label: "收口后验证",
      value: `完成率 ${summary?.completionRate ?? 0}% · 平均分 ${summary?.avgScore ?? 0}`,
      meta: "收口后别只看是否已交，还要回看完成率和平均分有没有抬升"
    }
  ];

  const loopSteps = [
    {
      id: "assignment",
      step: "01",
      kicker: "先收作业",
      title: urgentAssignment ? `先收口「${urgentAssignment.assignment.title}」` : "先确认当前没有遗漏的未收口作业",
      description: urgentAssignment
        ? `${classLabel} 当前最容易打断节奏的是这份作业。先把临近截止或已逾期的这份收掉，后面学生跟进会清晰很多。`
        : `${classLabel} 当前没有明显的截止压力，可以直接进入学生跟进和趋势复盘。`,
      meta: urgentAssignment
        ? `完成率 ${urgentAssignment.trend?.completionRate ?? 0}% · 平均分 ${urgentAssignment.trend?.avgScore ?? 0}`
        : "没有作业堆积时，更适合做复盘和前置安排",
      href: "#gradebook-table",
      actionLabel: urgentAssignment ? "查看作业收口明细" : "查看成绩册明细"
    },
    {
      id: "students",
      step: "02",
      kicker: "再追学生",
      title: followUpStudents.length ? `再跟进 ${followUpStudents.length} 名未收口学生` : "学生提交基本稳定，可转看趋势",
      description: followUpStudents.length
        ? "作业没收口，最终还是落在学生身上。先把逾期和待交学生圈出来，跟进动作才不会泛化。"
        : "当学生整体完成情况稳定时，重点就从催收转到成绩走势和下一轮教学安排。",
      meta: topFollowUpStudent
        ? `${topFollowUpStudent.name} · 逾期 ${topFollowUpStudent.stats.overdue} · 待交 ${topFollowUpStudent.stats.pending}`
        : "当前没有明显需要优先点名的学生",
      href: "#gradebook-table",
      actionLabel: "查看学生跟进"
    },
    {
      id: "verify",
      step: "03",
      kicker: "最后看效果",
      title: "回看趋势，再决定是否导出或切到学情分析",
      description: "成绩册不是只用来看谁交没交。收口后要确认这轮动作有没有改善完成率和成绩，再决定是否需要转到学情分析继续处理。",
      meta: "如果提交稳定但成绩未起色，下一步应该转到学情分析看知识点风险",
      href: "/teacher/analysis",
      actionLabel: "去学情分析"
    }
  ];

  return (
    <Card title="成绩册执行闭环" tag="Loop">
      <div className="gradebook-execution-loop">
        <div className="feature-card gradebook-execution-loop-hero">
          <EduIcon name="board" />
          <div>
            <div className="gradebook-execution-loop-kicker">别把成绩册只当导出页</div>
            <div className="gradebook-execution-loop-title">
              先收临近截止作业，再追未收口学生，最后回看完成率和成绩变化。
            </div>
            <p className="gradebook-execution-loop-description">
              成绩册的价值不是列出所有数据，而是帮助你更快决定今天先收哪份作业、先追哪批学生，以及什么时候该转去学情分析。
            </p>
          </div>
        </div>

        <div className="gradebook-execution-loop-signal-grid">
          {loopSignals.map((item) => (
            <div className="gradebook-execution-loop-signal-card" key={item.id}>
              <div className="gradebook-execution-loop-signal-label">{item.label}</div>
              <div className="gradebook-execution-loop-signal-value">{item.value}</div>
              <div className="meta-text">{item.meta}</div>
            </div>
          ))}
        </div>

        <div className="gradebook-execution-loop-grid">
          {loopSteps.map((item, index) => (
            <div className="gradebook-execution-loop-step" key={item.id}>
              <div className="gradebook-execution-loop-step-head">
                <span className="gradebook-execution-loop-step-index">{item.step}</span>
                <div>
                  <div className="gradebook-execution-loop-step-kicker">{item.kicker}</div>
                  <div className="gradebook-execution-loop-step-title">{item.title}</div>
                </div>
              </div>
              <p className="gradebook-execution-loop-step-description">{item.description}</p>
              <div className="meta-text">{item.meta}</div>
              <div className="cta-row" style={{ marginTop: 10 }}>
                {item.href.startsWith("#") ? (
                  <a className={index === 0 ? "button primary" : "button secondary"} href={item.href}>
                    {item.actionLabel}
                  </a>
                ) : (
                  <Link className={index === 0 ? "button primary" : "button secondary"} href={item.href}>
                    {item.actionLabel}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
