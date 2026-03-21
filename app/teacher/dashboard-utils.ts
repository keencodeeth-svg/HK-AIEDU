import type { CourseModule } from "@/lib/modules";
import { getRequestErrorMessage, getRequestStatus } from "@/lib/client-request";
import type {
  AlertImpactData,
  AssignmentFormState,
  AssignmentItem,
  ClassFormState,
  ClassItem,
  KnowledgePoint,
  TeacherDashboardDerivedState,
  TeacherInsightsData,
  TeacherJoinMode,
  TeacherJoinRequest
} from "./types";

const TEACHER_DASHBOARD_DEFAULT_DUE_DAYS = 7;

type CreatedAssignment = Partial<AssignmentItem> & { moduleTitle?: string };

export function buildTeacherDashboardDefaultDueDate(now = Date.now()) {
  return new Date(now + TEACHER_DASHBOARD_DEFAULT_DUE_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export function prependTeacherDashboardClass(
  previousClasses: ClassItem[],
  createdClass: Partial<ClassItem>,
  classForm: ClassFormState
) {
  if (!createdClass.id) {
    return previousClasses;
  }

  return [
    {
      id: createdClass.id,
      name: createdClass.name ?? classForm.name,
      subject: createdClass.subject ?? classForm.subject,
      grade: createdClass.grade ?? classForm.grade,
      studentCount: 0,
      assignmentCount: 0,
      joinCode: createdClass.joinCode,
      joinMode: createdClass.joinMode ?? "approval"
    },
    ...previousClasses.filter((item) => item.id !== createdClass.id)
  ];
}

export function incrementTeacherDashboardStudentCount(
  previousClasses: ClassItem[],
  classId: string
) {
  return previousClasses.map((item) =>
    item.id === classId
      ? { ...item, studentCount: item.studentCount + 1 }
      : item
  );
}

export function prependTeacherDashboardAssignment(
  previousAssignments: AssignmentItem[],
  createdAssignment: CreatedAssignment,
  targetClass: ClassItem,
  assignmentForm: AssignmentFormState,
  selectedModule?: Pick<CourseModule, "title"> | null
) {
  if (!createdAssignment.id) {
    return previousAssignments;
  }

  return [
    {
      id: createdAssignment.id,
      classId: createdAssignment.classId ?? targetClass.id,
      className: targetClass.name,
      classSubject: targetClass.subject,
      classGrade: targetClass.grade,
      moduleTitle:
        createdAssignment.moduleTitle ??
        (assignmentForm.moduleId ? selectedModule?.title ?? "" : ""),
      title: createdAssignment.title ?? assignmentForm.title,
      dueDate: createdAssignment.dueDate ?? assignmentForm.dueDate,
      total: targetClass.studentCount,
      completed: 0,
      submissionType: createdAssignment.submissionType ?? assignmentForm.submissionType
    },
    ...previousAssignments.filter((item) => item.id !== createdAssignment.id)
  ];
}

export function incrementTeacherDashboardAssignmentCount(
  previousClasses: ClassItem[],
  classId: string
) {
  return previousClasses.map((item) =>
    item.id === classId
      ? { ...item, assignmentCount: item.assignmentCount + 1 }
      : item
  );
}

export function updateTeacherDashboardClassJoinMode(
  previousClasses: ClassItem[],
  classId: string,
  joinMode: TeacherJoinMode
) {
  return previousClasses.map((item) =>
    item.id === classId ? { ...item, joinMode } : item
  );
}

export function updateTeacherDashboardClassJoinCode(
  previousClasses: ClassItem[],
  classId: string,
  joinCode?: string
) {
  return previousClasses.map((item) =>
    item.id === classId ? { ...item, joinCode: joinCode ?? item.joinCode } : item
  );
}

export function removeTeacherDashboardClassSnapshot(
  previousClasses: ClassItem[],
  classId: string
) {
  const classes = previousClasses.filter((item) => item.id !== classId);
  return {
    classes,
    nextClassId: classes[0]?.id ?? ""
  };
}

export function removeTeacherDashboardJoinRequest(
  previousJoinRequests: TeacherJoinRequest[],
  requestId: string
) {
  return previousJoinRequests.filter((item) => item.id !== requestId);
}

export function removeTeacherDashboardAlertImpact(
  previousImpactByAlertId: Record<string, AlertImpactData>,
  alertId: string
) {
  if (!previousImpactByAlertId[alertId]) {
    return previousImpactByAlertId;
  }

  const nextImpactByAlertId = { ...previousImpactByAlertId };
  delete nextImpactByAlertId[alertId];
  return nextImpactByAlertId;
}

type TeacherDashboardDerivedStateInput = {
  classes: ClassItem[];
  assignments: AssignmentItem[];
  knowledgePoints: KnowledgePoint[];
  assignmentClassId: string;
  insights: TeacherInsightsData | null;
  joinRequests: TeacherJoinRequest[];
  now?: number;
};

export function getTeacherDashboardDerivedState({
  classes,
  assignments,
  knowledgePoints,
  assignmentClassId,
  insights,
  joinRequests,
  now = Date.now()
}: TeacherDashboardDerivedStateInput): TeacherDashboardDerivedState {
  const klass = classes.find((item) => item.id === assignmentClassId);

  return {
    filteredPoints: klass
      ? knowledgePoints.filter(
          (kp) => kp.subject === klass.subject && kp.grade === klass.grade
        )
      : [],
    pendingJoinCount: joinRequests.filter((item) => item.status === "pending").length,
    activeAlertCount: (insights?.alerts ?? []).filter((item) => item.status === "active").length,
    classesMissingAssignmentsCount: classes.filter(
      (item) => item.studentCount > 0 && item.assignmentCount === 0
    ).length,
    dueSoonAssignmentCount: assignments.filter((item) => {
      if (item.completed >= item.total) {
        return false;
      }

      return Math.ceil((new Date(item.dueDate).getTime() - now) / (60 * 60 * 1000)) <= 48;
    }).length,
    hasDashboardData:
      classes.length > 0 ||
      assignments.length > 0 ||
      insights !== null ||
      joinRequests.length > 0
  };
}

export function getTeacherDashboardClassRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim();
  const lower = requestMessage.toLowerCase();

  if (status === 401 || status === 403) {
    return "教师登录状态已失效，请重新登录后继续使用教师工作台。";
  }
  if (lower === "invalid subject") {
    return "当前学科不可用，请重新选择后再创建班级。";
  }
  if (lower === "student not found") {
    return "未找到该学生账号，请确认学生邮箱是否正确。";
  }
  if (requestMessage === "班级与学生学校不匹配") {
    return "该学生与当前班级不属于同一学校，暂时无法加入。";
  }
  if (lower === "class not found" || (status === 404 && lower === "not found")) {
    return "当前班级不存在，或你已失去该班级的操作权限。";
  }
  if (lower === "questioncount must be greater than 0 for quiz assignments") {
    return "测验作业至少需要 1 道题。";
  }
  if (lower === "module not found") {
    return "所选课程模块不存在，或已不属于当前班级。";
  }
  if (requestMessage === "AI 未配置且题库数量不足，请先导入题库或配置模型") {
    return "AI 出题暂不可用，且当前题库数量不足；请先导入题库或配置模型。";
  }
  if (requestMessage === "题库数量不足") {
    return "当前题库数量不足，无法按现有条件发布作业。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function getTeacherDashboardAlertRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim();
  const lower = requestMessage.toLowerCase();

  if (status === 401 || status === 403) {
    return "教师登录状态已失效，请重新登录后继续处理工作台预警。";
  }
  if (lower === "invalid alert id" || (status === 404 && lower === "not found")) {
    return "该预警已不存在，列表将按最新状态刷新。";
  }
  if (lower === "invalid actiontype") {
    return "当前预警动作不可用，请刷新列表后重试。";
  }
  if (lower === "alert has no target students") {
    return "该预警当前没有可执行的学生对象，建议刷新列表后重试。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function getTeacherDashboardJoinRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim();

  if (status === 401 || status === 403) {
    return "教师登录状态已失效，请重新登录后继续处理入班申请。";
  }
  if ((getRequestStatus(error) ?? 0) === 404 && requestMessage.toLowerCase() === "not found") {
    return "该加入班级申请已不存在，列表将按最新状态刷新。";
  }
  if (requestMessage === "班级与学生学校不匹配") {
    return "申请中的学生与班级不属于同一学校，暂时无法通过。";
  }

  return getRequestErrorMessage(error, fallback);
}

export function isMissingTeacherDashboardClassError(error: unknown) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();
  return requestMessage === "class not found" || (status === 404 && requestMessage === "not found");
}

export function isMissingTeacherDashboardAlertError(error: unknown) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, "").trim().toLowerCase();
  return requestMessage === "invalid alert id" || (status === 404 && requestMessage === "not found");
}

export function isMissingTeacherDashboardJoinRequestError(error: unknown) {
  return (getRequestStatus(error) ?? 0) === 404 && getRequestErrorMessage(error, "").trim().toLowerCase() === "not found";
}

export function isTeacherDashboardModuleMissingError(error: unknown) {
  return getRequestErrorMessage(error, "").trim().toLowerCase() === "module not found";
}
