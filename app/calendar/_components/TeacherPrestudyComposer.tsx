"use client";

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import type { Difficulty } from "@/lib/types";
import type { ScheduleLessonBase } from "@/lib/class-schedules";
import { getRequestErrorMessage, requestJson } from "@/lib/client-request";

type TeacherPrestudyComposerProps = {
  lesson: ScheduleLessonBase;
  lessonDate: string;
  lessonStartAt: string;
  onCreated?: () => void | Promise<void>;
  onClose: () => void;
};

type PrestudyCreateResponse = {
  data?: { id: string; dueDate: string };
  existing?: boolean;
  link?: { lessonDate: string };
  message?: string;
};

const fieldStyle: CSSProperties = {
  width: "100%",
  border: "1px solid var(--stroke)",
  borderRadius: 12,
  padding: "10px 12px",
  background: "rgba(255,255,255,0.9)",
  color: "var(--text)"
};

function buildDefaultDueAt(lessonStartAt: string) {
  const start = new Date(lessonStartAt);
  const preferred = new Date(start);
  preferred.setHours(preferred.getHours() - 12);
  const latest = new Date(start.getTime() - 15 * 60 * 1000);
  const earliest = new Date(Math.min(latest.getTime(), Date.now() + 30 * 60 * 1000));
  if (preferred.getTime() >= earliest.getTime() && preferred.getTime() <= latest.getTime()) {
    return preferred;
  }
  if (earliest.getTime() <= latest.getTime()) {
    return earliest;
  }
  return new Date(Math.max(Date.now() + 15 * 60 * 1000, start.getTime() - 5 * 60 * 1000));
}

function toDateTimeLocalValue(isoString: string) {
  const date = new Date(isoString);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

export default function TeacherPrestudyComposer({
  lesson,
  lessonDate,
  lessonStartAt,
  onCreated,
  onClose
}: TeacherPrestudyComposerProps) {
  const defaultTitle = useMemo(
    () => `预习任务：${lesson.className} · ${lesson.subjectLabel} ${lesson.weekdayLabel}${lesson.slotLabel ? ` · ${lesson.slotLabel}` : ""}`,
    [lesson.className, lesson.slotLabel, lesson.subjectLabel, lesson.weekdayLabel]
  );
  const defaultDescription = useMemo(() => {
    const parts = [`请在 ${lessonDate} 上课前完成本次预习，先把核心知识点和问题准备好。`];
    if (lesson.focusSummary) {
      parts.push(`课堂焦点：${lesson.focusSummary}`);
    }
    if (lesson.note) {
      parts.push(`老师提醒：${lesson.note}`);
    }
    return parts.join("\n");
  }, [lesson.focusSummary, lesson.note, lessonDate]);
  const defaultDueDate = useMemo(() => toDateTimeLocalValue(buildDefaultDueAt(lessonStartAt).toISOString()), [lessonStartAt]);

  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [submissionType, setSubmissionType] = useState<"quiz" | "upload" | "essay">("essay");
  const [questionCount, setQuestionCount] = useState("5");
  const [mode, setMode] = useState<"bank" | "ai">("ai");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [maxUploads, setMaxUploads] = useState("3");
  const [gradingFocus, setGradingFocus] = useState(lesson.focusSummary ?? "");
  const [note, setNote] = useState(lesson.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(defaultTitle);
    setDescription(defaultDescription);
    setDueDate(defaultDueDate);
    setSubmissionType("essay");
    setQuestionCount("5");
    setMode("ai");
    setDifficulty("medium");
    setMaxUploads("3");
    setGradingFocus(lesson.focusSummary ?? "");
    setNote(lesson.note ?? "");
    setError(null);
  }, [defaultDescription, defaultDueDate, defaultTitle, lesson.focusSummary, lesson.note, lessonDate, lessonStartAt]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      setError("请填写预习任务标题");
      return;
    }
    if (submissionType === "quiz" && (!questionCount || Number(questionCount) <= 0)) {
      setError("测验预习至少需要 1 道题");
      return;
    }

    setSaving(true);
    try {
      await requestJson<PrestudyCreateResponse>("/api/teacher/schedule-prestudy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: lesson.classId,
          scheduleSessionId: lesson.id,
          lessonDate,
          title: normalizedTitle,
          description,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          submissionType,
          questionCount: submissionType === "quiz" ? Number(questionCount) : undefined,
          mode: submissionType === "quiz" ? mode : undefined,
          difficulty: submissionType === "quiz" ? difficulty : undefined,
          maxUploads: submissionType === "upload" ? Number(maxUploads) : undefined,
          gradingFocus,
          note
        })
      });
      await onCreated?.();
      onClose();
    } catch (nextError) {
      setError(getRequestErrorMessage(nextError, "布置预习任务失败"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} style={{ marginTop: 10, background: "rgba(255,255,255,0.86)" }}>
      <div className="cta-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginTop: 0 }}>
        <div>
          <div className="section-title">布置课前预习</div>
          <div className="section-sub" style={{ marginTop: 4 }}>
            面向 {lessonDate} · {new Date(lessonStartAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} 开始的这节课
          </div>
        </div>
        <button className="button ghost" type="button" onClick={onClose} disabled={saving}>
          收起
        </button>
      </div>

      <div className="grid" style={{ gap: 10, marginTop: 10 }}>
        <label className="grid" style={{ gap: 6 }}>
          <span className="section-sub">任务标题</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} style={fieldStyle} />
        </label>

        <label className="grid" style={{ gap: 6 }}>
          <span className="section-sub">任务说明</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} style={fieldStyle} />
        </label>

        <div className="grid grid-3" style={{ gap: 10 }}>
          <label className="grid" style={{ gap: 6 }}>
            <span className="section-sub">截止时间</span>
            <input type="datetime-local" value={dueDate} onChange={(event) => setDueDate(event.target.value)} style={fieldStyle} />
          </label>
          <label className="grid" style={{ gap: 6 }}>
            <span className="section-sub">提交方式</span>
            <select value={submissionType} onChange={(event) => setSubmissionType(event.target.value as "quiz" | "upload" | "essay")} style={fieldStyle}>
              <option value="essay">文字作答</option>
              <option value="quiz">测验预习</option>
              <option value="upload">上传资料</option>
            </select>
          </label>
          <label className="grid" style={{ gap: 6 }}>
            <span className="section-sub">关注点</span>
            <input value={gradingFocus} onChange={(event) => setGradingFocus(event.target.value)} style={fieldStyle} placeholder="如：概念理解、例题步骤、课堂发言准备" />
          </label>
        </div>

        {submissionType === "quiz" ? (
          <div className="grid grid-3" style={{ gap: 10 }}>
            <label className="grid" style={{ gap: 6 }}>
              <span className="section-sub">题量</span>
              <input type="number" min={1} max={20} value={questionCount} onChange={(event) => setQuestionCount(event.target.value)} style={fieldStyle} />
            </label>
            <label className="grid" style={{ gap: 6 }}>
              <span className="section-sub">生成方式</span>
              <select value={mode} onChange={(event) => setMode(event.target.value as "bank" | "ai")} style={fieldStyle}>
                <option value="ai">AI 生成</option>
                <option value="bank">题库抽题</option>
              </select>
            </label>
            <label className="grid" style={{ gap: 6 }}>
              <span className="section-sub">难度</span>
              <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)} style={fieldStyle}>
                <option value="easy">基础</option>
                <option value="medium">适中</option>
                <option value="hard">进阶</option>
              </select>
            </label>
          </div>
        ) : null}

        {submissionType === "upload" ? (
          <div className="grid grid-2" style={{ gap: 10 }}>
            <label className="grid" style={{ gap: 6 }}>
              <span className="section-sub">最多上传</span>
              <input type="number" min={1} max={10} value={maxUploads} onChange={(event) => setMaxUploads(event.target.value)} style={fieldStyle} />
            </label>
            <label className="grid" style={{ gap: 6 }}>
              <span className="section-sub">老师备注</span>
              <input value={note} onChange={(event) => setNote(event.target.value)} style={fieldStyle} placeholder="如：拍书页 + 自己批注" />
            </label>
          </div>
        ) : null}

        {submissionType !== "upload" ? (
          <label className="grid" style={{ gap: 6 }}>
            <span className="section-sub">老师备注</span>
            <input value={note} onChange={(event) => setNote(event.target.value)} style={fieldStyle} placeholder="如：把不懂的点标出来，上课先问" />
          </label>
        ) : null}

        {error ? <div className="meta-text" style={{ color: "var(--danger, #c0392b)" }}>{error}</div> : null}

        <div className="cta-row" style={{ marginTop: 0 }}>
          <button className="button primary" type="submit" disabled={saving}>
            {saving ? "布置中..." : "确认布置预习"}
          </button>
          <button className="button ghost" type="button" onClick={onClose} disabled={saving}>
            取消
          </button>
        </div>
      </div>
    </form>
  );
}
