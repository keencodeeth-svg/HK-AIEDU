"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import EduIcon from "@/components/EduIcon";
import StatePanel from "@/components/StatePanel";
import {
  formatLoadedTime,
  getRequestErrorMessage,
  isAuthError,
  requestJson
} from "@/lib/client-request";
import {
  buildSeatPairs,
  getAssignedStudentIds,
  getFrontRowCount,
  getUnassignedStudentIds,
  resizeSeatGrid,
  swapSeatAssignment,
  type SeatCell
} from "@/lib/seat-plan-utils";
import {
  STUDENT_EYESIGHT_LEVEL_LABELS,
  STUDENT_FOCUS_SUPPORT_LABELS,
  STUDENT_GENDER_LABELS,
  STUDENT_PEER_SUPPORT_LABELS,
  STUDENT_PERSONALITY_LABELS,
  STUDENT_SEAT_PREFERENCE_LABELS
} from "@/lib/student-persona-options";

type TeacherClassItem = {
  id: string;
  name: string;
  subject: string;
  grade: string;
};

type TeacherSeatingStudent = {
  id: string;
  name: string;
  email: string;
  grade?: string;
  preferredName?: string;
  gender?: keyof typeof STUDENT_GENDER_LABELS;
  heightCm?: number;
  eyesightLevel?: keyof typeof STUDENT_EYESIGHT_LEVEL_LABELS;
  seatPreference?: keyof typeof STUDENT_SEAT_PREFERENCE_LABELS;
  personality?: keyof typeof STUDENT_PERSONALITY_LABELS;
  focusSupport?: keyof typeof STUDENT_FOCUS_SUPPORT_LABELS;
  peerSupport?: keyof typeof STUDENT_PEER_SUPPORT_LABELS;
  strengths?: string;
  supportNotes?: string;
  completed: number;
  pending: number;
  overdue: number;
  late: number;
  avgScore: number;
  placementScore: number;
  scoreSource: "quiz" | "completion";
  performanceBand: "high" | "medium" | "low";
  profileCompleteness: number;
  missingProfileFields: string[];
  tags: string[];
};

type SeatPlan = {
  id: string;
  classId: string;
  teacherId: string;
  rows: number;
  columns: number;
  seats: SeatCell[];
  generatedBy: "manual" | "ai";
  note?: string;
  createdAt: string;
  updatedAt: string;
};

type PlanSummary = {
  studentCount: number;
  seatCapacity: number;
  assignedCount: number;
  unassignedCount: number;
  occupancyRate: number;
  frontPriorityStudentCount: number;
  frontPrioritySatisfiedCount: number;
  focusPriorityStudentCount: number;
  focusPrioritySatisfiedCount: number;
  scoreComplementPairCount: number;
  mixedGenderPairCount: number;
  lowCompletenessCount: number;
  inferredScoreCount: number;
  lockedSeatCount: number;
};

type SeatingResponse = {
  data?: {
    classes?: TeacherClassItem[];
    class?: TeacherClassItem | null;
    students?: TeacherSeatingStudent[];
    savedPlan?: SeatPlan | null;
    plan?: SeatPlan | null;
    recommendedLayout?: { rows: number; columns: number } | null;
    summary?: PlanSummary | null;
  };
};

type AiPreviewResponse = {
  data?: {
    class?: TeacherClassItem | null;
    students?: TeacherSeatingStudent[];
    plan?: SeatPlan;
    summary?: PlanSummary;
    warnings?: string[];
    insights?: string[];
  };
};

type FollowUpActionResponse = {
  students?: number;
  parents?: number;
  recipients?: Array<{
    studentId: string;
    displayName: string;
    missingFields: string[];
  }>;
};

type AiOptions = {
  balanceGender: boolean;
  pairByScoreComplement: boolean;
  respectHeightGradient: boolean;
};

const DEFAULT_AI_OPTIONS: AiOptions = {
  balanceGender: true,
  pairByScoreComplement: true,
  respectHeightGradient: true
};

const LAYOUT_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

function getStudentDisplayName(student: TeacherSeatingStudent | null | undefined) {
  if (!student) return "未安排";
  return student.preferredName || student.name;
}

function isFrontPriorityStudent(student: TeacherSeatingStudent | null | undefined) {
  if (!student) return false;
  return student.eyesightLevel === "front_preferred" || student.seatPreference === "front";
}

function isFocusPriorityStudent(student: TeacherSeatingStudent | null | undefined) {
  if (!student) return false;
  return student.focusSupport === "needs_focus";
}

function summarizePlan(plan: SeatPlan | null, students: TeacherSeatingStudent[], lockedSeatCount = 0) {
  if (!plan) return null;
  const studentMap = new Map(students.map((student) => [student.id, student]));
  const frontRowCount = getFrontRowCount(plan.rows);
  const focusPriorityRows = Math.min(plan.rows, Math.max(frontRowCount, 2));
  const assignedIds = getAssignedStudentIds(plan.seats);
  let scoreComplementPairCount = 0;
  let mixedGenderPairCount = 0;

  buildSeatPairs(plan.seats).forEach((pair) => {
    if (pair.length < 2) return;
    const leftStudent = pair[0].studentId ? studentMap.get(pair[0].studentId) : null;
    const rightStudent = pair[1].studentId ? studentMap.get(pair[1].studentId) : null;
    if (!leftStudent || !rightStudent) return;

    if (Math.abs(leftStudent.placementScore - rightStudent.placementScore) >= 15) {
      scoreComplementPairCount += 1;
    }
    if (
      leftStudent.gender &&
      rightStudent.gender &&
      leftStudent.gender !== "undisclosed" &&
      rightStudent.gender !== "undisclosed" &&
      leftStudent.gender !== rightStudent.gender
    ) {
      mixedGenderPairCount += 1;
    }
  });

  return {
    studentCount: students.length,
    seatCapacity: plan.rows * plan.columns,
    assignedCount: assignedIds.length,
    unassignedCount: Math.max(0, students.length - assignedIds.length),
    occupancyRate: plan.rows * plan.columns ? Math.round((assignedIds.length / (plan.rows * plan.columns)) * 100) : 0,
    frontPriorityStudentCount: students.filter((student) => isFrontPriorityStudent(student)).length,
    frontPrioritySatisfiedCount: plan.seats.filter((seat) => {
      if (seat.row > frontRowCount || !seat.studentId) return false;
      return isFrontPriorityStudent(studentMap.get(seat.studentId));
    }).length,
    focusPriorityStudentCount: students.filter((student) => isFocusPriorityStudent(student)).length,
    focusPrioritySatisfiedCount: plan.seats.filter((seat) => {
      if (seat.row > focusPriorityRows || !seat.studentId) return false;
      return isFocusPriorityStudent(studentMap.get(seat.studentId));
    }).length,
    scoreComplementPairCount,
    mixedGenderPairCount,
    lowCompletenessCount: students.filter((student) => student.profileCompleteness < 70).length,
    inferredScoreCount: students.filter((student) => student.scoreSource === "completion").length,
    lockedSeatCount
  } satisfies PlanSummary;
}

function getPerformanceTone(band: TeacherSeatingStudent["performanceBand"]) {
  if (band === "high") return "#027a48";
  if (band === "medium") return "#b54708";
  return "#b42318";
}

function buildStudentOptionLabel(student: TeacherSeatingStudent) {
  const genderLabel = student.gender ? STUDENT_GENDER_LABELS[student.gender] : "未填性别";
  const heightLabel = student.heightCm ? `${student.heightCm}cm` : "未填身高";
  return `${getStudentDisplayName(student)} · ${student.placementScore}分 · ${genderLabel} · ${heightLabel}`;
}

function buildFollowUpChecklist(params: {
  classLabel: string;
  studentsNeedingProfileReminder: TeacherSeatingStudent[];
  watchStudents: TeacherSeatingStudent[];
  summary: PlanSummary | null;
  lockedSeatCount: number;
}) {
  const lines = [
    `班级：${params.classLabel}`,
    `资料待补：${params.studentsNeedingProfileReminder.length} 人`,
    `前排仍需关注：${Math.max(0, (params.summary?.frontPriorityStudentCount ?? 0) - (params.summary?.frontPrioritySatisfiedCount ?? 0))} 人`,
    `低干扰仍需关注：${Math.max(0, (params.summary?.focusPriorityStudentCount ?? 0) - (params.summary?.focusPrioritySatisfiedCount ?? 0))} 人`,
    `锁定座位：${params.lockedSeatCount} 个`
  ];

  if (params.studentsNeedingProfileReminder.length) {
    lines.push(
      `待补资料学生：${params.studentsNeedingProfileReminder
        .slice(0, 8)
        .map((student) => `${getStudentDisplayName(student)}（${student.missingProfileFields.join("/ ")}）`)
        .join("；")}`
    );
  }

  if (params.watchStudents.length) {
    lines.push(
      `重点观察：${params.watchStudents
        .slice(0, 6)
        .map((student) => {
          const reasons = [] as string[];
          if (isFrontPriorityStudent(student)) reasons.push("前排关注");
          if (isFocusPriorityStudent(student)) reasons.push("低干扰优先");
          if (student.missingProfileFields.length) reasons.push("资料待补");
          return `${getStudentDisplayName(student)}（${reasons.join("/")}）`;
        })
        .join("；")}`
    );
  }

  return lines.join("\n");
}

export default function TeacherSeatingPage() {
  const [classes, setClasses] = useState<TeacherClassItem[]>([]);
  const [classId, setClassId] = useState("");
  const [students, setStudents] = useState<TeacherSeatingStudent[]>([]);
  const [draftPlan, setDraftPlan] = useState<SeatPlan | null>(null);
  const [savedPlan, setSavedPlan] = useState<SeatPlan | null>(null);
  const [preview, setPreview] = useState<AiPreviewResponse["data"] | null>(null);
  const [aiOptions, setAiOptions] = useState<AiOptions>(DEFAULT_AI_OPTIONS);
  const [keepLockedSeats, setKeepLockedSeats] = useState(true);
  const [lockedSeatIds, setLockedSeatIds] = useState<string[]>([]);
  const [layoutRows, setLayoutRows] = useState(4);
  const [layoutColumns, setLayoutColumns] = useState(6);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [followUpMessage, setFollowUpMessage] = useState<string | null>(null);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [includeParentsInReminder, setIncludeParentsInReminder] = useState(false);
  const [followUpActing, setFollowUpActing] = useState<null | "remind" | "copy">(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const loadData = useCallback(async (mode: "initial" | "refresh" = "initial", targetClassId?: string) => {
    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setPageError(null);
    setSaveError(null);

    try {
      const query = targetClassId ? `?classId=${encodeURIComponent(targetClassId)}` : classId ? `?classId=${encodeURIComponent(classId)}` : "";
      const payload = await requestJson<SeatingResponse>(`/api/teacher/seating${query}`);
      const data = payload.data;
      const nextClasses = data?.classes ?? [];
      const nextClassId = data?.class?.id ?? nextClasses[0]?.id ?? "";
      const nextPlan = data?.plan ?? null;

      setClasses(nextClasses);
      setClassId(nextClassId);
      setStudents(data?.students ?? []);
      setSavedPlan(data?.savedPlan ?? null);
      setDraftPlan(nextPlan);
      setLayoutRows(nextPlan?.rows ?? data?.recommendedLayout?.rows ?? 4);
      setLayoutColumns(nextPlan?.columns ?? data?.recommendedLayout?.columns ?? 6);
      setPreview(null);
      setAuthRequired(false);
      setLastLoadedAt(new Date().toISOString());
    } catch (nextError) {
      if (isAuthError(nextError)) {
        setAuthRequired(true);
        setClasses([]);
        setClassId("");
        setStudents([]);
        setDraftPlan(null);
        setSavedPlan(null);
        setPreview(null);
      } else {
        setPageError(getRequestErrorMessage(nextError, "加载学期排座配置失败"));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [classId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!draftPlan) {
      setLockedSeatIds([]);
      return;
    }

    const validSeatIds = new Set(draftPlan.seats.filter((seat) => Boolean(seat.studentId)).map((seat) => seat.seatId));
    setLockedSeatIds((prev) => prev.filter((seatId) => validSeatIds.has(seatId)));
  }, [draftPlan]);

  const lockedSeats = useMemo(() => {
    if (!draftPlan) return [] as Array<SeatCell & { studentId: string }>;
    return draftPlan.seats.filter(
      (seat): seat is SeatCell & { studentId: string } => Boolean(seat.studentId) && lockedSeatIds.includes(seat.seatId)
    );
  }, [draftPlan, lockedSeatIds]);
  const draftSummary = useMemo(() => summarizePlan(draftPlan, students, lockedSeats.length), [draftPlan, lockedSeats.length, students]);
  const previewPlan = preview?.plan ?? null;
  const previewSummary = preview?.summary ?? null;
  const previewWarnings = preview?.warnings ?? [];
  const previewInsights = preview?.insights ?? [];
  const studentMap = useMemo(() => new Map(students.map((student) => [student.id, student])), [students]);
  const unassignedStudents = useMemo(() => {
    if (!draftPlan) return students;
    const unassignedIds = getUnassignedStudentIds(draftPlan.seats, students.map((student) => student.id));
    return unassignedIds.map((studentId) => studentMap.get(studentId)).filter(Boolean) as TeacherSeatingStudent[];
  }, [draftPlan, studentMap, students]);
  const roster = useMemo(
    () =>
      [...students].sort(
        (left, right) =>
          left.profileCompleteness - right.profileCompleteness ||
          Number(isFrontPriorityStudent(right) || isFocusPriorityStudent(right)) -
            Number(isFrontPriorityStudent(left) || isFocusPriorityStudent(left)) ||
          right.placementScore - left.placementScore
      ),
    [students]
  );
  const studentsNeedingProfileReminder = useMemo(
    () => roster.filter((student) => student.missingProfileFields.length > 0),
    [roster]
  );
  const watchStudents = useMemo(
    () =>
      roster.filter(
        (student) => isFrontPriorityStudent(student) || isFocusPriorityStudent(student) || student.missingProfileFields.length > 0
      ),
    [roster]
  );
  const classLabel = useMemo(() => classes.find((item) => item.id === classId)?.name ?? "当前班级", [classId, classes]);
  const followUpChecklist = useMemo(
    () =>
      buildFollowUpChecklist({
        classLabel,
        studentsNeedingProfileReminder,
        watchStudents,
        summary: draftSummary,
        lockedSeatCount: lockedSeats.length
      }),
    [classLabel, draftSummary, lockedSeats.length, studentsNeedingProfileReminder, watchStudents]
  );
  const frontPriorityGap = Math.max(
    0,
    (draftSummary?.frontPriorityStudentCount ?? 0) - (draftSummary?.frontPrioritySatisfiedCount ?? 0)
  );
  const focusPriorityGap = Math.max(
    0,
    (draftSummary?.focusPriorityStudentCount ?? 0) - (draftSummary?.focusPrioritySatisfiedCount ?? 0)
  );
  const semesterReplanReasons = useMemo(() => {
    const reasons: string[] = [];

    if (!savedPlan) {
      reasons.push("本学期还没有保存正式座位方案");
    }
    if ((draftSummary?.unassignedCount ?? 0) > 0) {
      reasons.push(`仍有 ${draftSummary?.unassignedCount ?? 0} 名学生未分配座位`);
    }
    if (frontPriorityGap > 0) {
      reasons.push(`${frontPriorityGap} 名前排需求学生仍需优先照顾`);
    }
    if (focusPriorityGap > 0) {
      reasons.push(`${focusPriorityGap} 名低干扰需求学生仍需优化`);
    }
    if (studentsNeedingProfileReminder.length > 0) {
      reasons.push(`${studentsNeedingProfileReminder.length} 名学生关键画像待补`);
    }
    if (previewPlan) {
      reasons.push("当前有一份未应用的学期预览");
    }

    return reasons;
  }, [draftSummary, focusPriorityGap, frontPriorityGap, previewPlan, savedPlan, studentsNeedingProfileReminder]);
  const semesterStatus = !savedPlan ? "待初始化" : semesterReplanReasons.length ? "建议重排" : "本学期稳定";
  const semesterStatusTone =
    semesterStatus === "本学期稳定" ? "#027a48" : semesterStatus === "建议重排" ? "#b54708" : "#4f46e5";
  const frontRowCount = draftPlan ? getFrontRowCount(draftPlan.rows) : 1;

  function toggleLockedSeat(seatId: string) {
    setLockedSeatIds((prev) => (prev.includes(seatId) ? prev.filter((item) => item !== seatId) : [...prev, seatId]));
    setSaveMessage(null);
  }

  function handleLayoutChange(type: "rows" | "columns", value: number) {
    if (!draftPlan) return;
    const nextRows = type === "rows" ? value : layoutRows;
    const nextColumns = type === "columns" ? value : layoutColumns;
    setLayoutRows(nextRows);
    setLayoutColumns(nextColumns);
    setDraftPlan((prev) =>
      prev
        ? {
            ...prev,
            rows: nextRows,
            columns: nextColumns,
            seats: resizeSeatGrid(prev.seats, nextRows, nextColumns),
            updatedAt: new Date().toISOString()
          }
        : prev
    );
    setPreview(null);
    setSaveMessage(null);
  }

  async function handleGeneratePreview() {
    if (!classId) return;
    setPreviewing(true);
    setPageError(null);

    try {
      const payload = await requestJson<AiPreviewResponse>("/api/teacher/seating/ai-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          rows: layoutRows,
          columns: layoutColumns,
          lockedSeats: keepLockedSeats ? lockedSeats.map((seat) => ({ seatId: seat.seatId, row: seat.row, column: seat.column, studentId: seat.studentId })) : undefined,
          ...aiOptions
        })
      });
      setPreview(payload.data ?? null);
      setSaveMessage(
        keepLockedSeats && lockedSeats.length
          ? `学期预览已生成，已保留 ${lockedSeats.length} 个锁定座位。`
          : "学期预览已生成，可先应用再做少量调整。"
      );
    } catch (nextError) {
      setPageError(getRequestErrorMessage(nextError, "生成学期预览失败"));
    } finally {
      setPreviewing(false);
    }
  }

  function handleApplyPreview() {
    if (!previewPlan) return;
    setDraftPlan({ ...previewPlan, updatedAt: new Date().toISOString() });
    setLayoutRows(previewPlan.rows);
    setLayoutColumns(previewPlan.columns);
    setSaveMessage("已应用学期预览，请确认关键座位后保存本学期方案。");
    setSaveError(null);
  }

  function handleRestoreSaved() {
    if (!savedPlan) return;
    setDraftPlan(savedPlan);
    setLayoutRows(savedPlan.rows);
    setLayoutColumns(savedPlan.columns);
    setPreview(null);
    setSaveMessage("已恢复到本学期最近保存版本。");
    setSaveError(null);
  }

  async function handleSavePlan() {
    if (!draftPlan || !classId) return;
    setSaving(true);
    setSaveMessage(null);
    setSaveError(null);

    try {
      const payload = await requestJson<AiPreviewResponse>("/api/teacher/seating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          rows: draftPlan.rows,
          columns: draftPlan.columns,
          generatedBy: draftPlan.generatedBy,
          seats: draftPlan.seats.map((seat) => ({
            seatId: seat.seatId,
            row: seat.row,
            column: seat.column,
            studentId: seat.studentId ?? null
          }))
        })
      });
      if (payload.data?.plan) {
        setDraftPlan(payload.data.plan);
        setSavedPlan(payload.data.plan);
      }
      if (payload.data?.students) {
        setStudents(payload.data.students);
      }
      setSaveMessage("本学期座位方案已保存，后续可按需做少量微调。");
    } catch (nextError) {
      setSaveError(getRequestErrorMessage(nextError, "保存学期排座失败"));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemindIncompleteProfiles() {
    if (!classId || !studentsNeedingProfileReminder.length) return;
    setFollowUpActing("remind");
    setFollowUpMessage(null);
    setFollowUpError(null);

    try {
      const payload = await requestJson<{ data?: FollowUpActionResponse }>("/api/teacher/seating/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          action: "remind_incomplete_profiles",
          includeParents: includeParentsInReminder,
          limit: Math.min(studentsNeedingProfileReminder.length, 30)
        })
      });
      const result = payload.data;
      setFollowUpMessage(
        `已发送资料补充提醒：学生 ${result?.students ?? 0} 人${includeParentsInReminder ? `，家长 ${result?.parents ?? 0} 人` : ""}。`
      );
    } catch (nextError) {
      setFollowUpError(getRequestErrorMessage(nextError, "发送资料补充提醒失败"));
    } finally {
      setFollowUpActing(null);
    }
  }

  async function handleCopyFollowUpChecklist() {
    setFollowUpActing("copy");
    setFollowUpMessage(null);
    setFollowUpError(null);

    try {
      await navigator.clipboard.writeText(followUpChecklist);
      setFollowUpMessage("已复制本学期排座观察清单。");
    } catch {
      setFollowUpError("复制失败，请稍后重试。");
    } finally {
      setFollowUpActing(null);
    }
  }

  if (loading) {
    return (
      <StatePanel
        title="学期排座配置加载中"
        description="正在同步班级名单、学生画像与当前座位草稿。"
        tone="loading"
      />
    );
  }

  if (authRequired) {
    return (
      <StatePanel
        title="需要教师账号登录"
        description="请先用教师账号登录后，再进入学期排座配置页面。"
        tone="info"
        action={
          <Link className="button primary" href="/login">
            去登录
          </Link>
        }
      />
    );
  }

  if (!classes.length || !draftPlan) {
    return (
      <StatePanel
        title="暂时还没有可排座的班级"
        description="先去教师工作台创建班级并加入学生，再回来完成本学期的座位初始化。"
        tone="empty"
        action={
          <Link className="button primary" href="/teacher">
            去教师工作台
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>学期排座配置</h2>
          <div className="section-sub">学期初先生成一版预览，再由老师确认与微调，兼顾成绩互补、性别、身高和课堂偏好。</div>
        </div>
        <span className="chip">学期初始化</span>
      </div>

      <Card title="学期状态" tag={semesterStatus}>
        <div className="feature-card">
          <EduIcon name="chart" />
          <p>排座默认按学期初始化处理：学期初完成正式方案，只有在插班、关键画像明显变化或老师主动复盘时再重排。</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 12 }}>
          <div className="card">
            <div className="section-title">当前状态</div>
            <p style={{ color: semesterStatusTone }}>{semesterStatus}</p>
          </div>
          <div className="card">
            <div className="section-title">正式方案</div>
            <p>{savedPlan ? formatLoadedTime(savedPlan.updatedAt) : "尚未保存"}</p>
          </div>
          <div className="card">
            <div className="section-title">建议触发时机</div>
            <p>插班 / 关键画像变化 / 老师主动复盘</p>
          </div>
          <div className="card">
            <div className="section-title">当前班级</div>
            <p>{classLabel}</p>
          </div>
        </div>
        {semesterReplanReasons.length ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {semesterReplanReasons.map((reason) => (
              <span key={reason} className="badge">
                {reason}
              </span>
            ))}
          </div>
        ) : (
          <div className="card" style={{ marginTop: 12 }}>
            本学期方案已相对稳定，建议只做个别座位微调，不必频繁整体重排。
          </div>
        )}
      </Card>

      <Card title="班级与学期排座策略" tag="学期">
        <div className="feature-card">
          <EduIcon name="brain" />
          <p>选择班级、调整座位布局后即可生成学期预览；建议先定一版正式方案，后续只在必要时做局部调整。</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 12 }}>
          <label>
            <div className="section-title">班级</div>
            <select
              value={classId}
              onChange={(event) => {
                const nextClassId = event.target.value;
                setClassId(nextClassId);
                void loadData("refresh", nextClassId);
              }}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.grade}年级 · {item.subject}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="section-title">排数</div>
            <select
              value={layoutRows}
              onChange={(event) => handleLayoutChange("rows", Number(event.target.value))}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              {LAYOUT_OPTIONS.map((value) => (
                <option key={`rows-${value}`} value={value}>
                  {value} 排
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="section-title">列数</div>
            <select
              value={layoutColumns}
              onChange={(event) => handleLayoutChange("columns", Number(event.target.value))}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)" }}
            >
              {LAYOUT_OPTIONS.map((value) => (
                <option key={`columns-${value}`} value={value}>
                  {value} 列
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
          <label className="card" style={{ cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={aiOptions.pairByScoreComplement}
              onChange={(event) => setAiOptions((prev) => ({ ...prev, pairByScoreComplement: event.target.checked }))}
              style={{ marginRight: 8 }}
            />
            成绩互补优先
          </label>
          <label className="card" style={{ cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={aiOptions.balanceGender}
              onChange={(event) => setAiOptions((prev) => ({ ...prev, balanceGender: event.target.checked }))}
              style={{ marginRight: 8 }}
            />
            性别平衡优先
          </label>
          <label className="card" style={{ cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={aiOptions.respectHeightGradient}
              onChange={(event) => setAiOptions((prev) => ({ ...prev, respectHeightGradient: event.target.checked }))}
              style={{ marginRight: 8 }}
            />
            身高梯度优先
          </label>
          <label className="card" style={{ cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={keepLockedSeats}
              onChange={(event) => setKeepLockedSeats(event.target.checked)}
              style={{ marginRight: 8 }}
            />
            保留锁定座位
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 12 }}>
          <div className="card">
            <div className="section-title">班级学生</div>
            <p>{students.length} 人</p>
          </div>
          <div className="card">
            <div className="section-title">当前容量</div>
            <p>{draftSummary?.seatCapacity ?? layoutRows * layoutColumns} 个座位</p>
          </div>
          <div className="card">
            <div className="section-title">资料待补</div>
            <p>{draftSummary?.lowCompletenessCount ?? 0} 人</p>
          </div>
          <div className="card">
            <div className="section-title">最近同步</div>
            <p>{formatLoadedTime(lastLoadedAt) || "刚刚"}</p>
          </div>
          <div className="card">
            <div className="section-title">已锁定位</div>
            <p>{lockedSeats.length} 个</p>
          </div>
        </div>

        {lockedSeats.length ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {lockedSeats.map((seat) => {
              const student = studentMap.get(seat.studentId);
              return (
                <span key={`locked-${seat.seatId}`} className="badge">
                  锁定：第 {seat.row} 排第 {seat.column} 列 · {getStudentDisplayName(student)}
                </span>
              );
            })}
          </div>
        ) : (
          <div className="card" style={{ marginTop: 12 }}>
            先在下方草稿里锁定本学期必须保留的关键座位，再生成学期预览，系统会只重排其余位置。
          </div>
        )}

        {pageError ? <div style={{ color: "#b42318", fontSize: 13, marginTop: 12 }}>{pageError}</div> : null}
        {saveError ? <div style={{ color: "#b42318", fontSize: 13, marginTop: 12 }}>{saveError}</div> : null}
        {saveMessage ? <div style={{ color: "#027a48", fontSize: 13, marginTop: 12 }}>{saveMessage}</div> : null}

        <div className="cta-row" style={{ marginTop: 12 }}>
          <button className="button ghost" type="button" onClick={() => void loadData("refresh", classId)} disabled={refreshing}>
            {refreshing ? "刷新中..." : "刷新数据"}
          </button>
          <button className="button secondary" type="button" onClick={() => void handleGeneratePreview()} disabled={previewing}>
            {previewing ? "生成中..." : "生成学期预览"}
          </button>
          <button className="button ghost" type="button" onClick={handleApplyPreview} disabled={!previewPlan}>
            应用学期预览
          </button>
          <button className="button ghost" type="button" onClick={handleRestoreSaved} disabled={!savedPlan}>
            恢复已保存版本
          </button>
          <button className="button primary" type="button" onClick={() => void handleSavePlan()} disabled={saving}>
            {saving ? "保存中..." : "保存本学期方案"}
          </button>
        </div>
      </Card>

      <Card title="学期方案预览" tag="预览">
        {!previewPlan ? (
          <StatePanel
            title="还没有生成学期预览"
            description="点击上方“生成学期预览”，系统会先安排前排需求，再尝试做成绩互补和性别、身高平衡。"
            tone="info"
            compact
          />
        ) : (
          <div className="grid" style={{ gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <div className="card">
                <div className="section-title">已分配</div>
                <p>{previewSummary?.assignedCount ?? 0} 人</p>
              </div>
              <div className="card">
                <div className="section-title">未分配</div>
                <p>{previewSummary?.unassignedCount ?? 0} 人</p>
              </div>
              <div className="card">
                <div className="section-title">前排满足</div>
                <p>
                  {previewSummary?.frontPrioritySatisfiedCount ?? 0} / {previewSummary?.frontPriorityStudentCount ?? 0}
                </p>
              </div>
              <div className="card">
                <div className="section-title">互补同桌</div>
                <p>{previewSummary?.scoreComplementPairCount ?? 0} 组</p>
              </div>
            </div>

            {previewSummary?.focusPriorityStudentCount ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className="badge">
                  低干扰优先区 {previewSummary.focusPrioritySatisfiedCount} / {previewSummary.focusPriorityStudentCount}
                </span>
                {previewSummary.lockedSeatCount ? <span className="badge">保留锁定位 {previewSummary.lockedSeatCount} 个</span> : null}
              </div>
            ) : previewSummary?.lockedSeatCount ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className="badge">保留锁定位 {previewSummary.lockedSeatCount} 个</span>
              </div>
            ) : null}

            {previewWarnings.length ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {previewWarnings.map((warning) => (
                  <span key={warning} className="badge" style={{ borderColor: "#f04438", color: "#b42318" }}>
                    {warning}
                  </span>
                ))}
              </div>
            ) : null}

            {previewInsights.length ? (
              <div className="grid" style={{ gap: 8 }}>
                {previewInsights.map((insight) => (
                  <div key={insight} className="card">
                    {insight}
                  </div>
                ))}
              </div>
            ) : null}

            <div style={{ overflowX: "auto" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${previewPlan.columns}, 170px)`,
                  gap: 12,
                  minWidth: `${previewPlan.columns * 170}px`
                }}
              >
                {previewPlan.seats.map((seat) => {
                  const student = seat.studentId ? studentMap.get(seat.studentId) : null;
                  const locked = lockedSeatIds.includes(seat.seatId);
                  return (
                    <div
                      key={`preview-${seat.seatId}`}
                      className="card"
                      style={{
                        background: seat.row <= getFrontRowCount(previewPlan.rows) ? "rgba(79, 70, 229, 0.06)" : undefined,
                        boxShadow: locked ? "0 0 0 1px rgba(79, 70, 229, 0.45) inset" : undefined
                      }}
                    >
                      <div className="section-title">第 {seat.row} 排 · 第 {seat.column} 列</div>
                      <p>{getStudentDisplayName(student)}</p>
                      <p style={{ fontSize: 12, color: "var(--ink-1)" }}>
                        {student ? `${student.placementScore} 分 · ${student.tags.join(" · ") || "资料待补"}` : "空位"}
                      </p>
                      {locked ? <span className="badge">锁定保留</span> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card title="学期收口动作" tag="跟进">
        <div className="feature-card">
          <EduIcon name="rocket" />
          <p>学期方案确定后，建议一次性处理资料待补学生，并保留一份观察清单，后续只在必要时复盘和微调。</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 12 }}>
          <div className="card">
            <div className="section-title">资料待补</div>
            <p>{studentsNeedingProfileReminder.length} 人</p>
          </div>
          <div className="card">
            <div className="section-title">前排仍需关注</div>
            <p>{Math.max(0, (draftSummary?.frontPriorityStudentCount ?? 0) - (draftSummary?.frontPrioritySatisfiedCount ?? 0))} 人</p>
          </div>
          <div className="card">
            <div className="section-title">低干扰仍需关注</div>
            <p>{Math.max(0, (draftSummary?.focusPriorityStudentCount ?? 0) - (draftSummary?.focusPrioritySatisfiedCount ?? 0))} 人</p>
          </div>
          <div className="card">
            <div className="section-title">重点观察</div>
            <p>{watchStudents.length} 人</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
          <label className="card" style={{ cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={includeParentsInReminder}
              onChange={(event) => setIncludeParentsInReminder(event.target.checked)}
              style={{ marginRight: 8 }}
            />
            同步提醒家长
          </label>
          <button
            className="button secondary"
            type="button"
            onClick={() => void handleRemindIncompleteProfiles()}
            disabled={followUpActing !== null || !studentsNeedingProfileReminder.length}
          >
            {followUpActing === "remind" ? "发送中..." : "发送补齐提醒"}
          </button>
          <button
            className="button ghost"
            type="button"
            onClick={() => void handleCopyFollowUpChecklist()}
            disabled={followUpActing !== null}
          >
            {followUpActing === "copy" ? "复制中..." : "复制学期观察清单"}
          </button>
        </div>

        {followUpError ? <div style={{ color: "#b42318", fontSize: 13, marginTop: 12 }}>{followUpError}</div> : null}
        {followUpMessage ? <div style={{ color: "#027a48", fontSize: 13, marginTop: 12 }}>{followUpMessage}</div> : null}

        <div className="grid" style={{ gap: 12, marginTop: 12 }}>
          <div className="card">
            <div className="section-title">待补资料学生</div>
            {studentsNeedingProfileReminder.length ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {studentsNeedingProfileReminder.slice(0, 10).map((student) => (
                  <span key={`remind-${student.id}`} className="badge">
                    {getStudentDisplayName(student)} · 缺 {student.missingProfileFields.length} 项
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--ink-1)", marginTop: 8 }}>本班用于学期排座的关键画像已补齐。</p>
            )}
          </div>
          <div className="card">
            <div className="section-title">重点观察名单</div>
            {watchStudents.length ? (
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                {watchStudents.slice(0, 6).map((student) => {
                  const reasons = [] as string[];
                  if (isFrontPriorityStudent(student)) reasons.push("前排关注");
                  if (isFocusPriorityStudent(student)) reasons.push("低干扰优先");
                  if (student.missingProfileFields.length) reasons.push("资料待补");
                  return (
                    <div key={`watch-${student.id}`} style={{ fontSize: 13 }}>
                      {getStudentDisplayName(student)} · {reasons.join(" / ")}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: "var(--ink-1)", marginTop: 8 }}>当前没有需要重点跟进的学生。</p>
            )}
          </div>
        </div>
      </Card>

      <Card title="当前座位草稿" tag={draftPlan.generatedBy === "ai" ? "AI 草稿" : "手动草稿"}>
        <div className="feature-card">
          <EduIcon name="board" />
          <p>选学生时如果该学生已在别的位置，系统会自动交换，方便老师快速微调。</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 12 }}>
          <div className="card">
            <div className="section-title">已分配</div>
            <p>{draftSummary?.assignedCount ?? 0} 人</p>
          </div>
          <div className="card">
            <div className="section-title">未分配</div>
            <p>{draftSummary?.unassignedCount ?? 0} 人</p>
          </div>
          <div className="card">
            <div className="section-title">前排需求满足</div>
            <p>
              {draftSummary?.frontPrioritySatisfiedCount ?? 0} / {draftSummary?.frontPriorityStudentCount ?? 0}
            </p>
          </div>
          <div className="card">
            <div className="section-title">已保存版本</div>
            <p>{savedPlan ? formatLoadedTime(savedPlan.updatedAt) : "尚未保存"}</p>
          </div>
        </div>

        {draftSummary?.focusPriorityStudentCount || lockedSeats.length ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {draftSummary?.focusPriorityStudentCount ? (
              <span className="badge">
                低干扰优先区 {draftSummary.focusPrioritySatisfiedCount} / {draftSummary.focusPriorityStudentCount}
              </span>
            ) : null}
            {lockedSeats.length ? <span className="badge">已锁定 {lockedSeats.length} 个座位</span> : null}
          </div>
        ) : null}

        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${draftPlan.columns}, 210px)`,
              gap: 12,
              minWidth: `${draftPlan.columns * 210}px`
            }}
          >
            {draftPlan.seats.map((seat) => {
              const student = seat.studentId ? studentMap.get(seat.studentId) : null;
              const locked = lockedSeatIds.includes(seat.seatId);
              return (
                <div
                  key={seat.seatId}
                  className="card"
                  style={{
                    background: seat.row <= frontRowCount ? "rgba(79, 70, 229, 0.06)" : undefined,
                    boxShadow: locked ? "0 0 0 1px rgba(79, 70, 229, 0.45) inset" : undefined
                  }}
                >
                  <div className="section-title">第 {seat.row} 排 · 第 {seat.column} 列</div>
                  <p style={{ marginTop: 6 }}>{getStudentDisplayName(student)}</p>
                  <p style={{ fontSize: 12, color: "var(--ink-1)" }}>
                    {student ? `${student.placementScore} 分 · ${student.tags.join(" · ") || "资料待补"}` : "当前为空位"}
                  </p>
                  {student ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                      <button
                        className="button ghost"
                        type="button"
                        aria-pressed={locked}
                        onClick={() => toggleLockedSeat(seat.seatId)}
                        style={{ minHeight: 44, padding: "0 12px" }}
                      >
                        {locked ? "取消锁定" : "锁定此座位"}
                      </button>
                      {locked ? <span className="badge">重排保留</span> : null}
                    </div>
                  ) : null}
                  <select
                    value={seat.studentId ?? ""}
                    onChange={(event) => {
                      const nextStudentId = event.target.value || undefined;
                      setDraftPlan((prev) =>
                        prev
                          ? {
                              ...prev,
                              seats: swapSeatAssignment(prev.seats, seat.seatId, nextStudentId),
                              generatedBy: "manual",
                              updatedAt: new Date().toISOString()
                            }
                          : prev
                      );
                      if (!nextStudentId) {
                        setLockedSeatIds((prev) => prev.filter((item) => item !== seat.seatId));
                      }
                      setSaveMessage(null);
                    }}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--stroke)", marginTop: 8 }}
                  >
                    <option value="">设为空位</option>
                    {students.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {buildStudentOptionLabel(candidate)}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="section-title">未分配学生</div>
          {unassignedStudents.length ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {unassignedStudents.map((student) => (
                <span key={student.id} className="badge">
                  {getStudentDisplayName(student)} · {student.placementScore}分
                </span>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--ink-1)", marginTop: 8 }}>当前草稿已覆盖全部学生。</p>
          )}
        </div>
      </Card>

      <Card title="学生画像与排座因子" tag="画像">
        <div className="feature-card">
          <EduIcon name="chart" />
          <p>这里能看到学期排座配置用到的关键信息；资料缺口越少，预览结果通常越稳定。</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 12 }}>
          {roster.map((student) => (
            <div key={student.id} className="card">
              <div className="section-title" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span>{getStudentDisplayName(student)}</span>
                <span style={{ color: getPerformanceTone(student.performanceBand) }}>{student.placementScore} 分</span>
              </div>
              <p style={{ fontSize: 12, color: "var(--ink-1)" }}>{student.email}</p>
              <p style={{ fontSize: 12, color: "var(--ink-1)" }}>
                完整度 {student.profileCompleteness}% · {student.scoreSource === "quiz" ? "测验成绩" : "完成度推断"}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {student.tags.map((tag) => (
                  <span key={`${student.id}-${tag}`} className="badge">
                    {tag}
                  </span>
                ))}
                {isFrontPriorityStudent(student) ? <span className="badge">前排关注</span> : null}
                {isFocusPriorityStudent(student) ? <span className="badge">低干扰优先</span> : null}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-1)", marginTop: 8 }}>
                完成 {student.completed} · 待完成 {student.pending} · 逾期 {student.overdue} · 迟交 {student.late}
              </div>
              {student.strengths ? <div style={{ marginTop: 8, fontSize: 12 }}>优势：{student.strengths}</div> : null}
              {student.supportNotes ? <div style={{ marginTop: 6, fontSize: 12 }}>关注：{student.supportNotes}</div> : null}
              {student.missingProfileFields.length ? (
                <div style={{ marginTop: 8, fontSize: 12, color: "#b54708" }}>
                  待补字段：{student.missingProfileFields.join("、")}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
