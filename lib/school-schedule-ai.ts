import { SUBJECT_LABELS } from "./constants";
import {
  applyClassSchedulePlan,
  listClassScheduleSessions,
  type ClassScheduleSession,
  type ClassScheduleSessionInput,
  type Weekday
} from "./class-schedules";
import { listSchoolClasses } from "./school-admin";
import { getScheduleTemplateByGradeSubject, listSchoolScheduleTemplates } from "./school-schedule-templates";
import { listTeacherUnavailableSlots } from "./teacher-unavailability";

const SUBJECT_FOCUS_LIBRARY: Record<string, string[]> = {
  math: ["概念梳理", "例题拆解", "计算巩固", "综合应用"],
  chinese: ["字词积累", "阅读理解", "表达训练", "写作迁移"],
  english: ["词汇语法", "口语表达", "阅读训练", "写作输出"],
  science: ["现象观察", "实验探究", "知识建模", "综合应用"],
  physics: ["概念推导", "模型训练", "实验分析", "综合应用"],
  chemistry: ["概念辨析", "实验现象", "方程式训练", "综合应用"],
  biology: ["结构功能", "图像识别", "实验观察", "综合应用"],
  history: ["时序梳理", "史料理解", "因果分析", "综合比较"],
  geography: ["地图判读", "区域理解", "成因分析", "综合应用"],
  politics: ["概念理解", "案例讨论", "观点表达", "综合应用"]
};

export type SchoolAiScheduleMode = "fill_missing" | "replace_all";

export type SchoolAiScheduleInput = {
  schoolId: string;
  classIds?: string[];
  weeklyLessonsPerClass: number;
  lessonDurationMinutes: number;
  periodsPerDay: number;
  weekdays: Weekday[];
  dayStartTime: string;
  shortBreakMinutes: number;
  lunchBreakAfterPeriod?: number;
  lunchBreakMinutes: number;
  mode: SchoolAiScheduleMode;
  campus?: string;
};

export type SchoolAiScheduleResult = {
  summary: {
    targetClassCount: number;
    teacherBoundClassCount: number;
    replacedClassCount: number;
    createdSessions: number;
    requestedLessons: number;
    unresolvedLessons: number;
    skippedClassCount: number;
    untouchedClassCount: number;
    templateAppliedClassCount: number;
  };
  warnings: string[];
  createdSessions: Array<
    ClassScheduleSession & {
      className: string;
      subject: string;
      grade: string;
      teacherName?: string;
      teacherId: string | null;
    }
  >;
  impactedClasses: Array<{
    id: string;
    name: string;
    subject: string;
    grade: string;
    teacherName?: string;
    teacherId: string | null;
    requestedLessons: number;
    createdLessons: number;
    totalLessonsAfter: number;
    status: "generated" | "skipped" | "unchanged";
    reason?: string;
  }>;
  config: {
    weeklyLessonsPerClass: number;
    lessonDurationMinutes: number;
    periodsPerDay: number;
    weekdays: Weekday[];
    dayStartTime: string;
    shortBreakMinutes: number;
    lunchBreakAfterPeriod?: number;
    lunchBreakMinutes: number;
    mode: SchoolAiScheduleMode;
    campus?: string;
  };
};

type TimeBlock = {
  weekday: Weekday;
  startTime: string;
  endTime: string;
  periodIndex: number;
};

type SlotTemplate = TimeBlock & {
  slotLabel: string;
};

type ResolvedScheduleConfig = {
  weeklyLessonsPerClass: number;
  lessonDurationMinutes: number;
  periodsPerDay: number;
  weekdays: Weekday[];
  dayStartTime: string;
  shortBreakMinutes: number;
  lunchBreakAfterPeriod?: number;
  lunchBreakMinutes: number;
  campus?: string;
  templateApplied: boolean;
};

function uniqueWeekdays(weekdays: Weekday[]) {
  return Array.from(new Set(weekdays)).sort((left, right) => left - right) as Weekday[];
}

function toMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function fromMinutes(value: number) {
  const total = ((value % 1440) + 1440) % 1440;
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function overlapsTimeRange(left: Pick<TimeBlock, "startTime" | "endTime">, right: Pick<TimeBlock, "startTime" | "endTime">) {
  return left.startTime < right.endTime && right.startTime < left.endTime;
}

function buildSlotTemplates(config: ResolvedScheduleConfig) {
  const weekdays = uniqueWeekdays(config.weekdays);
  const slots: SlotTemplate[] = [];

  weekdays.forEach((weekday) => {
    let cursor = toMinutes(config.dayStartTime);
    for (let periodIndex = 1; periodIndex <= config.periodsPerDay; periodIndex += 1) {
      const startTime = fromMinutes(cursor);
      const endTime = fromMinutes(cursor + config.lessonDurationMinutes);
      slots.push({
        weekday,
        periodIndex,
        startTime,
        endTime,
        slotLabel: `第${periodIndex}节`
      });
      cursor += config.lessonDurationMinutes;
      if (periodIndex < config.periodsPerDay) {
        cursor += config.shortBreakMinutes;
        if (config.lunchBreakAfterPeriod && periodIndex === config.lunchBreakAfterPeriod) {
          cursor += config.lunchBreakMinutes;
        }
      }
    }
  });

  return slots;
}

function pushBlock(map: Map<string, TimeBlock[]>, key: string, block: TimeBlock) {
  const list = map.get(key) ?? [];
  list.push(block);
  map.set(key, list);
}

function getDayLoad(map: Map<string, number>, key: string) {
  return map.get(key) ?? 0;
}

function incrementDayLoad(map: Map<string, number>, key: string) {
  map.set(key, getDayLoad(map, key) + 1);
}

function hasOverlap(blocks: TimeBlock[], candidate: TimeBlock) {
  return blocks.some((item) => item.weekday === candidate.weekday && overlapsTimeRange(item, candidate));
}

function buildFocusSummary(subject: string, lessonIndex: number) {
  const library = SUBJECT_FOCUS_LIBRARY[subject] ?? ["知识梳理", "例题训练", "课堂互动", "综合应用"];
  return `本节聚焦${library[lessonIndex % library.length]}`;
}

function buildRoomLabel(klass: { name: string; grade: string; subject: string }) {
  const subjectLabel = SUBJECT_LABELS[klass.subject] ?? klass.subject;
  return `${klass.name} · ${klass.grade}年级${subjectLabel}`;
}

function createTeacherConflictWarnings(
  sessions: ClassScheduleSession[],
  classMap: Map<string, { name: string; teacherId: string | null; teacherName?: string }>
) {
  const byTeacher = new Map<string, Array<ClassScheduleSession & { className: string; teacherName?: string }>>();
  sessions.forEach((item) => {
    const klass = classMap.get(item.classId);
    if (!klass?.teacherId) return;
    const list = byTeacher.get(klass.teacherId) ?? [];
    list.push({ ...item, className: klass.name, teacherName: klass.teacherName });
    byTeacher.set(klass.teacherId, list);
  });

  const warnings: string[] = [];
  byTeacher.forEach((list, teacherId) => {
    const sorted = list
      .slice()
      .sort((left, right) => {
        if (left.weekday !== right.weekday) return left.weekday - right.weekday;
        if (left.startTime !== right.startTime) return left.startTime.localeCompare(right.startTime);
        return left.classId.localeCompare(right.classId, "zh-CN");
      });
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      if (previous.weekday === current.weekday && overlapsTimeRange(previous, current)) {
        warnings.push(
          `教师 ${current.teacherName ?? teacherId} 现有课表存在撞课：${previous.className} 与 ${current.className} 在同一时间段重叠。`
        );
        break;
      }
    }
  });

  return warnings;
}

function scoreSlot(input: {
  slot: SlotTemplate;
  classId: string;
  teacherId: string;
  classBlocks: TimeBlock[];
  teacherBlocks: TimeBlock[];
  classDayLoad: Map<string, number>;
  teacherDayLoad: Map<string, number>;
}) {
  const classDayKey = `${input.classId}:${input.slot.weekday}`;
  const teacherDayKey = `${input.teacherId}:${input.slot.weekday}`;
  const adjacentClassPenalty = input.classBlocks.some(
    (item) =>
      item.weekday === input.slot.weekday &&
      (item.endTime === input.slot.startTime || item.startTime === input.slot.endTime)
  )
    ? 18
    : 0;
  const adjacentTeacherPenalty = input.teacherBlocks.some(
    (item) =>
      item.weekday === input.slot.weekday &&
      (item.endTime === input.slot.startTime || item.startTime === input.slot.endTime)
  )
    ? 8
    : 0;

  return (
    getDayLoad(input.classDayLoad, classDayKey) * 100 +
    getDayLoad(input.teacherDayLoad, teacherDayKey) * 30 +
    adjacentClassPenalty +
    adjacentTeacherPenalty +
    input.slot.periodIndex * 2 +
    input.slot.weekday
  );
}

function resolveClassConfig(input: SchoolAiScheduleInput, template?: Awaited<ReturnType<typeof getScheduleTemplateByGradeSubject>>) {
  return {
    weeklyLessonsPerClass: template?.weeklyLessonsPerClass ?? input.weeklyLessonsPerClass,
    lessonDurationMinutes: template?.lessonDurationMinutes ?? input.lessonDurationMinutes,
    periodsPerDay: template?.periodsPerDay ?? input.periodsPerDay,
    weekdays: uniqueWeekdays(template?.weekdays ?? input.weekdays),
    dayStartTime: template?.dayStartTime ?? input.dayStartTime,
    shortBreakMinutes: template?.shortBreakMinutes ?? input.shortBreakMinutes,
    lunchBreakAfterPeriod: template?.lunchBreakAfterPeriod ?? input.lunchBreakAfterPeriod,
    lunchBreakMinutes: template?.lunchBreakMinutes ?? input.lunchBreakMinutes,
    campus: template?.campus ?? input.campus,
    templateApplied: Boolean(template)
  } satisfies ResolvedScheduleConfig;
}

export async function generateAndApplySchoolAiSchedule(input: SchoolAiScheduleInput): Promise<SchoolAiScheduleResult> {
  const classes = await listSchoolClasses(input.schoolId);
  const classMap = new Map(classes.map((item) => [item.id, item]));
  const selectedIds = input.classIds?.length
    ? Array.from(new Set(input.classIds.map((item) => item.trim()).filter(Boolean)))
    : classes.map((item) => item.id);

  const selectedClasses = selectedIds
    .map((id) => classMap.get(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (selectedClasses.length !== selectedIds.length) {
    throw new Error("部分班级不存在或不属于当前学校");
  }

  const teacherClassLoad = new Map<string, number>();
  classes.forEach((item) => {
    if (!item.teacherId) return;
    teacherClassLoad.set(item.teacherId, (teacherClassLoad.get(item.teacherId) ?? 0) + 1);
  });

  const templates = await listSchoolScheduleTemplates({ schoolId: input.schoolId });
  const templateMap = new Map(templates.map((item) => [`${item.grade}:${item.subject}`, item]));
  const unavailableSlots = await listTeacherUnavailableSlots({ schoolId: input.schoolId });

  const selectedClassList = selectedClasses.sort((left, right) => {
    const teacherLoadLeft = left.teacherId ? teacherClassLoad.get(left.teacherId) ?? 0 : 0;
    const teacherLoadRight = right.teacherId ? teacherClassLoad.get(right.teacherId) ?? 0 : 0;
    if (teacherLoadRight !== teacherLoadLeft) return teacherLoadRight - teacherLoadLeft;
    if (left.scheduleCount !== right.scheduleCount) return left.scheduleCount - right.scheduleCount;
    if (right.studentCount !== left.studentCount) return right.studentCount - left.studentCount;
    return left.name.localeCompare(right.name, "zh-CN");
  });

  const selectedSet = new Set(selectedIds);
  const allSessions = await listClassScheduleSessions({ schoolId: input.schoolId });
  const currentSelectedSessions = allSessions.filter((item) => selectedSet.has(item.classId));
  const preservedSessions = input.mode === "replace_all" ? allSessions.filter((item) => !selectedSet.has(item.classId)) : allSessions.slice();

  const classBlocks = new Map<string, TimeBlock[]>();
  const teacherBlocks = new Map<string, TimeBlock[]>();
  const classDayLoad = new Map<string, number>();
  const teacherDayLoad = new Map<string, number>();
  const currentCountByClass = new Map<string, number>();

  currentSelectedSessions.forEach((item) => {
    currentCountByClass.set(item.classId, (currentCountByClass.get(item.classId) ?? 0) + 1);
  });

  preservedSessions.forEach((item) => {
    const klass = classMap.get(item.classId);
    const block: TimeBlock = {
      weekday: item.weekday,
      startTime: item.startTime,
      endTime: item.endTime,
      periodIndex: Number(item.slotLabel?.replace(/\D/g, "") || 0)
    };
    pushBlock(classBlocks, item.classId, block);
    incrementDayLoad(classDayLoad, `${item.classId}:${item.weekday}`);
    if (klass?.teacherId) {
      pushBlock(teacherBlocks, klass.teacherId, block);
      incrementDayLoad(teacherDayLoad, `${klass.teacherId}:${item.weekday}`);
    }
  });

  unavailableSlots.forEach((item) => {
    pushBlock(teacherBlocks, item.teacherId, {
      weekday: item.weekday,
      startTime: item.startTime,
      endTime: item.endTime,
      periodIndex: 0
    });
  });

  const warnings = createTeacherConflictWarnings(preservedSessions, classMap);
  const drafts: ClassScheduleSessionInput[] = [];
  const impactedClasses: SchoolAiScheduleResult["impactedClasses"] = [];

  let requestedLessons = 0;
  let unresolvedLessons = 0;
  let skippedClassCount = 0;
  let untouchedClassCount = 0;
  let templateAppliedClassCount = 0;

  selectedClassList.forEach((klass) => {
    const template = templateMap.get(`${klass.grade}:${klass.subject}`);
    const resolvedConfig = resolveClassConfig(input, template);
    if (resolvedConfig.templateApplied) {
      templateAppliedClassCount += 1;
    }

    const slots = buildSlotTemplates(resolvedConfig);
    const maxDailyLessonsPerClass = Math.max(2, Math.ceil(resolvedConfig.weeklyLessonsPerClass / Math.max(resolvedConfig.weekdays.length, 1)));
    const existingCount = currentCountByClass.get(klass.id) ?? 0;
    const requestedForClass =
      input.mode === "replace_all"
        ? resolvedConfig.weeklyLessonsPerClass
        : Math.max(resolvedConfig.weeklyLessonsPerClass - existingCount, 0);

    requestedLessons += requestedForClass;

    if (requestedForClass === 0) {
      untouchedClassCount += 1;
      impactedClasses.push({
        id: klass.id,
        name: klass.name,
        subject: klass.subject,
        grade: klass.grade,
        teacherId: klass.teacherId,
        teacherName: klass.teacherName,
        requestedLessons: 0,
        createdLessons: 0,
        totalLessonsAfter: existingCount,
        status: "unchanged",
        reason: "已达到目标课时"
      });
      return;
    }

    if (!klass.teacherId) {
      skippedClassCount += 1;
      unresolvedLessons += requestedForClass;
      warnings.push(`班级 ${klass.name} 未绑定教师，AI 排课已跳过。`);
      impactedClasses.push({
        id: klass.id,
        name: klass.name,
        subject: klass.subject,
        grade: klass.grade,
        teacherId: null,
        teacherName: klass.teacherName,
        requestedLessons: requestedForClass,
        createdLessons: 0,
        totalLessonsAfter: existingCount,
        status: "skipped",
        reason: "未绑定教师"
      });
      return;
    }

    const createdForClass: ClassScheduleSessionInput[] = [];

    for (let lessonIndex = 0; lessonIndex < requestedForClass; lessonIndex += 1) {
      const nextClassBlocks = classBlocks.get(klass.id) ?? [];
      const nextTeacherBlocks = teacherBlocks.get(klass.teacherId) ?? [];

      const buildCandidates = (respectDailyCap: boolean) =>
        slots.filter((slot) => {
          if (hasOverlap(nextClassBlocks, slot) || hasOverlap(nextTeacherBlocks, slot)) {
            return false;
          }
          if (!respectDailyCap) {
            return true;
          }
          return getDayLoad(classDayLoad, `${klass.id}:${slot.weekday}`) < maxDailyLessonsPerClass;
        });

      let candidates = buildCandidates(true);
      if (!candidates.length) {
        candidates = buildCandidates(false);
      }
      if (!candidates.length) {
        break;
      }

      candidates.sort(
        (left, right) =>
          scoreSlot({
            slot: left,
            classId: klass.id,
            teacherId: klass.teacherId!,
            classBlocks: nextClassBlocks,
            teacherBlocks: nextTeacherBlocks,
            classDayLoad,
            teacherDayLoad
          }) -
          scoreSlot({
            slot: right,
            classId: klass.id,
            teacherId: klass.teacherId!,
            classBlocks: nextClassBlocks,
            teacherBlocks: nextTeacherBlocks,
            classDayLoad,
            teacherDayLoad
          })
      );

      const chosen = candidates[0];
      const block: TimeBlock = {
        weekday: chosen.weekday,
        startTime: chosen.startTime,
        endTime: chosen.endTime,
        periodIndex: chosen.periodIndex
      };
      const draft: ClassScheduleSessionInput = {
        classId: klass.id,
        weekday: chosen.weekday,
        startTime: chosen.startTime,
        endTime: chosen.endTime,
        slotLabel: chosen.slotLabel,
        room: buildRoomLabel(klass),
        campus: resolvedConfig.campus?.trim() || "主校区",
        focusSummary: buildFocusSummary(klass.subject, lessonIndex),
        note: resolvedConfig.templateApplied
          ? `AI辅助排课 · 应用 ${klass.grade}年级 ${SUBJECT_LABELS[klass.subject] ?? klass.subject} 模板`
          : `AI辅助排课 · 使用默认配置 ${resolvedConfig.weeklyLessonsPerClass} 节/周`
      };

      drafts.push(draft);
      createdForClass.push(draft);
      pushBlock(classBlocks, klass.id, block);
      pushBlock(teacherBlocks, klass.teacherId, block);
      incrementDayLoad(classDayLoad, `${klass.id}:${chosen.weekday}`);
      incrementDayLoad(teacherDayLoad, `${klass.teacherId}:${chosen.weekday}`);
    }

    if (createdForClass.length < requestedForClass) {
      unresolvedLessons += requestedForClass - createdForClass.length;
      warnings.push(
        `班级 ${klass.name} 仅成功生成 ${createdForClass.length}/${requestedForClass} 节，剩余时段受教师占用、禁排规则或可用课时限制。`
      );
    }
    if (createdForClass.length === 0) {
      skippedClassCount += 1;
    }

    impactedClasses.push({
      id: klass.id,
      name: klass.name,
      subject: klass.subject,
      grade: klass.grade,
      teacherId: klass.teacherId,
      teacherName: klass.teacherName,
      requestedLessons: requestedForClass,
      createdLessons: createdForClass.length,
      totalLessonsAfter: input.mode === "replace_all" ? createdForClass.length : existingCount + createdForClass.length,
      status: createdForClass.length ? "generated" : "skipped",
      reason: createdForClass.length
        ? resolvedConfig.templateApplied
          ? "已按年级学科模板生成"
          : "已按默认配置生成"
        : "当前排课约束下无可用时段"
    });
  });

  const created = await applyClassSchedulePlan({
    schoolId: input.schoolId,
    replaceClassIds: input.mode === "replace_all" ? selectedIds : undefined,
    items: drafts
  });

  const createdSessions = created.map((item) => {
    const klass = classMap.get(item.classId);
    return {
      ...item,
      className: klass?.name ?? item.classId,
      subject: klass?.subject ?? "unknown",
      grade: klass?.grade ?? "-",
      teacherName: klass?.teacherName,
      teacherId: klass?.teacherId ?? null
    };
  });

  return {
    summary: {
      targetClassCount: selectedClassList.length,
      teacherBoundClassCount: selectedClassList.filter((item) => item.teacherId).length,
      replacedClassCount: input.mode === "replace_all" ? selectedClassList.length : 0,
      createdSessions: createdSessions.length,
      requestedLessons,
      unresolvedLessons,
      skippedClassCount,
      untouchedClassCount,
      templateAppliedClassCount
    },
    warnings,
    createdSessions,
    impactedClasses,
    config: {
      weeklyLessonsPerClass: input.weeklyLessonsPerClass,
      lessonDurationMinutes: input.lessonDurationMinutes,
      periodsPerDay: input.periodsPerDay,
      weekdays: uniqueWeekdays(input.weekdays),
      dayStartTime: input.dayStartTime,
      shortBreakMinutes: input.shortBreakMinutes,
      lunchBreakAfterPeriod: input.lunchBreakAfterPeriod,
      lunchBreakMinutes: input.lunchBreakMinutes,
      mode: input.mode,
      campus: input.campus?.trim() || undefined
    }
  };
}
