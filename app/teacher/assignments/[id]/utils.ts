import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import type {
  AssignmentNotifyTarget,
  AssignmentStudentFilter,
  RubricItem,
  RubricPayloadItem,
  RubricLevel,
  TeacherAssignmentDetailData,
  TeacherAssignmentStudent
} from "./types";

export const STUDENT_FILTER_LABELS: Record<AssignmentStudentFilter, string> = {
  all: "全部学生",
  pending: "未完成",
  review: "待批改",
  low_score: "低于 60%",
  completed: "已完成"
};

export function normalizeRubricItems(items: RubricPayloadItem[] = []): RubricItem[] {
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

export function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatDateOnly(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("zh-CN");
}

export function getDueRelativeLabel(dueDate: string, now: number) {
  const diffMs = new Date(dueDate).getTime() - now;
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return `已逾期 ${Math.abs(diffDays)} 天`;
  if (diffDays === 0) return "今天截止";
  if (diffDays === 1) return "明天截止";
  return `${diffDays} 天后截止`;
}

export function getTeacherAssignmentDetailRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim();
  const lower = requestMessage.toLowerCase();

  if (status === 401 || status === 403) {
    return "教师登录状态已失效，请重新登录后继续查看作业。";
  }
  if (status === 404 && lower === "not found") {
    return "作业不存在，或当前教师账号无权查看该作业。";
  }
  if (lower === "missing items" || lower === "body.items must contain at least 1 items") {
    return "请至少保留一个评分维度后再保存评分细则。";
  }
  if (/^body\.items\[\d+\]\.title /.test(lower)) {
    return "评分维度标题不能为空。";
  }
  if (/^body\.items\[\d+\]\.description /.test(lower)) {
    return "评分维度说明不能为空。";
  }
  if (/^body\.items\[\d+\]\.maxscore /.test(lower)) {
    return "评分维度满分至少为 1 分。";
  }
  if (/^body\.items\[\d+\]\.weight /.test(lower)) {
    return "评分维度权重至少为 1。";
  }
  if (/^body\.items\[\d+\]\.levels\[\d+\]\.label /.test(lower)) {
    return "评分档位名称不能为空。";
  }
  if (/^body\.items\[\d+\]\.levels\[\d+\]\.description /.test(lower)) {
    return "评分档位说明不能为空。";
  }
  if (/^body\.items\[\d+\]\.levels\[\d+\]\.score /.test(lower)) {
    return "评分档位分值格式不正确，请重新填写。";
  }
  return getRequestErrorMessage(error, fallback);
}

export function isMissingTeacherAssignmentDetailError(error: unknown) {
  return (getRequestStatus(error) ?? 0) === 404 && getRequestErrorMessage(error, "").trim().toLowerCase() === "not found";
}

export function getStudentStatusLabel(status: string, assignmentOverdue: boolean) {
  if (status === "completed") return "已完成";
  return assignmentOverdue ? "已逾期未交" : "待提交";
}

export function getStudentStatusPillClassName(status: string, assignmentOverdue: boolean) {
  if (status === "completed") return "gradebook-pill done";
  return assignmentOverdue ? "gradebook-pill overdue" : "gradebook-pill pending";
}

export function getStudentPriority(student: TeacherAssignmentStudent, assignmentOverdue: boolean) {
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

export function getTeacherAssignmentStudentPriorityRank(
  student: TeacherAssignmentStudent,
  assignmentOverdue: boolean
) {
  if (student.status !== "completed") {
    return assignmentOverdue ? 0 : 1;
  }
  if (student.score === null || student.total === null) {
    return 2;
  }
  if (student.total > 0 && student.score / student.total < 0.6) {
    return 3;
  }
  return 4;
}

export function buildTeacherAssignmentNotifyPreviewStudents(
  students: TeacherAssignmentStudent[],
  notifyTarget: AssignmentNotifyTarget,
  threshold: number
) {
  if (notifyTarget === "missing") {
    return students.filter((student) => student.status !== "completed");
  }
  if (notifyTarget === "low_score") {
    return students.filter(
      (student) =>
        student.status === "completed" &&
        student.score !== null &&
        student.total !== null &&
        student.total > 0 &&
        (student.score / student.total) * 100 < threshold
    );
  }
  return students;
}

export function filterTeacherAssignmentStudents(
  students: TeacherAssignmentStudent[],
  studentFilter: AssignmentStudentFilter,
  studentKeyword: string,
  assignmentOverdue: boolean
) {
  const keywordLower = studentKeyword.trim().toLowerCase();
  let nextStudents = students;

  if (studentFilter === "pending") {
    nextStudents = nextStudents.filter((student) => student.status !== "completed");
  } else if (studentFilter === "review") {
    nextStudents = nextStudents.filter(
      (student) =>
        student.status === "completed" &&
        (student.score === null || student.total === null)
    );
  } else if (studentFilter === "low_score") {
    nextStudents = nextStudents.filter(
      (student) =>
        student.status === "completed" &&
        student.score !== null &&
        student.total !== null &&
        student.total > 0 &&
        student.score / student.total < 0.6
    );
  } else if (studentFilter === "completed") {
    nextStudents = nextStudents.filter((student) => student.status === "completed");
  }

  if (keywordLower) {
    nextStudents = nextStudents.filter((student) =>
      [student.name, student.email, student.grade ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(keywordLower)
    );
  }

  return nextStudents.slice().sort((left, right) => {
    const rankDiff =
      getTeacherAssignmentStudentPriorityRank(left, assignmentOverdue) -
      getTeacherAssignmentStudentPriorityRank(right, assignmentOverdue);
    if (rankDiff !== 0) {
      return rankDiff;
    }
    if (left.status === "completed" && right.status === "completed") {
      const leftTs = new Date(left.completedAt ?? "").getTime();
      const rightTs = new Date(right.completedAt ?? "").getTime();
      return rightTs - leftTs;
    }
    return left.name.localeCompare(right.name, "zh-CN");
  });
}

export function getTeacherAssignmentDetailDerivedState({
  data,
  notifyTarget,
  threshold,
  studentFilter,
  studentKeyword,
  now
}: {
  data: TeacherAssignmentDetailData | null;
  notifyTarget: AssignmentNotifyTarget;
  threshold: number;
  studentFilter: AssignmentStudentFilter;
  studentKeyword: string;
  now: number;
}) {
  const students = data?.students ?? [];
  const assignmentOverdue = data
    ? new Date(data.assignment.dueDate).getTime() < now
    : false;
  const completedStudents = students.filter((student) => student.status === "completed");
  const pendingStudents = students.filter((student) => student.status !== "completed");
  const reviewReadyStudents = completedStudents.filter(
    (student) => student.score === null || student.total === null
  );
  const scoredStudents = completedStudents.filter(
    (student) =>
      student.score !== null && student.total !== null && student.total > 0
  );
  const lowScoreStudents = scoredStudents.filter(
    (student) => student.score! / student.total! < 0.6
  );
  const latestCompletedStudent =
    [...completedStudents].sort((left, right) => {
      const leftTs = new Date(left.completedAt ?? "").getTime();
      const rightTs = new Date(right.completedAt ?? "").getTime();
      return rightTs - leftTs;
    })[0] ?? null;
  const completionRate = students.length
    ? Math.round((completedStudents.length / students.length) * 100)
    : 0;
  const averagePercent = scoredStudents.length
    ? Math.round(
        scoredStudents.reduce(
          (sum, student) => sum + (student.score! / student.total!) * 100,
          0
        ) / scoredStudents.length
      )
    : null;
  const notifyPreviewStudents = buildTeacherAssignmentNotifyPreviewStudents(
    students,
    notifyTarget,
    threshold
  );
  const hasStudentFilters = Boolean(studentFilter !== "all" || studentKeyword.trim());

  return {
    assignmentOverdue,
    completedStudents,
    pendingStudents,
    reviewReadyStudents,
    scoredStudents,
    lowScoreStudents,
    latestCompletedStudent,
    completionRate,
    averagePercent,
    notifyPreviewStudents,
    hasStudentFilters,
    filteredStudents: filterTeacherAssignmentStudents(
      students,
      studentFilter,
      studentKeyword,
      assignmentOverdue
    )
  };
}

export function createTeacherAssignmentRubricLevel(maxScore: number): RubricLevel {
  return {
    label: "分档",
    score: maxScore,
    description: ""
  };
}

export function createTeacherAssignmentRubricItem(): RubricItem {
  return {
    title: "评分维度",
    description: "",
    maxScore: 10,
    weight: 1,
    levels: [
      { label: "优秀", score: 10, description: "表现优秀" },
      { label: "良好", score: 8, description: "表现良好" },
      { label: "需改进", score: 6, description: "需要改进" }
    ]
  };
}

export function patchTeacherAssignmentRubricItem(
  rubrics: RubricItem[],
  index: number,
  patch: Partial<RubricItem>
) {
  return rubrics.map((item, idx) => (idx === index ? { ...item, ...patch } : item));
}

export function patchTeacherAssignmentRubricLevel(
  rubrics: RubricItem[],
  rubricIndex: number,
  levelIndex: number,
  patch: Partial<RubricLevel>
) {
  return rubrics.map((item, idx) => {
    if (idx !== rubricIndex) {
      return item;
    }
    return {
      ...item,
      levels: item.levels.map((level, currentLevelIndex) =>
        currentLevelIndex === levelIndex ? { ...level, ...patch } : level
      )
    };
  });
}

export function appendTeacherAssignmentRubricItem(rubrics: RubricItem[]) {
  return [...rubrics, createTeacherAssignmentRubricItem()];
}

export function removeTeacherAssignmentRubricItem(rubrics: RubricItem[], index: number) {
  return rubrics.filter((_, currentIndex) => currentIndex !== index);
}

export function appendTeacherAssignmentRubricLevel(rubrics: RubricItem[], index: number) {
  return rubrics.map((item, currentIndex) =>
    currentIndex === index
      ? {
          ...item,
          levels: [...item.levels, createTeacherAssignmentRubricLevel(item.maxScore)]
        }
      : item
  );
}

export function removeTeacherAssignmentRubricLevel(
  rubrics: RubricItem[],
  rubricIndex: number,
  levelIndex: number
) {
  return rubrics.map((item, currentIndex) =>
    currentIndex === rubricIndex
      ? {
          ...item,
          levels: item.levels.filter((_, currentLevelIndex) => currentLevelIndex !== levelIndex)
        }
      : item
  );
}
