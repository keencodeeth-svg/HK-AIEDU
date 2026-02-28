"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { SUBJECT_LABELS } from "@/lib/constants";

type StudentExamItem = {
  id: string;
  title: string;
  description?: string;
  publishMode: "teacher_assigned" | "targeted";
  antiCheatLevel: "off" | "basic";
  examStatus: "published" | "closed";
  startAt?: string;
  endAt: string;
  durationMinutes?: number;
  className: string;
  classSubject: string;
  classGrade: string;
  status: "pending" | "in_progress" | "submitted";
  score: number | null;
  total: number | null;
  startedAt: string | null;
  submittedAt: string | null;
  availabilityStage: "upcoming" | "open" | "ended" | "closed";
  canEnter: boolean;
  canSubmit: boolean;
  lockReason: string | null;
  startsInMs: number;
  endsInMs: number;
  serverNow: string;
};

type TodayTaskItem = {
  id: string;
  source: string;
  title: string;
  description?: string;
  href: string;
  priority: number;
  dueAt?: string | null;
};

type TodayTaskSummary = {
  total: number;
  mustDo: number;
  highPriority: number;
};

export default function StudentExamsPage() {
  const [list, setList] = useState<StudentExamItem[]>([]);
  const [todayTasks, setTodayTasks] = useState<TodayTaskItem[]>([]);
  const [todaySummary, setTodaySummary] = useState<TodayTaskSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moduleTab, setModuleTab] = useState<"teacher_exam" | "self_assessment">("teacher_exam");

  async function load() {
    setError(null);
    const res = await fetch("/api/student/exams");
    const payload = await res.json();
    if (!res.ok) {
      setError(payload?.error ?? "加载失败");
      return;
    }
    setList(payload.data ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    fetch("/api/student/today-tasks")
      .then((res) => res.json())
      .then((payload) => {
        setTodayTasks(payload?.data?.tasks ?? []);
        setTodaySummary(payload?.data?.summary ?? null);
      })
      .catch(() => {
        setTodayTasks([]);
        setTodaySummary(null);
      });
  }, []);

  const grouped = useMemo(() => {
    const all = [...list].sort((a, b) => {
      if (a.availabilityStage === "open" && b.availabilityStage !== "open") return -1;
      if (a.availabilityStage !== "open" && b.availabilityStage === "open") return 1;
      return new Date(a.endAt).getTime() - new Date(b.endAt).getTime();
    });
    return {
      ongoing: all.filter((item) => item.status !== "submitted" && item.availabilityStage === "open"),
      upcoming: all.filter((item) => item.status !== "submitted" && item.availabilityStage === "upcoming"),
      finished: all.filter((item) => item.status === "submitted"),
      locked: all.filter(
        (item) => item.status !== "submitted" && (item.availabilityStage === "ended" || item.availabilityStage === "closed")
      )
    };
  }, [list]);

  const selfAssessmentTasks = useMemo(
    () =>
      todayTasks
        .filter((item) => item.source !== "teacher_exam" && item.href)
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 6),
    [todayTasks]
  );

  function stageLabel(item: StudentExamItem) {
    if (item.availabilityStage === "upcoming") return "待开始";
    if (item.availabilityStage === "open") return "开放中";
    if (item.availabilityStage === "ended") return "已截止";
    return "已关闭";
  }

  function renderExamCard(item: StudentExamItem) {
    return (
      <div className="card" key={item.id}>
        <div className="card-header">
          <div className="section-title">{item.title}</div>
          <span className="card-tag">
            {item.status === "submitted" ? "已提交" : item.status === "in_progress" ? "进行中" : "未提交"}
          </span>
        </div>
        <div className="feature-card">
          <EduIcon name="pencil" />
          <p>
            {item.className} · {SUBJECT_LABELS[item.classSubject] ?? item.classSubject} · {item.classGrade} 年级
          </p>
        </div>
        <div className="pill-list" style={{ marginTop: 8 }}>
          <span className="pill">{stageLabel(item)}</span>
          <span className="pill">
            发布 {item.publishMode === "teacher_assigned" ? "班级统一" : "定向"}
          </span>
          <span className="pill">
            监测 {item.antiCheatLevel === "basic" ? "开启" : "关闭"}
          </span>
          {item.startAt ? (
            <span className="pill">开始 {new Date(item.startAt).toLocaleString("zh-CN")}</span>
          ) : (
            <span className="pill">可立即开始</span>
          )}
          <span className="pill">截止 {new Date(item.endAt).toLocaleString("zh-CN")}</span>
          <span className="pill">
            时长 {item.durationMinutes ? `${item.durationMinutes} 分钟` : "不限"}
          </span>
          {item.status === "submitted" ? (
            <span className="pill">
              得分 {item.score ?? 0}/{item.total ?? 0}
            </span>
          ) : null}
        </div>
        {item.status !== "submitted" && item.lockReason ? (
          <div style={{ marginTop: 8, fontSize: 12, color: "#b42318" }}>{item.lockReason}</div>
        ) : null}
        <Link
          className="button secondary"
          href={`/student/exams/${item.id}`}
          style={{ marginTop: 10 }}
        >
          {item.status === "submitted" ? "查看结果" : item.canEnter ? "进入考试" : "查看详情"}
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <Card title="在线考试">
        <p>{error}</p>
        <Link className="button secondary" href="/student" style={{ marginTop: 12 }}>
          返回学生端
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>在线考试</h2>
          <div className="section-sub">老师发布考试与学生自主测评分模块管理，避免混淆。</div>
        </div>
        <span className="chip">共 {list.length} 场考试</span>
      </div>

      <div className="cta-row" style={{ marginTop: 0 }}>
        <button
          className={moduleTab === "teacher_exam" ? "button secondary" : "button ghost"}
          type="button"
          onClick={() => setModuleTab("teacher_exam")}
        >
          老师发布考试
        </button>
        <button
          className={moduleTab === "self_assessment" ? "button secondary" : "button ghost"}
          type="button"
          onClick={() => setModuleTab("self_assessment")}
        >
          学生自主测评
        </button>
      </div>

      {moduleTab === "teacher_exam" ? (
        <>
          <Card title="待进行" tag="考试">
            {grouped.ongoing.length === 0 ? <p>当前没有正在开放的考试。</p> : null}
            {grouped.ongoing.length ? (
              <div className="grid" style={{ gap: 12 }}>
                {grouped.ongoing.map(renderExamCard)}
              </div>
            ) : null}
          </Card>

          <Card title="即将开始" tag="待开始">
            {grouped.upcoming.length === 0 ? <p>暂无即将开始的考试。</p> : null}
            {grouped.upcoming.length ? (
              <div className="grid" style={{ gap: 12 }}>
                {grouped.upcoming.map(renderExamCard)}
              </div>
            ) : null}
          </Card>

          <Card title="已完成" tag="已提交">
            {grouped.finished.length === 0 ? <p>暂无已提交考试记录。</p> : null}
            {grouped.finished.length ? (
              <div className="grid" style={{ gap: 12 }}>
                {grouped.finished.map(renderExamCard)}
              </div>
            ) : null}
          </Card>

          <Card title="已截止/关闭" tag="锁定">
            {grouped.locked.length === 0 ? <p>暂无已截止但未提交的考试。</p> : null}
            {grouped.locked.length ? (
              <div className="grid" style={{ gap: 12 }}>
                {grouped.locked.map(renderExamCard)}
              </div>
            ) : null}
          </Card>
        </>
      ) : null}

      {moduleTab === "self_assessment" ? (
        <>
          <Card title="自主测评入口" tag="自主学习">
            <div className="feature-card">
              <EduIcon name="brain" />
              <p>自主测评结果用于个人学习计划与错题复练，不计入老师发布考试成绩。</p>
            </div>
            <div className="cta-row" style={{ marginTop: 10 }}>
              <Link className="button secondary" href="/diagnostic">
                进入诊断测评
              </Link>
              <Link className="button ghost" href="/practice">
                进入日常练习
              </Link>
              <Link className="button ghost" href="/wrong-book">
                进入错题复练
              </Link>
            </div>
          </Card>

          <Card title="今日自主任务" tag="计划">
            <div style={{ fontSize: 12, color: "var(--ink-1)", marginBottom: 8 }}>
              今日共 {todaySummary?.total ?? 0} 项任务，必须完成 {todaySummary?.mustDo ?? 0} 项，高优先级{" "}
              {todaySummary?.highPriority ?? 0} 项。
            </div>
            {selfAssessmentTasks.length === 0 ? <p>当前没有可执行的自主测评任务。</p> : null}
            {selfAssessmentTasks.length ? (
              <div className="grid" style={{ gap: 10 }}>
                {selfAssessmentTasks.map((task) => (
                  <div className="card" key={task.id}>
                    <div className="card-header">
                      <div className="section-title">{task.title}</div>
                      <span className="card-tag">优先级 {task.priority}</span>
                    </div>
                    <p>{task.description || "按计划完成该项自主任务。"}</p>
                    <Link className="button secondary" href={task.href} style={{ marginTop: 8 }}>
                      去完成
                    </Link>
                  </div>
                ))}
              </div>
            ) : null}
          </Card>
        </>
      ) : null}
    </div>
  );
}
