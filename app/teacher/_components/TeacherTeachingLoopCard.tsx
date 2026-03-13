"use client";

import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { SUBJECT_LABELS } from "@/lib/constants";
import type { AssignmentItem, ClassItem, TeacherInsightsData, TeacherJoinRequest } from "../types";

type TeacherTeachingLoopCardProps = {
  classes: ClassItem[];
  assignments: AssignmentItem[];
  joinRequests: TeacherJoinRequest[];
  insights: TeacherInsightsData | null;
};

function getHoursUntil(value: string) {
  return Math.ceil((new Date(value).getTime() - Date.now()) / (60 * 60 * 1000));
}

function formatDueDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

function buildTeachingLoop(props: TeacherTeachingLoopCardProps) {
  const pendingJoinRequests = props.joinRequests.filter((item) => item.status === "pending");
  const activeAlerts = (props.insights?.alerts ?? []).filter((item) => item.status === "active");
  const highRiskAlerts = activeAlerts.filter((item) => item.riskScore >= 80);
  const classesMissingAssignments = props.classes.filter((item) => item.studentCount > 0 && item.assignmentCount === 0);
  const assignmentsInProgress = props.assignments.filter((item) => item.completed < item.total);
  const dueSoonAssignments = assignmentsInProgress.filter((item) => getHoursUntil(item.dueDate) <= 48);
  const nextDueAssignment = [...dueSoonAssignments].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  )[0] ?? null;
  const topRiskClass = [...(props.insights?.riskClasses ?? [])].sort((a, b) => b.riskScore - a.riskScore)[0] ?? null;

  const stepOne = pendingJoinRequests.length
    ? {
        kicker: "先稳住阻塞项",
        title: `处理 ${pendingJoinRequests.length} 条入班申请`,
        description: "学生没进班，作业、提醒和分析数据都会断开。这一步先清掉，今天后面的教学动作才能落地。",
        meta: "这是最直接影响教学闭环的入口阻塞",
        href: "#teacher-join-requests",
        actionLabel: "审核申请"
      }
    : highRiskAlerts.length
      ? {
          kicker: "先稳住高风险",
          title: `优先处理 ${highRiskAlerts.length} 条高风险预警`,
          description: "先把风险学生和高风险知识点压住，再发作业和看常规统计，能更快稳住课堂节奏。",
          meta: `当前活跃预警 ${activeAlerts.length} 条`,
          href: "/teacher/analysis",
          actionLabel: "进入学情分析"
        }
      : activeAlerts.length
        ? {
            kicker: "先看风险信号",
            title: `今天先清掉 ${activeAlerts.length} 条活跃预警`,
            description: "已有预警说明问题已经浮现，先做闭环动作比继续堆新任务更值。",
            meta: "优先收口，再继续常规教学执行",
            href: "/teacher/analysis",
            actionLabel: "处理预警"
          }
        : {
            kicker: "先看当天盘面",
            title: "当前没有明显阻塞项",
            description: "可以直接进入当天教学执行，重点放在作业推进、课堂准备和效果复盘。",
            meta: "今天更适合做前置安排，而不是救火",
            href: "/teacher/analysis",
            actionLabel: "查看学情盘面"
          };

  const stepTwo = classesMissingAssignments.length
    ? {
        kicker: "再派发任务",
        title: `给 ${classesMissingAssignments.length} 个班级补上作业`,
        description: "这些班级已经有学生，但还没有形成任务闭环。先发出一版可执行作业，数据才会动起来。",
        meta: "优先补齐有学生但没作业的班级",
        href: "#teacher-compose-assignment",
        actionLabel: "去发布作业"
      }
    : nextDueAssignment
      ? {
          kicker: "再收口执行",
          title: `跟进「${nextDueAssignment.title}」的截止前收口`,
          description: `这份作业将在 ${formatDueDate(nextDueAssignment.dueDate)} 截止，当前完成 ${nextDueAssignment.completed}/${nextDueAssignment.total}，适合现在催收或复盘。`,
          meta: "临近截止的任务最容易引发逾期和补交",
          href: "/teacher/gradebook",
          actionLabel: "查看成绩册"
        }
      : props.classes.length
        ? {
            kicker: "再推进课堂动作",
            title: "今天可以前置准备下一轮教学任务",
            description: "当下没有明显缺口时，可以提前发下一轮作业、准备考试或安排课堂讲评资源。",
            meta: "用平稳窗口做前置准备，能减少后面堆积",
            href: "#teacher-compose-assignment",
            actionLabel: "继续发布任务"
          }
        : {
            kicker: "再搭基础结构",
            title: "先建班，再做后续发布",
            description: "作业、分析、排座都依赖班级和学生结构。先把第一步搭起来，后面流程才有意义。",
            meta: "没有班级时，先完成结构搭建",
            href: "#teacher-create-class",
            actionLabel: "去创建班级"
          };

  const stepThree = topRiskClass
    ? {
        kicker: "最后看效果",
        title: `回看 ${topRiskClass.className} 的风险变化`,
        description: `${SUBJECT_LABELS[topRiskClass.subject] ?? topRiskClass.subject} · ${topRiskClass.grade} 年级，当前风险分 ${topRiskClass.riskScore}。做完动作后，回来看风险分和薄弱点有没有下降。`,
        meta: "闭环不是做了动作，而是要看到风险有没有真的下降",
        href: "/teacher/analysis",
        actionLabel: "回看班级分析"
      }
    : {
        kicker: "最后看效果",
        title: "回成绩册和学情分析确认变化",
        description: "处理完当天动作后，回看完成率、风险分和薄弱点分布，确认今天的动作有没有真的起作用。",
        meta: "把执行动作沉淀成下一轮教学判断",
        href: "/teacher/gradebook",
        actionLabel: "查看效果"
      };

  return { stepOne, stepTwo, stepThree, pendingJoinRequests, activeAlerts, classesMissingAssignments, nextDueAssignment };
}

export default function TeacherTeachingLoopCard(props: TeacherTeachingLoopCardProps) {
  const { stepOne, stepTwo, stepThree, pendingJoinRequests, activeAlerts, classesMissingAssignments, nextDueAssignment } =
    buildTeachingLoop(props);

  const loopSignals = [
    {
      id: "blocker",
      label: "当前阻塞",
      value: pendingJoinRequests.length ? `${pendingJoinRequests.length} 条入班申请待审` : activeAlerts.length ? `${activeAlerts.length} 条预警待处理` : "当前没有明显阻塞项",
      meta: pendingJoinRequests.length ? "先清掉学生进班阻塞，后面数据链路才会通" : activeAlerts.length ? "先处理风险，再做常规发布更有效" : "可以把时间投到发布、复盘和课堂准备"
    },
    {
      id: "dispatch",
      label: "任务派发",
      value: classesMissingAssignments.length ? `${classesMissingAssignments.length} 个班级待补作业` : nextDueAssignment ? `优先跟进「${nextDueAssignment.title}」` : "今天可做前置教学安排",
      meta: classesMissingAssignments.length ? "优先补齐有学生但无任务的班级" : nextDueAssignment ? `截止前优先收口，避免明天堆逾期` : "适合补考试、讲评或下一轮任务"
    },
    {
      id: "verify",
      label: "效果验证",
      value: props.insights?.riskClasses?.length ? `${props.insights.riskClasses.length} 个班级已进入风险分析` : "回到成绩册和分析确认变化",
      meta: "做完动作后，要看风险分、完成率和薄弱点是否真的变化"
    }
  ];

  const loopSteps = [stepOne, stepTwo, stepThree];

  return (
    <Card title="今日教学闭环" tag="Loop">
      <div className="teacher-teaching-loop">
        <div className="feature-card teacher-teaching-loop-hero">
          <EduIcon name="rocket" />
          <div>
            <div className="teacher-teaching-loop-kicker">别在首页来回切入口</div>
            <div className="teacher-teaching-loop-title">
              先稳住风险和阻塞，再推进任务派发，最后回到学情和成绩看效果。
            </div>
            <p className="teacher-teaching-loop-description">
              教师首页不该只是工具集合，而应该把当天最短的教学执行路径排出来，减少你在“先做什么”上的切换成本。
            </p>
          </div>
        </div>

        <div className="teacher-teaching-loop-signal-grid">
          {loopSignals.map((item) => (
            <div className="teacher-teaching-loop-signal-card" key={item.id}>
              <div className="teacher-teaching-loop-signal-label">{item.label}</div>
              <div className="teacher-teaching-loop-signal-value">{item.value}</div>
              <div className="meta-text">{item.meta}</div>
            </div>
          ))}
        </div>

        <div className="teacher-teaching-loop-grid">
          {loopSteps.map((item, index) => (
            <div className="teacher-teaching-loop-step" key={item.title}>
              <div className="teacher-teaching-loop-step-head">
                <span className="teacher-teaching-loop-step-index">{`0${index + 1}`}</span>
                <div>
                  <div className="teacher-teaching-loop-step-kicker">{item.kicker}</div>
                  <div className="teacher-teaching-loop-step-title">{item.title}</div>
                </div>
              </div>
              <p className="teacher-teaching-loop-step-description">{item.description}</p>
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
