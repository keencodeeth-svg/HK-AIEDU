"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import { SUBJECT_LABELS, getGradeLabel } from "@/lib/constants";
import ExamCreateLoopCard from "./_components/ExamCreateLoopCard";

const DIFFICULTY_OPTIONS = [
  { value: "easy", label: "简单" },
  { value: "medium", label: "中等" },
  { value: "hard", label: "困难" }
];

const QUESTION_TYPE_OPTIONS = [
  { value: "choice", label: "选择题" },
  { value: "fill", label: "填空题" },
  { value: "qa", label: "问答题" }
];

const PUBLISH_MODE_OPTIONS = [
  { value: "teacher_assigned", label: "班级统一发布" },
  { value: "targeted", label: "定向发布" }
];

type ClassItem = {
  id: string;
  name: string;
  subject: string;
  grade: string;
};

type ClassStudent = {
  id: string;
  name: string;
  email: string;
  grade?: string;
};

type KnowledgePoint = {
  id: string;
  subject: string;
  grade: string;
  title: string;
  chapter: string;
  unit?: string;
};

type StageTrailItem = {
  stage: string;
  label: string;
  totalPoolCount: number;
  activePoolCount: number;
  isolatedExcludedCount: number;
};

type FormState = {
  classId: string;
  title: string;
  description: string;
  publishMode: "teacher_assigned" | "targeted";
  antiCheatLevel: "off" | "basic";
  studentIds: string[];
  startAt: string;
  endAt: string;
  durationMinutes: number;
  questionCount: number;
  knowledgePointId: string;
  difficulty: "easy" | "medium" | "hard";
  questionType: string;
  includeIsolated: boolean;
};

function getDefaultEndAt() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

function formatLoadedTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getQuestionTypeLabel(value: string) {
  return QUESTION_TYPE_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

function getDifficultyLabel(value: FormState["difficulty"]) {
  return DIFFICULTY_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

function getPublishModeLabel(value: FormState["publishMode"]) {
  return PUBLISH_MODE_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

function formatClassLabel(klass: ClassItem | undefined) {
  if (!klass) return "未选择班级";
  return `${klass.name} · ${SUBJECT_LABELS[klass.subject] ?? klass.subject} · ${getGradeLabel(klass.grade)}`;
}

function normalizeCreateErrorMessage(message: string) {
  const normalized = message.trim();
  if (normalized === "endAt must be after startAt") return "截止时间必须晚于开始时间。";
  if (normalized === "invalid datetime format") return "时间格式不正确，请重新选择开始和截止时间。";
  if (normalized === "questionCount must be greater than 0") return "题目数量至少为 1。";
  if (normalized === "studentIds required when publishMode is targeted") return "定向发布至少需要选择 1 名学生。";
  if (normalized === "studentIds must belong to class") return "定向学生必须属于当前班级。";
  if (normalized === "class not found") return "当前班级不存在或你没有发布权限。";
  return normalized;
}

function getScheduleStatus(form: FormState) {
  const now = Date.now();
  const endAtTs = new Date(form.endAt).getTime();

  if (!form.endAt) {
    return {
      tone: "error" as const,
      title: "截止时间未设置",
      description: "考试必须有明确的截止时间，否则学生端无法判断可作答区间。",
      summary: "未设置截止时间",
      meta: "先设置截止时间，再确认是否需要开始时间。",
      canSubmit: false
    };
  }

  if (!Number.isFinite(endAtTs)) {
    return {
      tone: "error" as const,
      title: "截止时间格式不正确",
      description: "请重新选择截止时间，避免学生端出现不可作答或提前结束。",
      summary: "截止时间格式异常",
      meta: "建议重新选择截止时间。",
      canSubmit: false
    };
  }

  if (endAtTs <= now) {
    return {
      tone: "error" as const,
      title: "截止时间已经过去",
      description: "当前配置会让考试一发布就立刻失效，学生无法正常进入作答。",
      summary: "截止时间已过",
      meta: "把截止时间调到未来，再继续发布。",
      canSubmit: false
    };
  }

  if (!form.startAt) {
    const hoursUntilEnd = Math.ceil((endAtTs - now) / (60 * 60 * 1000));
    const urgent = hoursUntilEnd <= 24;
    return {
      tone: urgent ? ("info" as const) : ("success" as const),
      title: urgent ? "考试将立即开放，且关闭时间较近" : "考试将立即开放给目标学生",
      description: urgent
        ? "没有设置开始时间意味着学生现在就能看到这场考试。如果这是今天课堂内测，这种方式更直接。"
        : "当前设置适合直接开考，老师发布后学生即可进入作答。",
      summary: urgent ? "立即开放，24 小时内截止" : "立即开放",
      meta: `截止 ${new Date(form.endAt).toLocaleString("zh-CN")} · 时长 ${form.durationMinutes} 分钟`,
      canSubmit: true
    };
  }

  const startAtTs = new Date(form.startAt).getTime();
  if (!Number.isFinite(startAtTs)) {
    return {
      tone: "error" as const,
      title: "开始时间格式不正确",
      description: "请重新选择开始时间，确保发布时间和作答窗口一致。",
      summary: "开始时间格式异常",
      meta: "建议重新选择开始时间。",
      canSubmit: false
    };
  }

  if (startAtTs >= endAtTs) {
    return {
      tone: "error" as const,
      title: "开始时间晚于截止时间",
      description: "这会让考试在时间上自相矛盾，学生端会直接无法作答。",
      summary: "时间窗口冲突",
      meta: "确保开始时间早于截止时间。",
      canSubmit: false
    };
  }

  const startsSoon = startAtTs - now <= 24 * 60 * 60 * 1000;
  return {
    tone: startsSoon ? ("info" as const) : ("success" as const),
    title: startsSoon ? "考试将在 24 小时内开放" : "发布时间已排好",
    description: startsSoon
      ? "这适合明确课堂开考时点的场景。发布后学生会在开始时间到达时进入可作答状态。"
      : "当前时间窗口更适合阶段测或跨天安排，学生会按计划收到并按时进入。",
    summary: startsSoon ? "即将开放" : "已排期",
    meta: `开始 ${new Date(form.startAt).toLocaleString("zh-CN")} · 截止 ${new Date(form.endAt).toLocaleString("zh-CN")}`,
    canSubmit: true
  };
}

function getPoolRisk(form: FormState, filteredPoints: KnowledgePoint[]) {
  if (filteredPoints.length === 0) {
    return {
      tone: "info" as const,
      label: "待确认",
      title: "当前班级还没有可选知识点目录",
      description: "你仍然可以按班级题库直接组卷，但知识点级精确控制暂时不可用。",
      meta: "如果后续题量不足，优先减少难度和题型限制。"
    };
  }

  let narrowness = 0;
  if (form.knowledgePointId) narrowness += 2;
  if (form.difficulty === "hard") narrowness += 1;
  if (form.questionType !== "choice") narrowness += 1;
  if (form.questionCount >= 16) narrowness += 1;
  if (!form.includeIsolated) narrowness += 1;
  if (filteredPoints.length <= 6) narrowness += 1;

  if (narrowness >= 5) {
    return {
      tone: "error" as const,
      label: "高",
      title: "当前筛选比较窄，可能触发自动放宽条件",
      description: "如果题库不够，系统会依次放宽题型、难度和知识点。现在就应该预期这件事，而不是等提交失败后再猜原因。",
      meta: "优先减少题量、清空知识点，或改用中等难度。"
    };
  }

  if (narrowness >= 3) {
    return {
      tone: "info" as const,
      label: "中",
      title: "当前题库约束适中，但仍需留意题量",
      description: "这类配置通常能组出卷，但当班级题库较薄或知识点覆盖少时，仍有可能触发部分放宽。",
      meta: "如果追求稳定发布，先从 10-12 题开始更稳。"
    };
  }

  return {
    tone: "success" as const,
    label: "低",
    title: "当前筛选更偏稳妥，发布成功率较高",
    description: "以班级全量题库为主，系统更容易在不放宽条件的前提下完成组卷。",
    meta: "如果需要更精确的教学对齐，再逐步收窄知识点或题型。"
  };
}

export default function CreateTeacherExamPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [classStudents, setClassStudents] = useState<ClassStudent[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  const [configRefreshing, setConfigRefreshing] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitSuggestions, setSubmitSuggestions] = useState<string[]>([]);
  const [stageTrail, setStageTrail] = useState<StageTrailItem[]>([]);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    classId: "",
    title: "",
    description: "",
    publishMode: "teacher_assigned",
    antiCheatLevel: "basic",
    studentIds: [],
    startAt: "",
    endAt: getDefaultEndAt(),
    durationMinutes: 60,
    questionCount: 10,
    knowledgePointId: "",
    difficulty: "medium",
    questionType: "choice",
    includeIsolated: false
  });

  const loadConfig = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") {
      setConfigRefreshing(true);
    } else {
      setConfigLoading(true);
    }
    setConfigError(null);

    try {
      const [classesRes, knowledgePointsRes] = await Promise.all([
        fetch("/api/teacher/classes"),
        fetch("/api/knowledge-points")
      ]);
      const [classesPayload, knowledgePointsPayload] = await Promise.all([classesRes.json(), knowledgePointsRes.json()]);

      if (!classesRes.ok) {
        throw new Error(classesPayload?.error ?? "班级加载失败");
      }
      if (!knowledgePointsRes.ok) {
        throw new Error(knowledgePointsPayload?.error ?? "知识点加载失败");
      }

      const nextClasses = Array.isArray(classesPayload.data) ? classesPayload.data : [];
      const nextKnowledgePoints = Array.isArray(knowledgePointsPayload.data) ? knowledgePointsPayload.data : [];

      setClasses(nextClasses);
      setKnowledgePoints(nextKnowledgePoints);
      setLastLoadedAt(new Date().toISOString());
      setForm((prev) => {
        const nextClassId =
          prev.classId && nextClasses.some((item: ClassItem) => item.id === prev.classId)
            ? prev.classId
            : nextClasses[0]?.id ?? "";
        const nextClass = nextClasses.find((item: ClassItem) => item.id === nextClassId);
        const nextKnowledgePointId =
          prev.knowledgePointId &&
          nextClass &&
          nextKnowledgePoints.some(
            (item: KnowledgePoint) =>
              item.id === prev.knowledgePointId &&
              item.subject === nextClass.subject &&
              item.grade === nextClass.grade
          )
            ? prev.knowledgePointId
            : "";
        return {
          ...prev,
          classId: nextClassId,
          knowledgePointId: nextKnowledgePointId,
          studentIds: nextClassId === prev.classId ? prev.studentIds : [],
          endAt: prev.endAt || getDefaultEndAt()
        };
      });
    } catch (nextError) {
      setConfigError(nextError instanceof Error ? nextError.message : "加载失败");
    } finally {
      setConfigLoading(false);
      setConfigRefreshing(false);
    }
  }, []);

  const loadStudents = useCallback(async (classId: string, mode: "initial" | "refresh" = "initial") => {
    if (!classId) {
      setClassStudents([]);
      setStudentsError(null);
      return;
    }

    setStudentsLoading(true);
    if (mode === "initial") {
      setStudentsError(null);
    }

    try {
      const res = await fetch(`/api/teacher/classes/${classId}/students`);
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error ?? "学生列表加载失败");
      }
      const students = Array.isArray(payload.data) ? payload.data : [];
      setClassStudents(students);
      setStudentsError(null);
      setForm((prev) => ({
        ...prev,
        studentIds: prev.studentIds.filter((studentId) => students.some((student: ClassStudent) => student.id === studentId))
      }));
    } catch (nextError) {
      setStudentsError(nextError instanceof Error ? nextError.message : "学生列表加载失败");
    } finally {
      setStudentsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    void loadStudents(form.classId);
  }, [form.classId, loadStudents]);

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === form.classId),
    [classes, form.classId]
  );

  const filteredPoints = useMemo(() => {
    if (!selectedClass) return [];
    return knowledgePoints.filter(
      (item) => item.subject === selectedClass.subject && item.grade === selectedClass.grade
    );
  }, [knowledgePoints, selectedClass]);

  const selectedPoint = useMemo(
    () => filteredPoints.find((item) => item.id === form.knowledgePointId) ?? null,
    [filteredPoints, form.knowledgePointId]
  );

  const scheduleStatus = useMemo(() => getScheduleStatus(form), [form]);
  const poolRisk = useMemo(() => getPoolRisk(form, filteredPoints), [filteredPoints, form]);
  const targetCount = form.publishMode === "targeted" ? form.studentIds.length : classStudents.length;
  const canSubmit =
    Boolean(form.classId && form.title.trim()) &&
    scheduleStatus.canSubmit &&
    !configLoading &&
    !saving &&
    !(form.publishMode === "targeted" && targetCount === 0) &&
    !(form.publishMode === "targeted" && studentsLoading);
  const classLabel = formatClassLabel(selectedClass);
  const scopeLabel = selectedPoint
    ? `${selectedPoint.chapter} · ${selectedPoint.title} · ${form.questionCount} 题`
    : `${SUBJECT_LABELS[selectedClass?.subject ?? ""] ?? "当前学科"}全范围 · ${form.questionCount} 题`;
  const targetLabel =
    form.publishMode === "targeted"
      ? `定向 ${targetCount}/${classStudents.length || 0} 人`
      : `全班 ${classStudents.length || 0} 人`;

  async function handleRefresh() {
    await loadConfig("refresh");
    if (form.classId) {
      await loadStudents(form.classId, "refresh");
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSubmitError(null);
    setSubmitMessage(null);
    setSubmitSuggestions([]);
    setStageTrail([]);

    if (!scheduleStatus.canSubmit) {
      setSubmitError(scheduleStatus.title);
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/teacher/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: form.classId,
          title: form.title.trim(),
          description: form.description.trim(),
          publishMode: form.publishMode,
          antiCheatLevel: form.antiCheatLevel,
          studentIds: form.publishMode === "targeted" ? form.studentIds : undefined,
          startAt: form.startAt || undefined,
          endAt: form.endAt || undefined,
          durationMinutes: form.durationMinutes || undefined,
          questionCount: form.questionCount,
          knowledgePointId: form.knowledgePointId || undefined,
          difficulty: form.difficulty || undefined,
          questionType: form.questionType || undefined,
          includeIsolated: form.includeIsolated
        })
      });
      const payload = await res.json();

      if (!res.ok) {
        const details = payload?.details as { suggestions?: string[]; stageTrail?: StageTrailItem[] } | undefined;
        setSubmitError(normalizeCreateErrorMessage(payload?.error ?? "发布失败"));
        setSubmitSuggestions(Array.isArray(details?.suggestions) ? details.suggestions.filter(Boolean) : []);
        setStageTrail(Array.isArray(details?.stageTrail) ? details.stageTrail : []);
        setSaving(false);
        return;
      }

      const warnings = Array.isArray(payload?.warnings) ? payload.warnings.filter(Boolean) : [];
      setSubmitMessage(
        warnings.length
          ? `${payload?.message ?? "考试发布成功"} ${warnings.join("；")}`
          : payload?.message ?? "考试发布成功"
      );
      const examId = payload?.data?.id;
      if (examId) {
        router.push(`/teacher/exams/${examId}`);
        return;
      }
      router.push("/teacher/exams");
    } catch {
      setSubmitError("发布失败，请稍后重试。");
      setSaving(false);
    }
  }

  if (configLoading && !classes.length && !knowledgePoints.length) {
    return (
      <Card title="发布在线考试">
        <StatePanel
          compact
          tone="loading"
          title="考试创建页加载中"
          description="正在同步班级、知识点和学生范围。"
        />
      </Card>
    );
  }

  if (configError && !classes.length) {
    return (
      <Card title="发布在线考试">
        <StatePanel
          compact
          tone="error"
          title="考试创建页加载失败"
          description={configError}
          action={
            <div className="cta-row cta-row-tight no-margin">
              <button className="button secondary" type="button" onClick={() => void loadConfig()}>
                重试
              </button>
              <Link className="button ghost" href="/teacher/exams">
                返回考试列表
              </Link>
            </div>
          }
        />
      </Card>
    );
  }

  if (!classes.length) {
    return (
      <Card title="发布在线考试">
        <StatePanel
          compact
          tone="empty"
          title="当前没有可发布考试的班级"
          description="先确认教师账号下已经有班级，再回来创建在线考试。"
          action={
            <Link className="button secondary" href="/teacher">
              返回教师端
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>发布在线考试</h2>
          <div className="section-sub">把班级范围、题库策略、发布时间和目标学生一次配清楚，再进入考试详情继续收口。</div>
        </div>
        <div className="workflow-toolbar">
          <span className="chip">{classLabel}</span>
          <span className="chip">{getPublishModeLabel(form.publishMode)}</span>
          <span className="chip">{getDifficultyLabel(form.difficulty)}</span>
          <span className="chip">{form.questionCount} 题</span>
          <span className="chip">对象 {targetLabel}</span>
          {lastLoadedAt ? <span className="chip">更新于 {formatLoadedTime(lastLoadedAt)}</span> : null}
          <button
            className="button secondary"
            type="button"
            onClick={() => void handleRefresh()}
            disabled={configLoading || configRefreshing || studentsLoading}
          >
            {configRefreshing ? "刷新中..." : "刷新配置"}
          </button>
        </div>
      </div>

      <ExamCreateLoopCard
        classLabel={classLabel}
        scopeLabel={scopeLabel}
        targetLabel={targetLabel}
        scheduleLabel={scheduleStatus.summary}
        scheduleMeta={scheduleStatus.meta.trim()}
        poolLabel={`风险 ${poolRisk.label}`}
        poolMeta={poolRisk.meta}
      />

      <div className="teacher-exam-create-top-grid">
        <Card title="发布概览" tag="Overview">
          <div className="grid grid-2">
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">班级范围</div>
              <div className="workflow-summary-value">{selectedClass?.name ?? "-"}</div>
              <div className="workflow-summary-helper">
                {SUBJECT_LABELS[selectedClass?.subject ?? ""] ?? "-"} · {getGradeLabel(selectedClass?.grade)}
              </div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">知识点范围</div>
              <div className="workflow-summary-value">{selectedPoint ? "单点定向" : "全范围"}</div>
              <div className="workflow-summary-helper">
                {selectedPoint ? `${selectedPoint.chapter} · ${selectedPoint.title}` : `可选知识点 ${filteredPoints.length} 个`}
              </div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">发布对象</div>
              <div className="workflow-summary-value">{targetCount}</div>
              <div className="workflow-summary-helper">
                {form.publishMode === "targeted"
                  ? `当前定向 ${form.studentIds.length} 人`
                  : `当前班级学生 ${classStudents.length} 人`}
              </div>
            </div>
            <div className="workflow-summary-card">
              <div className="workflow-summary-label">题目配置</div>
              <div className="workflow-summary-value">{form.questionCount}</div>
              <div className="workflow-summary-helper">
                {getDifficultyLabel(form.difficulty)} · {getQuestionTypeLabel(form.questionType)}
              </div>
            </div>
          </div>

          <div className="pill-list" style={{ marginTop: 12 }}>
            <span className="pill">考试时长 {form.durationMinutes} 分钟</span>
            <span className="pill">防作弊 {form.antiCheatLevel === "basic" ? "基础监测" : "关闭"}</span>
            <span className="pill">隔离题 {form.includeIsolated ? "允许" : "默认排除"}</span>
            <span className="pill">{scheduleStatus.summary}</span>
          </div>
        </Card>

        <Card title="发布提醒" tag="Guardrails">
          <StatePanel compact tone={poolRisk.tone} title={poolRisk.title} description={poolRisk.description} />
          <StatePanel compact tone={scheduleStatus.tone} title={scheduleStatus.title} description={scheduleStatus.description} />
          {configError && (classes.length || knowledgePoints.length) ? (
            <StatePanel
              compact
              tone="error"
              title="已展示最近一次成功配置"
              description={`最新刷新失败：${configError}`}
              action={
                <button className="button secondary" type="button" onClick={() => void handleRefresh()}>
                  再试一次
                </button>
              }
            />
          ) : null}
        </Card>
      </div>

      <form className="teacher-exam-create-form" onSubmit={handleSubmit}>
        <Card title="1. 发布范围" tag="Scope">
          <div className="teacher-exam-create-section-grid" id="exam-create-scope">
            <label>
              <div className="section-title">班级</div>
              <select
                value={form.classId}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    classId: event.target.value,
                    knowledgePointId: "",
                    studentIds: []
                  }))
                }
                required
              >
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {SUBJECT_LABELS[item.subject] ?? item.subject} · {getGradeLabel(item.grade)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <div className="section-title">考试标题</div>
              <input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="例如：第一单元阶段测评"
                required
              />
            </label>

            <label className="teacher-exam-create-span-full">
              <div className="section-title">考试说明（可选）</div>
              <textarea
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                rows={3}
                placeholder="说明考试范围、答题注意事项和评分方式"
              />
            </label>
          </div>

          <div className="workflow-card-meta">
            <span className="pill">当前班级：{classLabel}</span>
            <span className="pill">知识点目录 {filteredPoints.length} 个</span>
            <span className="pill">学生 {classStudents.length} 人</span>
          </div>
        </Card>

        <Card title="2. 题库策略" tag="Pool">
          <div className="teacher-exam-create-section-grid" id="exam-create-pool">
            <label>
              <div className="section-title">题目数量</div>
              <input
                type="number"
                min={1}
                max={100}
                value={form.questionCount}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, questionCount: Math.max(1, Number(event.target.value || 1)) }))
                }
                required
              />
            </label>

            <label>
              <div className="section-title">难度</div>
              <select
                value={form.difficulty}
                onChange={(event) => setForm((prev) => ({ ...prev, difficulty: event.target.value as FormState["difficulty"] }))}
              >
                {DIFFICULTY_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <div className="section-title">题型</div>
              <select
                value={form.questionType}
                onChange={(event) => setForm((prev) => ({ ...prev, questionType: event.target.value }))}
              >
                {QUESTION_TYPE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="teacher-exam-create-span-full">
              <div className="section-title">知识点（可选）</div>
              <select
                value={form.knowledgePointId}
                onChange={(event) => setForm((prev) => ({ ...prev, knowledgePointId: event.target.value }))}
              >
                <option value="">全部知识点</option>
                {filteredPoints.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.chapter} · {item.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="teacher-exam-create-span-full teacher-exam-create-checkbox">
              <input
                type="checkbox"
                checked={form.includeIsolated}
                onChange={(event) => setForm((prev) => ({ ...prev, includeIsolated: event.target.checked }))}
              />
              <span>允许使用隔离池高风险题。默认关闭，适合题库较窄但愿意人工抽检题目的场景。</span>
            </label>
          </div>

          <div className="meta-text" style={{ marginTop: 12 }}>
            如果当前配置题库不足，系统会依次放宽题型、难度和知识点。这个页面现在会提前把这种风险显式告诉你，而不是等提交失败。
          </div>
        </Card>

        <Card title="3. 时间与监测" tag="Schedule">
          <div className="teacher-exam-create-section-grid">
            <label>
              <div className="section-title">开始时间（可选）</div>
              <input
                type="datetime-local"
                value={form.startAt}
                onChange={(event) => setForm((prev) => ({ ...prev, startAt: event.target.value }))}
              />
            </label>

            <label>
              <div className="section-title">截止时间</div>
              <input
                type="datetime-local"
                value={form.endAt}
                onChange={(event) => setForm((prev) => ({ ...prev, endAt: event.target.value }))}
                required
              />
            </label>

            <label>
              <div className="section-title">考试时长（分钟）</div>
              <input
                type="number"
                min={5}
                max={300}
                value={form.durationMinutes}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, durationMinutes: Math.max(5, Number(event.target.value || 60)) }))
                }
              />
            </label>

            <label>
              <div className="section-title">防作弊等级</div>
              <select
                value={form.antiCheatLevel}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, antiCheatLevel: event.target.value as FormState["antiCheatLevel"] }))
                }
              >
                <option value="basic">基础监测（记录切屏/离屏）</option>
                <option value="off">关闭</option>
              </select>
            </label>
          </div>

          <StatePanel compact tone={scheduleStatus.tone} title={scheduleStatus.title} description={scheduleStatus.description} />
        </Card>

        <Card title="4. 发布对象" tag="Publish">
          <div className="teacher-exam-create-section-grid" id="exam-create-publish">
            <label>
              <div className="section-title">发布方式</div>
              <select
                value={form.publishMode}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, publishMode: event.target.value as FormState["publishMode"] }))
                }
              >
                {PUBLISH_MODE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="teacher-exam-create-summary-card">
              <div className="teacher-exam-create-summary-label">当前目标</div>
              <div className="teacher-exam-create-summary-value">{targetLabel}</div>
              <div className="teacher-exam-create-summary-helper">
                {form.publishMode === "teacher_assigned"
                  ? "发布后会自动覆盖当前班级全部学生。"
                  : "定向发布只会通知当前选中的学生。"}
              </div>
            </div>
          </div>

          {form.publishMode === "targeted" ? (
            <div className="teacher-exam-create-student-panel">
              <div className="teacher-exam-create-student-toolbar">
                <div>
                  <div className="section-title">定向学生</div>
                  <div className="meta-text">至少选择 1 名学生。切换班级后会自动清理不属于当前班级的学生。</div>
                </div>
                <div className="cta-row cta-row-tight no-margin">
                  <button
                    className="button ghost"
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, studentIds: classStudents.map((student) => student.id) }))}
                    disabled={!classStudents.length}
                  >
                    全选
                  </button>
                  <button
                    className="button ghost"
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, studentIds: [] }))}
                    disabled={!form.studentIds.length}
                  >
                    清空
                  </button>
                </div>
              </div>

              {studentsLoading && !classStudents.length ? (
                <StatePanel compact tone="loading" title="学生列表加载中" description="正在同步当前班级学生名单。" />
              ) : classStudents.length === 0 ? (
                <StatePanel
                  compact
                  tone="empty"
                  title="当前班级没有可选学生"
                  description="没有学生时不建议使用定向发布，可切回班级统一发布。"
                />
              ) : (
                <div className="teacher-exam-create-student-list">
                  {classStudents.map((student) => {
                    const checked = form.studentIds.includes(student.id);
                    return (
                      <label className={`teacher-exam-create-student-item${checked ? " selected" : ""}`} key={student.id}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            setForm((prev) => ({
                              ...prev,
                              studentIds: event.target.checked
                                ? [...prev.studentIds, student.id]
                                : prev.studentIds.filter((item) => item !== student.id)
                            }));
                          }}
                        />
                        <div>
                          <div className="teacher-exam-create-student-name">{student.name}</div>
                          <div className="meta-text">{student.email}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              {studentsError ? (
                <StatePanel
                  compact
                  tone="error"
                  title="学生列表刷新失败"
                  description={studentsError}
                  action={
                    <button className="button secondary" type="button" onClick={() => void loadStudents(form.classId, "refresh")}>
                      重试学生列表
                    </button>
                  }
                />
              ) : null}
            </div>
          ) : null}
        </Card>

        <Card title="5. 确认发布" tag="Commit">
          <div className="teacher-exam-create-confirm-grid">
            <div className="teacher-exam-create-confirm-summary">
              <div className="section-title">发布前确认</div>
              <div className="workflow-card-meta">
                <span className="pill">标题：{form.title.trim() || "未填写"}</span>
                <span className="pill">范围：{scopeLabel}</span>
                <span className="pill">对象：{targetLabel}</span>
                <span className="pill">时间：{scheduleStatus.summary}</span>
              </div>
              <div className="meta-text" style={{ marginTop: 12 }}>
                发布成功后会直接进入考试详情页，后续的提交收口、风险识别和复盘发布都会在详情页继续完成。
              </div>
            </div>

            <div className="cta-row">
              <button className="button primary" type="submit" disabled={!canSubmit}>
                {saving ? "发布中..." : "发布考试"}
              </button>
              <Link className="button ghost" href="/teacher/exams">
                返回考试列表
              </Link>
            </div>
          </div>

          {submitMessage ? <div className="status-note success">{submitMessage}</div> : null}
          {submitError ? (
            <StatePanel compact tone="error" title="发布失败" description={submitError}>
              {submitSuggestions.length ? (
                <div className="teacher-exam-create-hint-list">
                  {submitSuggestions.map((item) => (
                    <div className="teacher-exam-create-hint-item" key={item}>
                      {item}
                    </div>
                  ))}
                </div>
              ) : null}
              {stageTrail.length ? (
                <div className="teacher-exam-create-stage-trail">
                  {stageTrail.map((item) => (
                    <div className="teacher-exam-create-stage-item" key={item.stage}>
                      <div className="teacher-exam-create-stage-title">{item.label}</div>
                      <div className="meta-text">
                        可用 {item.activePoolCount} 题 / 总池 {item.totalPoolCount} 题
                        {item.isolatedExcludedCount ? ` · 隔离池排除 ${item.isolatedExcludedCount} 题` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </StatePanel>
          ) : null}
        </Card>
      </form>
    </div>
  );
}
