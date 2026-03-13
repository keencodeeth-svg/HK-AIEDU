"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import { ASSIGNMENT_TYPE_LABELS, SUBJECT_LABELS } from "@/lib/constants";
import AssignmentExecutionLoopCard from "./_components/AssignmentExecutionLoopCard";
import type {
  AssignmentNotifyTarget,
  AssignmentStudentFilter,
  RubricItem,
  RubricLevel,
  RubricPayloadItem,
  TeacherAssignmentDetailData,
  TeacherAssignmentStudent
} from "./types";

const STUDENT_FILTER_LABELS: Record<AssignmentStudentFilter, string> = {
  all: "全部学生",
  pending: "未完成",
  review: "待批改",
  low_score: "低于 60%",
  completed: "已完成"
};

function normalizeRubricItems(items: RubricPayloadItem[] = []): RubricItem[] {
  return items.map((item) => ({
    title: item.title ?? "",
    description: item.description ?? "",
    maxScore: Number(item.maxScore ?? 5),
    weight: Number(item.weight ?? 1),
    levels: Array.isArray(item.levels)
      ? item.levels.map((level) => ({
          label: level.label ?? "",
          score: Number(level.score ?? 0),
          description: level.description ?? ""
        }))
      : []
  }));
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDateOnly(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("zh-CN");
}

function getDueRelativeLabel(dueDate: string, now: number) {
  const diffMs = new Date(dueDate).getTime() - now;
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return `已逾期 ${Math.abs(diffDays)} 天`;
  if (diffDays === 0) return "今天截止";
  if (diffDays === 1) return "明天截止";
  return `${diffDays} 天后截止`;
}

function getStudentStatusLabel(status: string, assignmentOverdue: boolean) {
  if (status === "completed") return "已完成";
  return assignmentOverdue ? "已逾期未交" : "待提交";
}

function getStudentStatusPillClassName(status: string, assignmentOverdue: boolean) {
  if (status === "completed") return "gradebook-pill done";
  return assignmentOverdue ? "gradebook-pill overdue" : "gradebook-pill pending";
}

function getStudentPriority(student: TeacherAssignmentStudent, assignmentOverdue: boolean) {
  if (student.status !== "completed") {
    return {
      label: assignmentOverdue ? "优先催交" : "待提交",
      detail: assignmentOverdue ? "截止已过，应该先发提醒或线下跟进" : "截止前仍未提交，需要尽快确认"
    };
  }

  if (student.score === null || student.total === null) {
    return {
      label: "待批改",
      detail: "学生已提交，但当前还没有可回看的评分结果"
    };
  }

  if (student.total > 0 && student.score / student.total < 0.6) {
    return {
      label: "需要复盘",
      detail: `当前得分 ${Math.round((student.score / student.total) * 100)}%，建议先回看错因`
    };
  }

  return {
    label: "已稳定",
    detail: "当前已完成且没有明显风险，可以放到后续抽查"
  };
}

export default function TeacherAssignmentDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<TeacherAssignmentDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notifyTarget, setNotifyTarget] = useState<AssignmentNotifyTarget>("missing");
  const [threshold, setThreshold] = useState(60);
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifyResult, setNotifyResult] = useState<string | null>(null);
  const [rubrics, setRubrics] = useState<RubricItem[]>([]);
  const [rubricMessage, setRubricMessage] = useState<string | null>(null);
  const [rubricError, setRubricError] = useState<string | null>(null);
  const [rubricSaving, setRubricSaving] = useState(false);
  const [studentFilter, setStudentFilter] = useState<AssignmentStudentFilter>("all");
  const [studentKeyword, setStudentKeyword] = useState("");
  const now = Date.now();

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/teacher/assignments/${params.id}`);
    const payload = await res.json();
    if (!res.ok) {
      setError(payload?.error ?? "加载失败");
      return;
    }
    setData(payload);
  }, [params.id]);

  const loadRubrics = useCallback(async () => {
    const res = await fetch(`/api/teacher/assignments/${params.id}/rubrics`);
    const payload = await res.json();
    if (res.ok) {
      setRubrics(normalizeRubricItems(payload.data ?? []));
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadRubrics();
  }, [loadRubrics]);

  const assignmentOverdue = useMemo(
    () => (data ? new Date(data.assignment.dueDate).getTime() < now : false),
    [data, now]
  );
  const completedStudents = useMemo(
    () => data?.students.filter((student) => student.status === "completed") ?? [],
    [data]
  );
  const pendingStudents = useMemo(
    () => data?.students.filter((student) => student.status !== "completed") ?? [],
    [data]
  );
  const reviewReadyStudents = useMemo(
    () =>
      completedStudents.filter((student) => student.score === null || student.total === null),
    [completedStudents]
  );
  const scoredStudents = useMemo(
    () =>
      completedStudents.filter(
        (student) => student.score !== null && student.total !== null && student.total > 0
      ),
    [completedStudents]
  );
  const lowScoreStudents = useMemo(
    () => scoredStudents.filter((student) => student.score! / student.total! < 0.6),
    [scoredStudents]
  );
  const latestCompletedStudent = useMemo(
    () =>
      [...completedStudents].sort((left, right) => {
        const leftTs = new Date(left.completedAt ?? "").getTime();
        const rightTs = new Date(right.completedAt ?? "").getTime();
        return rightTs - leftTs;
      })[0] ?? null,
    [completedStudents]
  );
  const completionRate = data?.students.length
    ? Math.round((completedStudents.length / data.students.length) * 100)
    : 0;
  const averagePercent = scoredStudents.length
    ? Math.round(
        scoredStudents.reduce((sum, student) => sum + (student.score! / student.total!) * 100, 0) /
          scoredStudents.length
      )
    : null;
  const notifyPreviewStudents = useMemo(() => {
    if (!data) return [];
    if (notifyTarget === "missing") return pendingStudents;
    if (notifyTarget === "low_score") {
      return scoredStudents.filter((student) => (student.score! / student.total!) * 100 < threshold);
    }
    return data.students;
  }, [data, notifyTarget, pendingStudents, scoredStudents, threshold]);
  const hasStudentFilters = Boolean(studentFilter !== "all" || studentKeyword.trim());

  const filteredStudents = useMemo(() => {
    if (!data) return [];
    const keywordLower = studentKeyword.trim().toLowerCase();
    let list = data.students;

    if (studentFilter === "pending") {
      list = list.filter((student) => student.status !== "completed");
    } else if (studentFilter === "review") {
      list = list.filter(
        (student) => student.status === "completed" && (student.score === null || student.total === null)
      );
    } else if (studentFilter === "low_score") {
      list = list.filter(
        (student) =>
          student.status === "completed" &&
          student.score !== null &&
          student.total !== null &&
          student.total > 0 &&
          student.score / student.total < 0.6
      );
    } else if (studentFilter === "completed") {
      list = list.filter((student) => student.status === "completed");
    }

    if (keywordLower) {
      list = list.filter((student) =>
        [student.name, student.email, student.grade ?? ""].join(" ").toLowerCase().includes(keywordLower)
      );
    }

    const getRank = (student: TeacherAssignmentStudent) => {
      if (student.status !== "completed") return assignmentOverdue ? 0 : 1;
      if (student.score === null || student.total === null) return 2;
      if (student.total > 0 && student.score / student.total < 0.6) return 3;
      return 4;
    };

    return [...list].sort((left, right) => {
      const rankDiff = getRank(left) - getRank(right);
      if (rankDiff !== 0) return rankDiff;
      if (left.status === "completed" && right.status === "completed") {
        const leftTs = new Date(left.completedAt ?? "").getTime();
        const rightTs = new Date(right.completedAt ?? "").getTime();
        return rightTs - leftTs;
      }
      return left.name.localeCompare(right.name, "zh-CN");
    });
  }, [assignmentOverdue, data, studentFilter, studentKeyword]);

  function updateRubric(index: number, patch: Partial<RubricItem>) {
    setRubrics((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  }

  function updateLevel(rubricIndex: number, levelIndex: number, patch: Partial<RubricLevel>) {
    setRubrics((prev) =>
      prev.map((item, idx) => {
        if (idx !== rubricIndex) return item;
        const levels = item.levels.map((level, lidx) =>
          lidx === levelIndex ? { ...level, ...patch } : level
        );
        return { ...item, levels };
      })
    );
  }

  function addRubric() {
    setRubrics((prev) => [
      ...prev,
      {
        title: "评分维度",
        description: "",
        maxScore: 10,
        weight: 1,
        levels: [
          { label: "优秀", score: 10, description: "表现优秀" },
          { label: "良好", score: 8, description: "表现良好" },
          { label: "需改进", score: 6, description: "需要改进" }
        ]
      }
    ]);
  }

  function removeRubric(index: number) {
    setRubrics((prev) => prev.filter((_, idx) => idx !== index));
  }

  function addLevel(index: number) {
    setRubrics((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              levels: [...item.levels, { label: "分档", score: item.maxScore, description: "" }]
            }
          : item
      )
    );
  }

  function removeLevel(rubricIndex: number, levelIndex: number) {
    setRubrics((prev) =>
      prev.map((item, idx) =>
        idx === rubricIndex ? { ...item, levels: item.levels.filter((_, lidx) => lidx !== levelIndex) } : item
      )
    );
  }

  function handleClearStudentFilters() {
    setStudentFilter("all");
    setStudentKeyword("");
  }

  if (error) {
    return (
      <Card title="作业详情">
        <StatePanel
          compact
          tone="error"
          title="作业详情加载失败"
          description={error}
          action={
            <Link className="button secondary" href="/teacher/submissions">
              回提交箱
            </Link>
          }
        />
      </Card>
    );
  }

  if (!data) {
    return (
      <Card title="作业详情">
        <StatePanel
          compact
          tone="loading"
          title="作业详情加载中"
          description="正在同步作业、学生提交与评分细则。"
        />
      </Card>
    );
  }

  const dueRelativeLabel = getDueRelativeLabel(data.assignment.dueDate, now);
  const lessonContext = data.lessonLink
    ? [
        data.lessonLink.lessonDate,
        data.lessonLink.startTime && data.lessonLink.endTime
          ? `${data.lessonLink.startTime}-${data.lessonLink.endTime}`
          : null,
        data.lessonLink.slotLabel ?? null,
        data.lessonLink.room ?? null
      ]
        .filter(Boolean)
        .join(" · ")
    : null;
  const rubricLevelCount = rubrics.reduce((sum, item) => sum + item.levels.length, 0);

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>{data.assignment.title}</h2>
          <div className="section-sub">
            {data.class.name} · {SUBJECT_LABELS[data.class.subject] ?? data.class.subject} · {data.class.grade} 年级
          </div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">{ASSIGNMENT_TYPE_LABELS[data.assignment.submissionType ?? "quiz"]}</span>
          <span className="chip">{dueRelativeLabel}</span>
          <span className="chip">完成 {completedStudents.length}/{data.students.length}</span>
          {reviewReadyStudents.length ? <span className="chip">待批改 {reviewReadyStudents.length}</span> : null}
          {lowScoreStudents.length ? <span className="chip">低于60% {lowScoreStudents.length}</span> : null}
          {data.lessonLink ? <span className="chip">课前预习</span> : null}
        </div>
      </div>

      <AssignmentExecutionLoopCard
        assignmentId={data.assignment.id}
        assignmentTitle={data.assignment.title}
        dueDate={data.assignment.dueDate}
        submissionType={data.assignment.submissionType ?? "quiz"}
        students={data.students}
        now={now}
      />

      <div className="assignment-detail-top-grid">
        <Card title="作业概览" tag="Overview">
          <div className="feature-card">
            <EduIcon name="board" />
            <div>
              <div className="section-title">{data.assignment.title}</div>
              <p>{data.assignment.description || "暂无作业说明。"}</p>
            </div>
          </div>

          <div className="workflow-card-meta">
            <span className="pill">创建于 {formatDateOnly(data.assignment.createdAt)}</span>
            <span className="pill">截止 {formatDateOnly(data.assignment.dueDate)}</span>
            {data.assignment.gradingFocus ? <span className="pill">批改重点：{data.assignment.gradingFocus}</span> : null}
            {data.module ? <span className="pill">关联模块：{data.module.title}</span> : null}
          </div>

          {lessonContext ? (
            <div className="meta-text" style={{ marginTop: 12 }}>
              关联课次：{lessonContext}
              {data.lessonLink?.focusSummary ? ` · 课堂焦点：${data.lessonLink.focusSummary}` : ""}
              {data.lessonLink?.note ? ` · 老师提醒：${data.lessonLink.note}` : ""}
            </div>
          ) : null}

          <div className="cta-row" style={{ marginTop: 12 }}>
            <Link className="button ghost" href="/teacher/submissions">
              回提交箱
            </Link>
            <Link className="button secondary" href={`/teacher/assignments/${data.assignment.id}/stats`}>
              去统计页
            </Link>
            <Link className="button secondary" href="/teacher">
              返回教师端
            </Link>
          </div>
        </Card>

        <Card title="当前执行面板" tag="Ops">
          <div className="grid grid-2">
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">完成率</div>
              <div className="workflow-summary-value">{completionRate}%</div>
              <div className="workflow-summary-helper">已提交 {completedStudents.length} / {data.students.length}</div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">待收口</div>
              <div className="workflow-summary-value">{pendingStudents.length}</div>
              <div className="workflow-summary-helper">优先清掉未提交学生</div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">待批改</div>
              <div className="workflow-summary-value">{reviewReadyStudents.length}</div>
              <div className="workflow-summary-helper">已交但暂无评分结果</div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">平均得分</div>
              <div className="workflow-summary-value">{averagePercent === null ? "-" : `${averagePercent}%`}</div>
              <div className="workflow-summary-helper">
                {lowScoreStudents.length ? `低于 60% 的学生 ${lowScoreStudents.length} 人` : "当前没有明显低分风险"}
              </div>
            </div>
          </div>

          <div className="pill-list" style={{ marginTop: 12 }}>
            <span className="pill">已评分 {scoredStudents.length} 人</span>
            <span className="pill">待提醒 {pendingStudents.length} 人</span>
            <span className="pill">Rubric 维度 {rubrics.length} 个</span>
            <span className="pill">Rubric 分档 {rubricLevelCount} 条</span>
          </div>

          <div className="meta-text" style={{ marginTop: 12 }}>
            当前名单已经按执行优先级处理：未提交学生会排在最前，其次是待批改和低分学生，最后才是稳定完成的学生。
          </div>
        </Card>
      </div>

      <Card title="学生跟进明细" tag="Roster">
        <div className="grid grid-2" style={{ alignItems: "end" }}>
          <label>
            <div className="section-title">名单筛选</div>
            <select
              value={studentFilter}
              onChange={(event) => setStudentFilter(event.target.value as AssignmentStudentFilter)}
              style={{ width: "100%" }}
            >
              <option value="all">全部学生</option>
              <option value="pending">未完成</option>
              <option value="review">待批改</option>
              <option value="low_score">低于 60%</option>
              <option value="completed">已完成</option>
            </select>
          </label>
          <label>
            <div className="section-title">关键字</div>
            <input
              value={studentKeyword}
              onChange={(event) => setStudentKeyword(event.target.value)}
              placeholder="学生姓名 / 邮箱 / 年级"
              style={{ width: "100%" }}
            />
          </label>
        </div>

        <div className="cta-row cta-row-tight" style={{ marginTop: 12 }}>
          <button className="button ghost" type="button" onClick={handleClearStudentFilters} disabled={!hasStudentFilters}>
            清空筛选
          </button>
          <a className="button secondary" href="#assignment-notify">
            去提醒面板
          </a>
        </div>

        <div className="workflow-card-meta">
          <span className="pill">当前筛选：{STUDENT_FILTER_LABELS[studentFilter]}</span>
          <span className="pill">结果 {filteredStudents.length} 人</span>
          {latestCompletedStudent ? <span className="pill">最新完成：{latestCompletedStudent.name}</span> : null}
        </div>

        <div className="meta-text" style={{ marginTop: 12 }}>
          列表默认按优先级排序：未完成 {"->"} 待批改 {"->"} 低分复盘 {"->"} 其余已完成。这样你从提交箱点进来后，不需要再自己重排。
        </div>

        {!filteredStudents.length ? (
          <StatePanel
            compact
            tone="empty"
            title="没有匹配的学生"
            description="试试放宽筛选条件，或者切回全部学生。"
            action={
              <button className="button secondary" type="button" onClick={handleClearStudentFilters}>
                清空筛选
              </button>
            }
          />
        ) : (
          <div id="assignment-students" style={{ overflowX: "auto", marginTop: 12 }}>
            <table className="gradebook-table">
              <thead>
                <tr>
                  <th>学生</th>
                  <th>状态</th>
                  <th>当前判断</th>
                  <th>得分/批改</th>
                  <th>完成时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const priority = getStudentPriority(student, assignmentOverdue);
                  const hasScore = student.score !== null && student.total !== null && student.total > 0;
                  const needsReview = student.status === "completed" && !hasScore;
                  return (
                    <tr key={student.id}>
                      <td>
                        <div>{student.name}</div>
                        <div className="workflow-summary-helper">
                          {student.email}
                          {student.grade ? ` · ${student.grade}` : ""}
                        </div>
                      </td>
                      <td>
                        <span className={getStudentStatusPillClassName(student.status, assignmentOverdue)}>
                          {getStudentStatusLabel(student.status, assignmentOverdue)}
                        </span>
                      </td>
                      <td>
                        <div>{priority.label}</div>
                        <div className="workflow-summary-helper">{priority.detail}</div>
                      </td>
                      <td>
                        {student.status !== "completed"
                          ? "未提交"
                          : hasScore
                            ? `${student.score ?? 0}/${student.total ?? 0}`
                            : "已提交待评分"}
                      </td>
                      <td>{student.status === "completed" ? formatDateTime(student.completedAt) : "-"}</td>
                      <td>
                        {student.status === "completed" ? (
                          <Link className="button ghost" href={`/teacher/assignments/${data.assignment.id}/reviews/${student.id}`}>
                            {needsReview ? "开始批改" : "进入复盘"}
                          </Link>
                        ) : (
                          <a className="button ghost" href="#assignment-notify">
                            去发提醒
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="提醒学生" tag="Message">
        <div id="assignment-notify">
          <div className="feature-card">
            <EduIcon name="rocket" />
            <div>
              <div className="section-title">把提醒当成收口动作，而不是群发通知</div>
              <p>先选目标，再预览人数，最后发送。这样老师在催交或拉回低分学生时，心里有清晰的覆盖范围。</p>
            </div>
          </div>

          <div className="workflow-card-meta">
            <span className="pill">未完成 {pendingStudents.length} 人</span>
            <span className="pill">低于 60% {lowScoreStudents.length} 人</span>
            <span className="pill">当前预计触达 {notifyPreviewStudents.length} 人</span>
            {notifyTarget === "low_score" ? <span className="pill">阈值 {threshold}%</span> : null}
          </div>

          <div className="grid" style={{ gap: 12, marginTop: 12 }}>
            <label>
              <div className="section-title">提醒对象</div>
              <select
                value={notifyTarget}
                onChange={(event) => setNotifyTarget(event.target.value as AssignmentNotifyTarget)}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
              >
                <option value="missing">未提交作业</option>
                <option value="low_score">得分低于阈值</option>
                <option value="all">全部学生</option>
              </select>
            </label>
            {notifyTarget === "low_score" ? (
              <label>
                <div className="section-title">分数阈值（百分比）</div>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={threshold}
                  onChange={(event) => setThreshold(Number(event.target.value))}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                />
              </label>
            ) : null}
            <label>
              <div className="section-title">提醒文案（可选）</div>
              <textarea
                value={notifyMessage}
                onChange={(event) => setNotifyMessage(event.target.value)}
                rows={3}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                placeholder="例如：今晚 8 点前完成提交，明天课上会直接接这份作业。"
              />
            </label>
          </div>

          {notifyResult ? <div style={{ marginTop: 8, fontSize: 12 }}>{notifyResult}</div> : null}

          <div className="cta-row" style={{ marginTop: 12 }}>
            <button
              className="button primary"
              type="button"
              disabled={notifyLoading}
              onClick={async () => {
                setNotifyLoading(true);
                setNotifyResult(null);
                const res = await fetch(`/api/teacher/assignments/${data.assignment.id}/notify`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ target: notifyTarget, threshold, message: notifyMessage })
                });
                const payload = await res.json();
                if (!res.ok) {
                  setNotifyResult(payload?.error ?? "提醒失败");
                } else {
                  setNotifyResult(`已通知学生 ${payload.data?.students ?? 0} 人，家长 ${payload.data?.parents ?? 0} 人。`);
                }
                setNotifyLoading(false);
              }}
            >
              {notifyLoading ? "发送中..." : "发送提醒"}
            </button>
          </div>
        </div>
      </Card>

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

        <div className="grid" style={{ gap: 12, marginTop: 12 }}>
          {rubrics.map((rubric, index) => (
            <div className="card" key={`rubric-${index}`}>
              <div className="card-header">
                <div className="section-title">维度 {index + 1}</div>
                <button className="button ghost" type="button" onClick={() => removeRubric(index)}>
                  删除维度
                </button>
              </div>
              <div className="grid" style={{ gap: 10 }}>
                <label>
                  <div className="section-title">维度名称</div>
                  <input
                    value={rubric.title}
                    onChange={(event) => updateRubric(index, { title: event.target.value })}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                  />
                </label>
                <label>
                  <div className="section-title">维度说明</div>
                  <input
                    value={rubric.description ?? ""}
                    onChange={(event) => updateRubric(index, { description: event.target.value })}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                  />
                </label>
                <div className="grid grid-2">
                  <label>
                    <div className="section-title">满分</div>
                    <input
                      type="number"
                      min={1}
                      value={rubric.maxScore}
                      onChange={(event) => updateRubric(index, { maxScore: Number(event.target.value) })}
                      style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                    />
                  </label>
                  <label>
                    <div className="section-title">权重</div>
                    <input
                      type="number"
                      min={1}
                      value={rubric.weight}
                      onChange={(event) => updateRubric(index, { weight: Number(event.target.value) })}
                      style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
                    />
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
                            <input
                              value={level.label}
                              onChange={(event) => updateLevel(index, levelIndex, { label: event.target.value })}
                              style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid var(--stroke)" }}
                            />
                          </label>
                          <label>
                            <div className="section-title">建议得分</div>
                            <input
                              type="number"
                              min={0}
                              value={level.score}
                              onChange={(event) => updateLevel(index, levelIndex, { score: Number(event.target.value) })}
                              style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid var(--stroke)" }}
                            />
                          </label>
                        </div>
                        <label>
                          <div className="section-title">描述</div>
                          <input
                            value={level.description}
                            onChange={(event) => updateLevel(index, levelIndex, { description: event.target.value })}
                            style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid var(--stroke)" }}
                          />
                        </label>
                        <button className="button ghost" type="button" onClick={() => removeLevel(index, levelIndex)}>
                          删除档位
                        </button>
                      </div>
                    ))}
                  </div>
                  <button className="button secondary" type="button" onClick={() => addLevel(index)}>
                    添加分档
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {rubricError ? <div style={{ marginTop: 8, color: "#b42318", fontSize: 13 }}>{rubricError}</div> : null}
        {rubricMessage ? <div style={{ marginTop: 8, color: "#027a48", fontSize: 13 }}>{rubricMessage}</div> : null}
        <div className="cta-row" style={{ marginTop: 12 }}>
          <button className="button secondary" type="button" onClick={addRubric}>
            添加评分维度
          </button>
          <button
            className="button primary"
            type="button"
            disabled={rubricSaving}
            onClick={async () => {
              setRubricSaving(true);
              setRubricMessage(null);
              setRubricError(null);
              const res = await fetch(`/api/teacher/assignments/${data.assignment.id}/rubrics`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: rubrics })
              });
              const payload = await res.json();
              if (!res.ok) {
                setRubricError(payload?.error ?? "保存失败");
              } else {
                setRubricMessage("评分细则已保存");
                setRubrics(normalizeRubricItems(payload.data ?? []));
              }
              setRubricSaving(false);
            }}
          >
            {rubricSaving ? "保存中..." : "保存评分细则"}
          </button>
        </div>
      </Card>
    </div>
  );
}
