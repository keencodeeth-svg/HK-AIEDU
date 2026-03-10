"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import { ASSIGNMENT_TYPE_LABELS, SUBJECT_LABELS } from "@/lib/constants";

type AssignmentDetail = {
  assignment: {
    id: string;
    title: string;
    description?: string;
    dueDate: string;
    createdAt: string;
    submissionType?: "quiz" | "upload" | "essay";
    gradingFocus?: string;
    moduleId?: string;
  };
  module?: { id: string; title: string } | null;
  class: {
    id: string;
    name: string;
    subject: string;
    grade: string;
  };
  lessonLink?: {
    taskKind: "prestudy";
    lessonDate: string;
    note?: string;
    scheduleSessionId: string;
    slotLabel?: string;
    startTime?: string;
    endTime?: string;
    room?: string;
    focusSummary?: string;
  } | null;
  students: Array<{
    id: string;
    name: string;
    email: string;
    grade?: string;
    status: string;
    score: number | null;
    total: number | null;
    completedAt: string | null;
  }>;
};

type RubricLevel = { label: string; score: number; description: string };
type RubricItem = {
  title: string;
  description?: string;
  maxScore: number;
  weight: number;
  levels: RubricLevel[];
};

type RubricPayloadLevel = {
  label?: string;
  score?: number;
  description?: string;
};

type RubricPayloadItem = {
  title?: string;
  description?: string;
  maxScore?: number;
  weight?: number;
  levels?: RubricPayloadLevel[] | null;
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

export default function TeacherAssignmentDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<AssignmentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notifyTarget, setNotifyTarget] = useState<"missing" | "low_score" | "all">("missing");
  const [threshold, setThreshold] = useState(60);
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifyResult, setNotifyResult] = useState<string | null>(null);
  const [rubrics, setRubrics] = useState<RubricItem[]>([]);
  const [rubricMessage, setRubricMessage] = useState<string | null>(null);
  const [rubricError, setRubricError] = useState<string | null>(null);
  const [rubricSaving, setRubricSaving] = useState(false);

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
    load();
  }, [load]);

  useEffect(() => {
    loadRubrics();
  }, [loadRubrics]);

  if (error) {
    return (
      <Card title="作业详情">
        <p>{error}</p>
        <Link className="button secondary" href="/teacher" style={{ marginTop: 12 }}>
          返回教师端
        </Link>
      </Card>
    );
  }

  if (!data) {
    return <Card title="作业详情">加载中...</Card>;
  }

  const completedCount = data.students.filter((item) => item.status === "completed").length;

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

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>作业详情</h2>
          <div className="section-sub">
            {data.class.name} · {SUBJECT_LABELS[data.class.subject] ?? data.class.subject} · {data.class.grade} 年级
          </div>
        </div>
        <div className="pill-list">
          <span className="chip">已完成 {completedCount}/{data.students.length}</span>
          {data.lessonLink ? <span className="chip">课前预习</span> : null}
        </div>
      </div>

      <Card title="作业概览" tag="概览">
        <div className="grid grid-2">
          <div className="card feature-card">
            <EduIcon name="board" />
            <div className="section-title">{data.assignment.title}</div>
            <p>{data.assignment.description || "暂无作业说明。"}</p>
            {data.assignment.gradingFocus ? (
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-1)" }}>
                批改重点：{data.assignment.gradingFocus}
              </div>
            ) : null}
            {data.module ? (
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-1)" }}>
                关联模块：{data.module.title}
              </div>
            ) : null}
            {data.lessonLink ? (
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-1)", lineHeight: 1.6 }}>
                关联课次：{data.lessonLink.lessonDate}
                {data.lessonLink.startTime && data.lessonLink.endTime ? ` · ${data.lessonLink.startTime}-${data.lessonLink.endTime}` : ""}
                {data.lessonLink.slotLabel ? ` · ${data.lessonLink.slotLabel}` : ""}
                {data.lessonLink.room ? ` · ${data.lessonLink.room}` : ""}
                {data.lessonLink.focusSummary ? ` · 课堂焦点：${data.lessonLink.focusSummary}` : ""}
                {data.lessonLink.note ? ` · 老师提醒：${data.lessonLink.note}` : ""}
              </div>
            ) : null}
          </div>
          <div className="card feature-card">
            <EduIcon name="chart" />
            <div className="section-title">截止日期</div>
            <p>{new Date(data.assignment.dueDate).toLocaleDateString("zh-CN")}</p>
            <div className="pill-list">
              <span className="pill">已完成 {completedCount}</span>
              <span className="pill">待完成 {data.students.length - completedCount}</span>
              <span className="pill">
                {ASSIGNMENT_TYPE_LABELS[data.assignment.submissionType ?? "quiz"]}
              </span>
            </div>
          </div>
        </div>
        <div className="cta-row" style={{ marginTop: 12 }}>
          <Link className="button ghost" href="/teacher">
            返回教师端
          </Link>
          <Link className="button secondary" href={`/teacher/assignments/${data.assignment.id}/stats`}>
            查看统计
          </Link>
        </div>
      </Card>

      <Card title="评分细则（Rubric）" tag="评分">
        <div className="feature-card">
          <EduIcon name="chart" />
          <p>设置评分维度、权重与分档描述，学生端可查看评分细则。</p>
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
                              onChange={(event) =>
                                updateLevel(index, levelIndex, { label: event.target.value })
                              }
                              style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid var(--stroke)" }}
                            />
                          </label>
                          <label>
                            <div className="section-title">建议得分</div>
                            <input
                              type="number"
                              min={0}
                              value={level.score}
                              onChange={(event) =>
                                updateLevel(index, levelIndex, { score: Number(event.target.value) })
                              }
                              style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid var(--stroke)" }}
                            />
                          </label>
                        </div>
                        <label>
                          <div className="section-title">描述</div>
                          <input
                            value={level.description}
                            onChange={(event) =>
                              updateLevel(index, levelIndex, { description: event.target.value })
                            }
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

      <Card title="提醒学生" tag="消息">
        <div className="feature-card">
          <EduIcon name="rocket" />
          <p>快速发送提醒给未完成或成绩偏低的学生与家长。</p>
        </div>
        <div className="grid" style={{ gap: 12 }}>
          <label>
            <div className="section-title">提醒对象</div>
            <select
              value={notifyTarget}
              onChange={(event) => setNotifyTarget(event.target.value as "missing" | "low_score" | "all")}
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
              placeholder="例如：作业即将到期，请尽快完成。"
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
      </Card>

      <Card title="学生完成情况" tag="班级">
        {data.students.length === 0 ? (
          <p>暂无学生。</p>
        ) : (
          <div className="grid" style={{ gap: 12 }}>
            {data.students.map((student) => (
              <div className="card" key={student.id}>
                <div className="card-header">
                  <div className="section-title">{student.name}</div>
                  <span className="card-tag">{student.status === "completed" ? "已完成" : "待完成"}</span>
                </div>
                <div className="section-sub">{student.email}</div>
                {student.status === "completed" ? (
                  <div className="pill-list" style={{ marginTop: 10 }}>
                    {data.assignment.submissionType === "quiz" ? (
                      <span className="pill">
                        得分 {student.score ?? 0}/{student.total ?? 0}
                      </span>
                    ) : (
                      <span className="pill">已提交待评分</span>
                    )}
                    <span className="pill">
                      完成时间 {student.completedAt ? new Date(student.completedAt).toLocaleDateString("zh-CN") : "-"}
                    </span>
                  </div>
                ) : (
                  <div className="pill-list" style={{ marginTop: 10 }}>
                    <span className="pill">未提交</span>
                  </div>
                )}
                <Link
                  className="button secondary"
                  href={`/teacher/assignments/${data.assignment.id}/reviews/${student.id}`}
                  style={{ marginTop: 8 }}
                >
                  批改/复盘
                </Link>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
